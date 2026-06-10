import { auth } from "./auth";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await auth.getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!(options?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(err.detail || `API error: ${res.status}`, res.status);
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

  setPin: (pin: string) =>
    request("/auth/pin", { method: "POST", body: JSON.stringify({ pin }) }),

  verifyPin: (pin: string) =>
    request("/auth/pin/verify", { method: "POST", body: JSON.stringify({ pin }) }),

  toggleBiometric: (enabled: boolean) =>
    request(`/auth/biometric?enabled=${enabled}`, { method: "POST" }),

  // Input
  parseText: (text: string, whisperMode = false) =>
    request<any>(`/input/parse?text=${encodeURIComponent(text)}&whisper_mode=${whisperMode}`, { method: "POST" }),

  parseVoice: async (uri: string, whisperMode = false) => {
    const form = new FormData();
    form.append("audio", { uri, type: "audio/m4a", name: "recording.m4a" } as any);
    return request<any>(`/input/voice?whisper_mode=${whisperMode}`, { method: "POST", body: form });
  },

  executeAction: (userId: string, parsed: object, confirmed: boolean) =>
    request("/execute/confirm", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, parsed, action: { confirmed } }),
    }),

  autocomplete: (query: string) =>
    request<any>(`/input/autocomplete?query=${encodeURIComponent(query)}`),

  // Wallets
  getNetWorth: (userId: string) => request<any>(`/wallets/net-worth?user_id=${userId}`),
  getWallets: (userId: string) => request<any[]>(`/wallets/?user_id=${userId}`),

  // Agenda
  getAgenda: (userId: string) => request<any[]>(`/agenda/?user_id=${userId}`),

  addBill: (userId: string, title: string, amount: number, dueDate: string, force = false) =>
    request<any>(`/agenda/bill?user_id=${userId}&title=${encodeURIComponent(title)}&amount=${amount}&due_date=${dueDate}&force=${force}`, { method: "POST" }),

  markPaid: (userId: string, title: string, walletId?: string) =>
    request(`/agenda/pay?user_id=${userId}&title=${encodeURIComponent(title)}${walletId ? `&wallet_id=${walletId}` : ""}`, { method: "POST" }),

  // Shopping
  getShoppingList: (userId: string) => request<any>(`/shopping/?user_id=${userId}`),

  addShoppingItems: (userId: string, items: string[]) =>
    request(`/shopping/add?user_id=${userId}`, { method: "POST", body: JSON.stringify(items) }),

  completeShoppingItem: (userId: string, itemId: string, price?: number, walletId?: string) => {
    let url = `/shopping/complete/${itemId}?user_id=${userId}`;
    if (price) url += `&price=${price}`;
    if (walletId) url += `&wallet_id=${walletId}`;
    return request(url, { method: "POST" });
  },

  // OCR
  scanReceipt: async (uri: string, userId: string) => {
    const form = new FormData();
    form.append("image", { uri, type: "image/jpeg", name: "receipt.jpg" } as any);
    return request<any>(`/ocr/scan?user_id=${userId}`, { method: "POST", body: form });
  },

  // AI
  getBudgetAlerts: (userId: string) => request<any[]>(`/ai/budget-alerts?user_id=${userId}`),
  getForecast: (userId: string, balance: number) => request<any>(`/ai/forecast?user_id=${userId}&current_balance=${balance}`),

  // Social
  splitBill: (total: number, personCount: number) =>
    request<any>(`/social/split?total=${total}&person_count=${personCount}`, { method: "POST" }),

  addDebt: (personName: string, amount: number, isLent = true) =>
    request(`/social/debt?person_name=${encodeURIComponent(personName)}&amount=${amount}&is_lent=${isLent}`, { method: "POST" }),

  getSharedWallets: () => request<any[]>("/social/shared-wallet"),

  // Notifications
  registerPushToken: (token: string) =>
    request(`/notifications/register-token?token=${encodeURIComponent(token)}`, { method: "POST" }),

  // Export
  exportPdf: () => request<Blob>("/export/pdf"),
  exportExcel: () => request<Blob>("/export/excel"),
};

export { ApiError };
