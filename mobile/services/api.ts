import * as SecureStore from "@/services/secureStorage";
import { auth } from "./auth";
import { getApiBaseUrl } from "./config";
import { captureError } from "./observability";

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
    if (typeof detail === "object" && detail !== null && "code" in detail) {
      const code = String((detail as { code: string }).code);
      if (code === "premium_required") return "Premium plan required";
      return code;
    }
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String((item as { msg: string }).msg) : String(item)))
        .join(", ");
    }
  }
  return `API error: ${status}`;
}

async function handleUnauthorized(): Promise<void> {
  await auth.clear({ preserveOffline: true });
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

/** 401 on these routes means wrong PIN/password — not an expired session. */
function isCredential401(path: string, method?: string): boolean {
  if (path === "/auth/pin/verify") return true;
  if (path === "/auth/pin" && method === "DELETE") return true;
  if (path === "/auth/pin" && method === "PUT") return true;
  if (path === "/auth/password" && method === "PUT") return true;
  return false;
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
      if (isCredential401(path, options?.method) && authRetry) {
        const errBody = await res.json().catch(() => ({}));
        throw new ApiError(parseErrorDetail(errBody, 401), 401);
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
      if (res.status >= 500) {
        captureError(new ApiError(detail, res.status), { path, status: res.status });
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
  setAssistantPersona: (assistant_persona: "default" | "angry_mom" | "street_smart" | "wall_street" | "zen_guru") =>
    request<{ assistant_persona: string }>("/auth/persona", {
      method: "PUT",
      body: JSON.stringify({ assistant_persona }),
    }),
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
  removePin: (pin: string) =>
    request("/auth/pin", { method: "DELETE", body: JSON.stringify({ pin }) }),
  deleteAccount: (password: string) =>
    request("/auth/me", { method: "DELETE", body: JSON.stringify({ password }) }),
  forgotPassword: (email: string) =>
    request<{ status: string; message: string; reset_token?: string; email_sent?: boolean }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, newPassword: string) =>
    request<{ status: string; message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    }),

  // Premium / billing
  getPremiumStatus: () => request<any>("/billing/me"),
  upgradeInternalPlan: (plan: "free" | "pro" | "family" | "business") => {
    const headers: Record<string, string> = {};
    const secret = process.env.EXPO_PUBLIC_INTERNAL_UPGRADE_SECRET;
    if (secret) headers["X-Internal-Upgrade-Secret"] = secret;
    return request<any>("/billing/internal-upgrade", {
      method: "POST",
      body: JSON.stringify({ plan }),
      headers,
    });
  },
  verifyGooglePurchase: (productId: string, purchaseToken: string) =>
    request<any>("/billing/google/verify", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, purchase_token: purchaseToken }),
    }),
  verifyApplePurchase: (productId: string, receiptData: string, transactionId?: string) =>
    request<any>("/billing/apple/verify", {
      method: "POST",
      body: JSON.stringify({
        product_id: productId,
        receipt_data: receiptData,
        transaction_id: transactionId,
      }),
    }),
  getBillingProducts: () => request<any>("/billing/products"),

  // Input
  parseText: (text: string, whisperMode = false) =>
    request<any>(`/input/parse?text=${encodeURIComponent(text)}&whisper_mode=${whisperMode}`, { method: "POST" }),
  parseSlash: (command: string) =>
    request<any>(`/input/slash?command=${encodeURIComponent(command)}`, { method: "POST" }),
  parseSms: (text: string) =>
    request<any>("/input/parse-sms", { method: "POST", body: JSON.stringify({ text }) }),
  parseVoice: async (uri: string, whisperMode = false) => {
    const { prepareVoiceUploadUri } = await import("@/utils/voiceRecording");
    const uploadUri = await prepareVoiceUploadUri(uri);
    const form = new FormData();
    form.append("audio", { uri: uploadUri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/voice?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },
  transcribeVoice: async (uri: string, whisperMode = false) => {
    const { prepareVoiceUploadUri } = await import("@/utils/voiceRecording");
    const uploadUri = await prepareVoiceUploadUri(uri);
    const form = new FormData();
    form.append("audio", { uri: uploadUri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/transcribe?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },
  processPremiumVoice: async (uri: string, whisperMode = false) => {
    const { prepareVoiceUploadUri } = await import("@/utils/voiceRecording");
    const uploadUri = await prepareVoiceUploadUri(uri);
    const form = new FormData();
    form.append("audio", { uri: uploadUri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/process-voice?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },
  quickVoice: async (uri: string) => {
    const { prepareVoiceUploadUri } = await import("@/utils/voiceRecording");
    const uploadUri = await prepareVoiceUploadUri(uri);
    const form = new FormData();
    form.append("audio", { uri: uploadUri, type: "audio/m4a", name: "quick.m4a" } as any);
    return request<any>("/input/quick-voice", { method: "POST", body: form });
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
    const { newClientId } = await import("@/utils/clientId");
    const client_wallet_id = newClientId();
    const payload = { name, wallet_type: walletType, currency, client_wallet_id };
    try {
      return await request("/wallets/", { method: "POST", body: JSON.stringify(payload) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "wallet_create", payload });
        return { status: "queued", operation_id: id, client_wallet_id };
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
  getTransactions: (limit = 50, filters?: { category?: string; search?: string; fromDate?: string; toDate?: string }) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (filters?.category) params.set("category", filters.category);
    if (filters?.search) params.set("search", filters.search);
    if (filters?.fromDate) params.set("from_date", filters.fromDate);
    if (filters?.toDate) params.set("to_date", filters.toDate);
    return request<any[]>(`/transactions/?${params.toString()}`);
  },
  getUpcomingSubscriptions: () =>
    request<{ subscriptions: Array<{ id: string; subscription_name: string; amount: number; next_billing_date: string; cancel_url?: string | null }> }>(
      "/transactions/subscriptions/upcoming",
    ),
  updateTransaction: async (id: string, data: { amount?: number; category?: string; description?: string; place?: string; store_name?: string }) => {
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
    const { newClientId } = await import("@/utils/clientId");
    const client_item_id = newClientId();
    const url = `/agenda/bill?title=${encodeURIComponent(title)}&amount=${amount}&due_date=${dueDate}&force=${force}&is_recurring=${isRecurring}`;
    try {
      return await request<any>(url, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({
          type: "agenda_add_bill",
          payload: { title, amount, due_date: dueDate, force, is_recurring: isRecurring, client_item_id },
        });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  addTask: async (title: string, dueDate: string, notes?: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const { newClientId } = await import("@/utils/clientId");
    const client_item_id = newClientId();
    const notesParam = notes ? `&notes=${encodeURIComponent(notes)}` : "";
    const url = `/agenda/task?title=${encodeURIComponent(title)}&due_date=${dueDate}${notesParam}`;
    try {
      return await request<any>(url, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({
          type: "agenda_add_task",
          payload: { title, due_date: dueDate, notes, client_item_id },
        });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  completeAgendaItem: async (itemId: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/agenda/${itemId}/complete`, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "agenda_complete", payload: { item_id: itemId } });
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
  addShoppingItems: async (items: string[], skipSuggestion = false) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const { newClientId } = await import("@/utils/clientId");
    const client_item_ids = items.map(() => newClientId());
    try {
      return await request("/shopping/add", {
        method: "POST",
        body: JSON.stringify({ items, skip_suggestion: skipSuggestion }),
      });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_add", payload: { items, client_item_ids } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  completeShoppingItem: async (itemId: string, price?: number, walletId?: string, storeName?: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    let url = `/shopping/complete/${itemId}`;
    const params = new URLSearchParams();
    if (price) params.set("price", String(price));
    if (walletId) params.set("wallet_id", walletId);
    if (storeName) params.set("store_name", storeName);
    const qs = params.toString();
    try {
      return await request(`${url}${qs ? `?${qs}` : ""}`, { method: "POST" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_complete", payload: { item_id: itemId, price, wallet_id: walletId, store_name: storeName } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  setRoutine: async (itemId: string, isRoutine: boolean, routineType: "daily" | "weekly" = "daily") => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const payload = { item_id: itemId, is_routine: isRoutine, routine_type: routineType };
    try {
      return await request(`/shopping/${itemId}/routine`, {
        method: "PATCH",
        body: JSON.stringify({ is_routine: isRoutine, routine_type: routineType }),
      });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_routine", payload });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  deleteShoppingItem: async (itemId: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/shopping/${itemId}`, { method: "DELETE" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "shopping_delete", payload: { item_id: itemId } });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },
  importReceiptToShopping: (receiptId: string, itemNames?: string[]) =>
    request("/shopping/import-receipt", {
      method: "POST",
      body: JSON.stringify({ receipt_id: receiptId, item_names: itemNames }),
    }),
  scanShoppingPhoto: async (uri: string) => {
    const form = new FormData();
    form.append("image", { uri, type: "image/jpeg", name: "basket.jpg" } as any);
    return request<{ items: string[]; count: number }>("/shopping/scan-photo", { method: "POST", body: form });
  },

  // OCR
  scanReceipt: async (uri: string) => {
    const form = new FormData();
    form.append("image", { uri, type: "image/jpeg", name: "receipt.jpg" } as any);
    return request<any>("/ocr/scan", { method: "POST", body: form });
  },
  getReceipts: (filters?: { merchant?: string; verified?: boolean }) => {
    const params = new URLSearchParams();
    if (filters?.merchant) params.set("merchant", filters.merchant);
    if (filters?.verified != null) params.set("verified", String(filters.verified));
    const q = params.toString();
    return request<any[]>(`/ocr/${q ? `?${q}` : ""}`);
  },
  updateReceipt: (id: string, data: { merchant?: string; total_amount?: number; receipt_date?: string }) =>
    request<any>(`/ocr/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteReceipt: (id: string) =>
    request<{ status: string }>(`/ocr/${id}`, { method: "DELETE" }),
  verifyReceipt: (transactionAmount: number, receiptAmount?: number, receiptId?: string) => {
    let url = `/ocr/verify?transaction_amount=${transactionAmount}`;
    if (receiptAmount != null) url += `&receipt_amount=${receiptAmount}`;
    if (receiptId) url += `&receipt_id=${receiptId}`;
    return request<{ verified: boolean; receipt_amount?: number; transaction_amount?: number }>(url, { method: "POST" });
  },
  getInputCapabilities: () => request<any>("/input/capabilities"),
  getLatestPodcast: () => request<any>("/podcast/latest"),

  getNearbyMarkets: (lat: number, lng: number, radiusKm = 2, useOsm = true) =>
    request<{
      markets: { id: string; name: string; chain: string; lat: number; lng: number; distance_km: number; source?: string }[];
      count: number;
      source: string;
    }>(`/geofence/markets?lat=${lat}&lng=${lng}&radius_km=${radiusKm}&use_osm=${useOsm}`),

  // Budgets
  getBudgets: () => request<any[]>("/budgets/"),
  createBudget: async (category: string, monthlyLimit: number) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const { newClientId } = await import("@/utils/clientId");
    const client_budget_id = newClientId();
    const payload = { category, monthly_limit: monthlyLimit, client_budget_id };
    try {
      return await request("/budgets/", { method: "POST", body: JSON.stringify({ category, monthly_limit: monthlyLimit }) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "budget_create", payload });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  updateBudget: async (id: string, monthlyLimit: number, category?: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const payload: Record<string, unknown> = { monthly_limit: monthlyLimit };
    if (category) payload.category = category;
    try {
      return await request(`/budgets/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "budget_update", payload: { budget_id: id, ...payload } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },
  deleteBudget: async (id: string) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    try {
      return await request(`/budgets/${id}`, { method: "DELETE" });
    } catch (err) {
      if (shouldQueueError(err)) {
        const opId = await enqueue({ type: "budget_delete", payload: { budget_id: id } });
        return { status: "queued", operation_id: opId };
      }
      throw err;
    }
  },

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
  getAiInsights: () => request<any[]>("/ai/insights"),
  getInsightsSummary: () => request<any>("/insights/summary"),
  getMicroSavingsSummary: () => request<any>("/micro-savings/summary"),
  getMicroSavingsRates: () => request<any>("/micro-savings/rates"),
  simulateMicroSavings: (body: Record<string, unknown>) =>
    request<any>("/micro-savings/simulate", { method: "POST", body: JSON.stringify(body) }),
  getMicroSavingsPrefs: () => request<any>("/micro-savings/prefs"),
  updateMicroSavingsPrefs: (prefs: Record<string, unknown>) =>
    request<any>("/micro-savings/prefs", { method: "PATCH", body: JSON.stringify(prefs) }),
  getMicroSavingsBrokers: () => request<any>("/micro-savings/brokers"),
  transferMicroSavings: async (
    fromWalletId: string,
    toWalletId: string,
    amount: number,
    ruleKey: string,
  ) => {
    const { enqueue, shouldQueueError } = await import("./offlineQueue");
    const payload = {
      from_wallet_id: fromWalletId,
      to_wallet_id: toWalletId,
      amount,
      rule_key: ruleKey,
    };
    try {
      return await request("/micro-savings/transfer", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (shouldQueueError(err)) {
        const id = await enqueue({ type: "micro_savings_transfer", payload });
        return { status: "queued", operation_id: id };
      }
      throw err;
    }
  },

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
  transferSharedWalletOwnership: (walletId: string, memberId: string) =>
    request(`/social/shared-wallet/${walletId}/transfer?member_id=${memberId}`, { method: "POST" }),
  deleteSharedWallet: (walletId: string) => request(`/social/shared-wallet/${walletId}`, { method: "DELETE" }),

  // Workspaces
  getWorkspaces: () => request<any[]>("/workspaces/"),
  createWorkspace: (name: string, workspaceType: "family" | "business") =>
    request<any>("/workspaces/", { method: "POST", body: JSON.stringify({ name, workspace_type: workspaceType }) }),
  inviteWorkspaceMember: (workspaceId: string, email: string, role: "admin" | "member" | "viewer" = "member") =>
    request<any>(`/workspaces/${workspaceId}/invite`, { method: "POST", body: JSON.stringify({ email, role }) }),
  getWorkspaceInvitations: (workspaceId: string) => request<any[]>(`/workspaces/${workspaceId}/invitations`),
  getWorkspaceInvitationInbox: () => request<any[]>("/workspaces/invitations/inbox"),
  acceptWorkspaceInvitation: (token: string) =>
    request<any>("/workspaces/invitations/accept", { method: "POST", body: JSON.stringify({ token }) }),
  cancelWorkspaceInvitation: (workspaceId: string, invitationId: string) =>
    request<void>(`/workspaces/${workspaceId}/invitations/${invitationId}`, { method: "DELETE" }),
  getWorkspaceBudget: (workspaceId: string) => request<any>(`/workspaces/${workspaceId}/budget`),

  // Analytics
  trackEvent: (eventName: string, properties?: Record<string, unknown>) =>
    request("/analytics/events", { method: "POST", body: JSON.stringify({ event_name: eventName, properties }) }),
  getAnalyticsFunnel: () => request<{ events: Record<string, number>; completed_steps: number; total_steps: number }>("/analytics/funnel"),
  submitFeedback: (data: { message: string; rating?: number; app_version?: string; platform?: string }) =>
    request("/feedback/", { method: "POST", body: JSON.stringify(data) }),

  getBudgetOverruns: () => request<any[]>("/budgets/overruns"),
  getMonthlySummary: () => request<any>("/wallets/monthly-summary"),

  // Notifications
  registerPushToken: (token: string) =>
    request(`/notifications/register-token?token=${encodeURIComponent(token)}`, { method: "POST" }),
  getNotifications: () => request<any[]>("/notifications/"),
  getNotificationPrefs: () => request<any>("/notifications/preferences"),
  updateNotificationPrefs: (prefs: Record<string, boolean | string>) =>
    request<any>("/notifications/preferences", { method: "PATCH", body: JSON.stringify(prefs) }),
  markNotificationRead: (id: string) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request<{ marked: number }>("/notifications/read-all", { method: "POST" }),

  seedDemoData: () => request<{ status: string; transactions?: number }>("/demo/seed", { method: "POST" }),

  // Export
  exportPdf: () => request<Blob>("/export/pdf"),
  exportExcel: () => request<Blob>("/export/excel"),

  // Sync
  syncPush: (operations: object[]) =>
    request<any>("/sync/push", { method: "POST", body: JSON.stringify({ operations }) }),
  syncPull: () => request<any>("/sync/pull"),

  // Roadmap
  getRoadmap: () =>
    request<{
      active: Array<{ id: string; title: string; description: string; status: "active" | "soon" | "backlog"; vote_count: number; is_voted: boolean; sort_order: number }>;
      soon: Array<{ id: string; title: string; description: string; status: "active" | "soon" | "backlog"; vote_count: number; is_voted: boolean; sort_order: number }>;
      backlog: Array<{ id: string; title: string; description: string; status: "active" | "soon" | "backlog"; vote_count: number; is_voted: boolean; sort_order: number }>;
    }>("/roadmap"),
  voteRoadmapFeature: (featureId: string) =>
    request<{ feature_id: string; vote_count: number; is_voted: boolean }>(`/roadmap/${featureId}/vote`, { method: "POST" }),
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
