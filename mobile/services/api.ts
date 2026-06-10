const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `API error: ${res.status}`);
  }
  return res.json();
}

export const api = {
  parseText: (text: string, whisperMode = false) =>
    request(`/input/parse?text=${encodeURIComponent(text)}&whisper_mode=${whisperMode}`, { method: "POST" }),

  executeAction: (userId: string, parsed: object, confirmed: boolean) =>
    request("/execute/confirm", {
      method: "POST",
      body: JSON.stringify({ user_id: userId, parsed, action: { confirmed } }),
    }),

  getNetWorth: (userId: string) =>
    request(`/wallets/net-worth?user_id=${userId}`),

  getWallets: (userId: string) =>
    request(`/wallets/?user_id=${userId}`),

  getAgenda: (userId: string) =>
    request(`/agenda/?user_id=${userId}`),

  getShoppingList: (userId: string) =>
    request(`/shopping/?user_id=${userId}`),

  addShoppingItems: (userId: string, items: string[]) =>
    request(`/shopping/add?user_id=${userId}`, {
      method: "POST",
      body: JSON.stringify(items),
    }),

  completeShoppingItem: (userId: string, itemId: string, price?: number) =>
    request(`/shopping/complete/${itemId}?user_id=${userId}${price ? `&price=${price}` : ""}`, { method: "POST" }),

  getBudgetAlerts: (userId: string) =>
    request(`/ai/budget-alerts?user_id=${userId}`),

  getForecast: (userId: string, balance: number) =>
    request(`/ai/forecast?user_id=${userId}&current_balance=${balance}`),

  autocomplete: (query: string) =>
    request(`/input/autocomplete?query=${encodeURIComponent(query)}`),
};
