import * as SecureStore from "expo-secure-store";
import { auth } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const LOCALE_KEY = "talkcash_locale";
const REQUEST_TIMEOUT_MS = 25000;
const MAX_RETRIES = 2;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function parseErrorDetail(body: unknown, status: number): string {
  if (typeof body === "object" && body !== null && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : String(item)))
        .join(", ");
    }
  }
  return `API error: ${status}`;
}

async function handleUnauthorized(): Promise<void> {
  await auth.clear();
  try {
    const { router } = await import("expo-router");
    router.replace("/login");
  } catch {
    /* web / tests */
  }
}

function shouldRetry(status: number): boolean {
  return status >= 500 || status === 429;
}

async function request<T>(path: string, options?: RequestInit, attempt = 0): Promise<T> {
  const token = await auth.getToken();
  const locale = await SecureStore.getItemAsync(LOCALE_KEY);
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (locale) headers["Accept-Language"] = locale;
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401) {
      await handleUnauthorized();
      throw new ApiError("Session expired", 401);
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const detail = parseErrorDetail(errBody, res.status);
      if (shouldRetry(res.status) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return request<T>(path, options, attempt + 1);
      }
      throw new ApiError(detail, res.status);
    }

    if (res.headers.get("content-type")?.includes("application/json")) {
      return res.json();
    }
    return res.blob() as unknown as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      return request<T>(path, options, attempt + 1);
    }
    throw new ApiError(err instanceof Error ? err.message : "Network error", 0);
  } finally {
    clearTimeout(timeout);
  }
}

