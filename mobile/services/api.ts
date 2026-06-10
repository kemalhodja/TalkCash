import * as SecureStore from "expo-secure-store";
import { auth } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const LOCALE_KEY = "talkcash_locale";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
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

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = typeof err.detail === "string" ? err.detail : `API error: ${res.status}`;
    throw new ApiError(detail, res.status);
  }
  if (res.headers.get("content-type")?.includes("application/json")) {
    return res.json();
  }
  return res.blob() as unknown as T;
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
  getMe: () => request<any>("/auth/me"),

  // Input
  parseText: (text: string, whisperMode = false) =>
    request<any>(`/input/parse?text=${encodeURIComponent(text)}&whisper_mode=${whisperMode}`, { method: "POST" }),
  parseVoice: async (uri: string, whisperMode = false) => {
    const form = new FormData();
    form.append("audio", { uri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/voice?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },
  executeAction: (parsed: object, confirmed: boolean) =>
    request("/execute/confirm", { method: "POST", body: JSON.stringify({ parsed, action: { confirmed } }) }),
  autocomplete: (query: string) => request<any>(`/input/autocomplete?query=${encodeURIComponent(query)}`),

  // Wallets
  getNetWorth: () => request<any>("/wallets/net-worth"),
  getWallets: () => request<any[]>("/wallets/"),
  createWallet: (name: string, walletType: string, currency = "TRY") =>
    request("/wallets/", { method: "POST", body: JSON.stringify({ name, wallet_type: walletType, currency }) }),
  transfer: (fromId: string, toId: string, amount: number, description = "") =>
    request("/wallets/transfer", { method: "POST", body: JSON.stringify({ from_wallet_id: fromId, to_wallet_id: toId, amount, description }) }),

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
  addShoppingItems: (items: string[]) =>
    request("/shopping/add", { method: "POST", body: JSON.stringify({ items }) }),
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
  verifyReceipt: (receiptAmount: number, transactionAmount: number) =>
    request<{ verified: boolean }>(
      `/ocr/verify?receipt_amount=${receiptAmount}&transaction_amount=${transactionAmount}`,
      { method: "POST" },
    ),

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
};
