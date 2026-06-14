import * as SecureStore from "expo-secure-store";
import { auth } from "./auth";
import { getApiBaseUrl } from "./config";

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

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = await auth.getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      await auth.updateTokens(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

async function request<T>(path: string, options?: RequestInit, attempt = 0, authRetry = false): Promise<T> {
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
    const res = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (res.status === 401) {
      if (!authRetry && await tryRefreshToken()) {
        return request<T>(path, options, attempt, true);
      }
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
  refreshSession: (refreshToken: string) =>
    request<any>("/auth/refresh", { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) }),
  logout: async () => {
    const refresh = await auth.getRefreshToken();
    if (refresh) {
      try {
        await request("/auth/logout", { method: "POST", body: JSON.stringify({ refresh_token: refresh }) });
      } catch {
        /* ignore */
      }
    }
    await auth.clear();
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    request("/auth/password", {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    }),
  changePin: (currentPin: string, newPin: string) =>
    request("/auth/pin", {
      method: "PUT",
      body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
    }),
  deleteAccount: (password: string) =>
    request("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),

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
  createWallet: async (name: string, walletType: string, currency = "TRY") => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const payload = { name, wallet_type: walletType, currency };
    try {
      return await request("/wallets/", { method: "POST", body: JSON.stringify(payload) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "wallet_create", payload });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  updateWallet: async (id: string, data: { name?: string; wallet_type?: string; currency?: string }) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/wallets/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "wallet_update", payload: { wallet_id: id, ...data } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  deleteWallet: async (id: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/wallets/${id}`, { method: "DELETE" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "wallet_delete", payload: { wallet_id: id } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  transfer: async (fromId: string, toId: string, amount: number, description = "") => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request("/wallets/transfer", {
        method: "POST",
        body: JSON.stringify({ from_wallet_id: fromId, to_wallet_id: toId, amount, description }),
      });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({
          type: "wallet_transfer",
          payload: { from_wallet_id: fromId, to_wallet_id: toId, amount, description },
        });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  addIncome: async (walletId: string, amount: number, description = "") => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(
        `/wallets/income?wallet_id=${walletId}&amount=${amount}&description=${encodeURIComponent(description)}`,
        { method: "POST" },
      );
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({
          type: "wallet_income",
          payload: { wallet_id: walletId, amount, description },
        });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },

  // Transactions
  getTransactions: (limit = 50) => request<any[]>(`/transactions/?limit=${limit}`),
  updateTransaction: async (id: string, data: { amount?: number; category?: string; description?: string; place?: string }) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/transactions/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "transaction_update", payload: { transaction_id: id, ...data } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  deleteTransaction: async (id: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/transactions/${id}`, { method: "DELETE" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "transaction_delete", payload: { transaction_id: id } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },

  // Agenda
  getAgenda: (days = 30) => request<any[]>(`/agenda/?days=${days}`),
  getAgendaHistory: (limit = 50) => request<any[]>(`/agenda/history?limit=${limit}`),
  updateAgendaItem: async (id: string, data: object) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/agenda/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "agenda_update", payload: { item_id: id, ...data } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  deleteAgendaItem: async (id: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/agenda/${id}`, { method: "DELETE" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "agenda_delete", payload: { item_id: id } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  addBill: async (title: string, amount: number, dueDate: string, force = false, isRecurring = false) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const url = `/agenda/bill?title=${encodeURIComponent(title)}&amount=${amount}&due_date=${dueDate}&force=${force}&is_recurring=${isRecurring}`;
    try {
      return await request<any>(url, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({
          type: "agenda_add_bill",
          payload: { title, amount, due_date: dueDate, force, is_recurring: isRecurring },
        });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  markPaid: async (title: string, walletId?: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const url = `/agenda/pay?title=${encodeURIComponent(title)}${walletId ? `&wallet_id=${walletId}` : ""}`;
    try {
      return await request(url, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "agenda_mark_paid", payload: { title, wallet_id: walletId } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
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
  completeShoppingItem: async (itemId: string, price?: number, walletId?: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    let url = `/shopping/complete/${itemId}`;
    const params = new URLSearchParams();
    if (price) params.set("price", String(price));
    if (walletId) params.set("wallet_id", walletId);
    const qs = params.toString();
    try {
      return await request(`${url}${qs ? `?${qs}` : ""}`, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_complete", payload: { item_id: itemId, price, wallet_id: walletId } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  setRoutine: (itemId: string, isRoutine: boolean, routineType: "daily" | "weekly" = "daily") =>
    request(`/shopping/${itemId}/routine`, {
      method: "PATCH",
      body: JSON.stringify({ is_routine: isRoutine, routine_type: routineType }),
    }),
  deleteShoppingItem: (itemId: string) => request(`/shopping/${itemId}`, { method: "DELETE" }),
  importReceiptToShopping: (receiptId: string, itemNames?: string[]) =>
    request("/shopping/import-receipt", {
      method: "POST",
      body: JSON.stringify({ receipt_id: receiptId, item_names: itemNames }),
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
  getWatchlist: () => request<any[]>("/ai/watchlist"),
  addWatchlistItem: (productName: string, thresholdPercent = 5) =>
    request("/ai/watchlist", {
      method: "POST",
      body: JSON.stringify({ product_name: productName, threshold_percent: thresholdPercent }),
    }),
  removeWatchlistItem: (id: string) => request(`/ai/watchlist/${id}`, { method: "DELETE" }),
  getChatHistory: () => request<any[]>("/ai/chat/history"),
  sendChatMessage: (message: string) =>
    request<any>("/ai/chat", { method: "POST", body: JSON.stringify({ message }) }),

  // Social
  splitBill: (total: number, personCount: number) =>
    request<any>(`/social/split?total=${total}&person_count=${personCount}`, { method: "POST" }),
  addDebt: (personName: string, amount: number, isLent = true) =>
    request(`/social/debt?person_name=${encodeURIComponent(personName)}&amount=${amount}&is_lent=${isLent}`, { method: "POST" }),
  getDebts: () => request<any[]>("/social/debts"),
  settleDebt: (id: string) => request(`/social/debts/${id}/settle`, { method: "POST" }),
  updateDebt: (id: string, data: { person_name?: string; amount?: number; is_lent?: boolean }) => {
    const params = new URLSearchParams();
    if (data.person_name) params.set("person_name", data.person_name);
    if (data.amount != null) params.set("amount", String(data.amount));
    if (data.is_lent != null) params.set("is_lent", String(data.is_lent));
    return request(`/social/debts/${id}?${params}`, { method: "PATCH" });
  },
  deleteDebt: (id: string) => request(`/social/debts/${id}`, { method: "DELETE" }),
  getSharedWallets: () => request<any[]>("/social/shared-wallet"),
  createSharedWallet: (name: string, memberEmail?: string) => {
    let url = `/social/shared-wallet?name=${encodeURIComponent(name)}`;
    if (memberEmail) url += `&member_email=${encodeURIComponent(memberEmail)}`;
    return request(url, { method: "POST" });
  },
  addSharedWalletExpense: (walletId: string, amount: number, description = "") =>
    request(`/social/shared-wallet/${walletId}/expense?amount=${amount}&description=${encodeURIComponent(description)}`, { method: "POST" }),
  addSharedWalletContribution: (walletId: string, amount: number, description = "") =>
    request(`/social/shared-wallet/${walletId}/contribution?amount=${amount}&description=${encodeURIComponent(description)}`, { method: "POST" }),
  getSharedWalletMembers: (walletId: string) => request<any>(`/social/shared-wallet/${walletId}/members`),
  renameSharedWallet: (walletId: string, name: string) =>
    request(`/social/shared-wallet/${walletId}?name=${encodeURIComponent(name)}`, { method: "PATCH" }),
  addSharedWalletMember: (walletId: string, memberEmail: string) =>
    request(`/social/shared-wallet/${walletId}/members?member_email=${encodeURIComponent(memberEmail)}`, { method: "POST" }),
  removeSharedWalletMember: (walletId: string, memberId: string) =>
    request(`/social/shared-wallet/${walletId}/members/${memberId}`, { method: "DELETE" }),
  deleteSharedWallet: (walletId: string) => request(`/social/shared-wallet/${walletId}`, { method: "DELETE" }),

  // Notifications
  registerPushToken: (token: string) =>
    request(`/notifications/register-token?token=${encodeURIComponent(token)}`, { method: "POST" }),
  getNotifications: () => request<any[]>("/notifications/"),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ marked: number }>("/notifications/read-all", { method: "POST" }),

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
  const base = getApiBaseUrl();
  const uri = normalized.startsWith("api/v1/") ? `${base.replace(/\/api\/v1\/?$/, "")}/${normalized}` : `${base}/${normalized}`;
  const token = await auth.getToken();
  return token ? { uri, headers: { Authorization: `Bearer ${token}` } } : { uri };
}
