jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    multiRemove: jest.fn((keys: string[]) => {
      keys.forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  };
});

jest.mock("@/services/api", () => ({
  api: {
    syncPush: jest.fn(),
  },
}));

jest.mock("@/services/syncCache", () => ({
  applyOptimisticForQueuedOp: jest.fn().mockResolvedValue(undefined),
  getCachedSnapshot: jest.fn().mockResolvedValue({
    wallets: [{ id: "local-wallet", name: "Nakit", balance_try: 0 }],
  }),
  patchCachedSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { api } from "@/services/api";
import { enqueue, flushQueue, getPendingCount } from "@/services/offlineQueue";
import { getIdMap } from "@/services/idRemap";

describe("offline integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("remaps chained wallet ops after sync push", async () => {
    const clientWalletId = "aaaaaaaa-bbbb-4ccc-yddd-eeeeeeeeeeee";
    await enqueue({
      type: "wallet_create",
      payload: {
        name: "Test",
        wallet_type: "cash",
        currency: "TRY",
        client_wallet_id: clientWalletId,
      },
    });
    await enqueue({
      type: "wallet_income",
      payload: { wallet_id: clientWalletId, amount: 100, description: "Maas" },
    });

    (api.syncPush as jest.Mock).mockImplementationOnce(async (batch: { id: string }[]) => ({
      applied: batch.map((op, index) => ({
        operation_id: op.id,
        status: "ok",
        result: index === 0
          ? { wallet_id: "server-wallet-uuid" }
          : { transaction_id: "tx-1" },
      })),
      conflicts: [],
      failed: [],
    }));

    const result = await flushQueue();
    expect(result.applied).toBeGreaterThan(0);
    expect(await getPendingCount()).toBe(0);

    const map = await getIdMap();
    expect(map[clientWalletId]).toBe("server-wallet-uuid");
  });

  it("preserves queue when sync push fails", async () => {
    await enqueue({ type: "shopping_add", payload: { items: ["sut"], client_item_ids: ["item-1"] } });
    (api.syncPush as jest.Mock).mockRejectedValueOnce(new Error("network"));

    await flushQueue();
    expect(await getPendingCount()).toBe(1);
    expect(api.syncPush).toHaveBeenCalledTimes(1);
  });
});