export const api = {
  // Auth
  register: (email: string, password: string, fullName: string) =>
    request<any>("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: fullName }) }),
  login: (email: string, password: string) =>
    request<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  setPin: (pin: string) => request("/auth/pin", { method: "POST", body: JSON.stringify({ pin }) }),
  verifyPin: (pin: string) => request("/auth/pin/verify", { method: "POST", body: JSON.stringify({ pin }) }),
  toggleBiometric: (enabled: boolean) => request(`/auth/biometric?enabled=${enabled}`, { method: "POST" }),
  setLocale: (locale: string) => request("/auth/locale", { method: "PUT", body: JSON.stringify({ locale }) }),
  setTimezone: (timezone: string) => request("/auth/timezone", { method: "PUT", body: JSON.stringify({ timezone }) }),
  getMe: () => request<any>("/auth/me"),

  // Input
  parseText: (text: string, whisperMode = false) =>
    request<any>(`/input/parse?text=${encodeURIComponent(text)}&whisper_mode=${whisperMode}`, { method: "POST" }),
  parseSlash: (command: string) =>
    request<any>(`/input/slash?command=${encodeURIComponent(command)}`, { method: "POST" }),
  parseVoice: async (uri: string, whisperMode = false) => {
    const form = new FormData();
    form.append("audio", { uri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/voice?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },
  executeAction: async (parsed: object, confirmed: boolean) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request("/execute/confirm", { method: "POST", body: JSON.stringify({ parsed, action: { confirmed } }) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "execute", payload: { parsed, action: { confirmed } } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  autocomplete: (query: string) => request<any>(`/input/autocomplete?query=${encodeURIComponent(query)}`),

  // Wallets
  getNetWorth: () => request<any>("/wallets/net-worth"),
  getWallets: () => request<any[]>("/wallets/"),
  createWallet: (name: string, walletType: string, currency = "TRY") =>
    request("/wallets/", { method: "POST", body: JSON.stringify({ name, wallet_type: walletType, currency }) }),
  transfer: (fromId: string, toId: string, amount: number, description = "") =>
    request("/wallets/transfer", { method: "POST", body: JSON.stringify({ from_wallet_id: fromId, to_wallet_id: toId, amount, description }) }),
  addIncome: (walletId: string, amount: number, description = "") =>
    request(`/wallets/income?wallet_id=${walletId}&amount=${amount}&description=${encodeURIComponent(description)}`, { method: "POST" }),

  // Transactions
  getTransactions: (limit = 50) => request<any[]>(`/transactions/?limit=${limit}`),

  // Agenda
  getAgenda: (days = 30) => request<any[]>(`/agenda/?days=${days}`),
  addBill: (title: string, amount: number, dueDate: string, force = false, isRecurring = false) =>
    request<any>(
      `/agenda/bill?title=${encodeURIComponent(title)}&amount=${amount}&due_date=${dueDate}&force=${force}&is_recurring=${isRecurring}`,
      { method: "POST" },
    ),
  markPaid: (title: string, walletId?: string) =>
    request(`/agenda/pay?title=${encodeURIComponent(title)}${walletId ? `&wallet_id=${walletId}` : ""}`, { method: "POST" }),
  createInstallments: (title: string, total: number, count: number) =>
    request(`/agenda/installments?title=${encodeURIComponent(title)}&total=${total}&count=${count}`, { method: "POST" }),

  // Shopping
  getShoppingList: () => request<any>("/shopping/"),
  addShoppingItems: async (items: string[]) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request("/shopping/add", { method: "POST", body: JSON.stringify({ items }) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_add", payload: { items } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  completeShoppingItem: (itemId: string, price?: number, walletId?: string) => {
    let url = `/shopping/complete/${itemId}`;
    const params = new URLSearchParams();
    if (price) params.set("price", String(price));
    if (walletId) params.set("wallet_id", walletId);
    const qs = params.toString();
    return request(`${url}${qs ? `?${qs}` : ""}`, { method: "POST" });
  },
  setRoutine: (itemId: string, isRoutine: boolean, routineType: "daily" | "weekly" = "daily") =>
    request(`/shopping/${itemId}/routine`, {
      method: "PATCH",
      body: JSON.stringify({ is_routine: isRoutine, routine_type: routineType }),
    }),

  // OCR
  scanReceipt: async (uri: string) => {
    const form = new FormData();
    form.append("image", { uri, type: "image/jpeg", name: "receipt.jpg" } as any);
    return request<any>("/ocr/scan", { method: "POST", body: form });
  },
  getReceipts: () => request<any[]>("/ocr/"),
  verifyReceipt: (transactionAmount: number, receiptAmount?: number, receiptId?: string) => {
    let url = `/ocr/verify?transaction_amount=${transactionAmount}`;
    if (receiptAmount != null) url += `&receipt_amount=${receiptAmount}`;
    if (receiptId) url += `&receipt_id=${receiptId}`;
    return request<{ verified: boolean; receipt_amount?: number; transaction_amount?: number }>(url, { method: "POST" });
  },
  getInputCapabilities: () => request<any>("/input/capabilities"),

  getNearbyMarkets: (lat: number, lng: number, radiusKm = 2, useOsm = true) =>
    request<{
      markets: { id: string; name: string; chain: string; lat: number; lng: number; distance_km: number; source?: string }[];
      count: number;
      source: string;
    }>(`/geofence/markets?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&use_osm=${useOsm}`),

  // Budgets
  getBudgets: () => request<any[]>("/budgets/"),
  createBudget: (category: string, monthlyLimit: number) =>
    request("/budgets/", { method: "POST", body: JSON.stringify({ category, monthly_limit: monthlyLimit }) }),
  updateBudget: (id: string, monthlyLimit: number) =>
    request(`/budgets/${id}`, { method: "PUT", body: JSON.stringify({ monthly_limit: monthlyLimit }) }),
  deleteBudget: (id: string) => request(`/budgets/${id}`, { method: "DELETE" }),

  // AI
  getBudgetAlerts: () => request<any[]>("/ai/budget-alerts"),
  getForecast: (balance: number) => request<any>(`/ai/forecast?current_balance=${balance}`),
  getPriceTracker: (product: string) => request<any>(`/ai/price-tracker?product=${encodeURIComponent(product)}`),

  // Social
  splitBill: (total: number, personCount: number) =>
    request<any>(`/social/split?total=${total}&person_count=${personCount}`, { method: "POST" }),
  addDebt: (personName: string, amount: number, isLent = true) =>
    request(`/social/debt?person_name=${encodeURIComponent(personName)}&amount=${amount}&is_lent=${isLent}`, { method: "POST" }),
  getDebts: () => request<any[]>("/social/debts"),
  settleDebt: (id: string) => request(`/social/debts/${id}/settle`, { method: "POST" }),
  getSharedWallets: () => request<any[]>("/social/shared-wallet"),
  createSharedWallet: (name: string, memberEmail?: string) => {
    let url = `/social/shared-wallet?name=${encodeURIComponent(name)}`;
    if (memberEmail) url += `&member_email=${encodeURIComponent(memberEmail)}`;
    return request(url, { method: "POST" });
  },
  addSharedWalletExpense: (walletId: string, amount: number, description = "") =>
    request(`/social/shared-wallet/${walletId}/expense?amount=${amount}&description=${encodeURIComponent(description)}`, { method: "POST" }),

  // Notifications
  registerPushToken: (token: string) =>
    request(`/notifications/register-token?token=${encodeURIComponent(token)}`, { method: "POST" }),
  getNotifications: () => request<any[]>("/notifications/"),

  // Export
  exportPdf: () => request<Blob>("/export/pdf"),
  exportExcel: () => request<Blob>("/export/excel"),

  // Sync
  syncPush: (operations: object[]) =>
    request<any>("/sync/push", { method: "POST", body: JSON.stringify({ operations }) }),
  syncPull: () => request<any>("/sync/pull"),
};

export async function resolveMediaUrl(path: string): Promise<{ uri: string; headers?: Record<string, string> }> {
  if (!path) return { uri: "" };
  if (path.startsWith("http")) return { uri: path };
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const uri = normalized.startsWith("api/v1/") ? `${API_BASE.replace(/\/api\/v1\/?$/, "")}/${normalized}` : `${API_BASE}/${normalized}`;
  const token = await auth.getToken();
  return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}
