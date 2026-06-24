jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  };
});

jest.mock("@/services/api", () => ({
  api: { syncPull: jest.fn() },
}));

import {
  applyOptimisticForQueuedOp,
  getCachedSnapshot,
  patchCachedSnapshot,
} from "@/services/syncCache";

describe("syncCache optimistic", () => {
  beforeEach(async () => {
    await patchCachedSnapshot({
      shopping: [{ id: "s1", name: "Süt", category: "DAIRY" }],
      wallets: [{ id: "w1", name: "Banka", balance_try: 1000 }],
      net_worth_total: 1000,
      agenda: [{ id: "a1", title: "Elektrik", amount: 200, status: "pending" }],
      transactions: [{ id: "t1", amount: 50, category: "Market" }],
    });
  });

  it("adds shopping items with client ids", async () => {
    await applyOptimisticForQueuedOp("shopping_add", {
      items: ["Ekmek"],
      client_item_ids: ["client-shop-1"],
    });
    const snap = await getCachedSnapshot();
    expect(snap?.shopping?.some((i) => i.id === "client-shop-1" && i.name === "Ekmek")).toBe(true);
  });

  it("applies budget create optimistically", async () => {
    await applyOptimisticForQueuedOp("budget_create", {
      category: "Market",
      monthly_limit: 2000,
      client_budget_id: "client-budget-1",
    });
    const snap = await getCachedSnapshot();
    expect(snap?.budgets?.some((b) => b.id === "client-budget-1" && b.category === "Market")).toBe(true);
  });

  it("removes completed shopping item", async () => {
    await applyOptimisticForQueuedOp("shopping_complete", { item_id: "s1" });
    const snap = await getCachedSnapshot();
    expect(snap?.shopping?.length).toBe(0);
  });

  it("deletes shopping item optimistically", async () => {
    await applyOptimisticForQueuedOp("shopping_delete", { item_id: "s1" });
    const snap = await getCachedSnapshot();
    expect(snap?.shopping?.length).toBe(0);
  });

  it("updates shopping routine optimistically", async () => {
    await applyOptimisticForQueuedOp("shopping_routine", {
      item_id: "s1",
      is_routine: true,
      routine_type: "weekly",
    });
    const snap = await getCachedSnapshot();
    expect(snap?.shopping?.[0].is_routine).toBe(true);
    expect(snap?.shopping?.[0].routine_type).toBe("weekly");
  });

  it("adjusts wallet income optimistically", async () => {
    await applyOptimisticForQueuedOp("wallet_income", { wallet_id: "w1", amount: 500 });
    const snap = await getCachedSnapshot();
    expect(snap?.wallets?.[0].balance_try).toBe(1500);
    expect(snap?.net_worth_total).toBe(1500);
  });

  it("marks agenda bill paid", async () => {
    await applyOptimisticForQueuedOp("agenda_mark_paid", { title: "Elektrik" });
    const snap = await getCachedSnapshot();
    expect(snap?.agenda?.[0].status).toBe("paid");
  });

  it("deducts wallet on shopping complete with price", async () => {
    await applyOptimisticForQueuedOp("shopping_complete", {
      item_id: "s1",
      price: 120,
      wallet_id: "w1",
    });
    const snap = await getCachedSnapshot();
    expect(snap?.shopping?.length).toBe(0);
    expect(snap?.wallets?.[0].balance_try).toBe(880);
    expect(snap?.net_worth_total).toBe(880);
  });

  it("applies execute add_expense optimistically", async () => {
    await applyOptimisticForQueuedOp("execute", {
      parsed: { intent: "add_expense", amount: 75, wallet_name: "Banka", category: "Market", description: "Kahve" },
    });
    const snap = await getCachedSnapshot();
    expect(snap?.transactions?.length).toBe(2);
    expect(snap?.wallets?.[0].balance_try).toBe(925);
    expect(snap?.net_worth_total).toBe(925);
  });
});
