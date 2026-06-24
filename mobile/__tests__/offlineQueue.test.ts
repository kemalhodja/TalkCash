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
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/services/api";
import { enqueue, flushQueue, getPendingCount, shouldQueueError } from "@/services/offlineQueue";

describe("offlineQueue", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.removeItem("talkcash_offline_queue");
  });

  it("shouldQueueError queues network and 5xx errors", () => {
    expect(shouldQueueError({ status: 0 })).toBe(true);
    expect(shouldQueueError({ status: 503 })).toBe(true);
    expect(shouldQueueError({ status: 400 })).toBe(false);
    expect(shouldQueueError({ status: 401 })).toBe(false);
  });

  it("flushQueue keeps queue when syncPush fails", async () => {
    (api.syncPush as jest.Mock).mockRejectedValue(new Error("network"));
    await enqueue({ type: "shopping_add", payload: { items: ["milk"] } });
    expect(await getPendingCount()).toBe(1);

    const result = await flushQueue();
    expect(result.failed).toBeGreaterThan(0);
    expect(await getPendingCount()).toBe(1);
  });

  it("queues micro_savings_transfer operations", async () => {
    await enqueue({
      type: "micro_savings_transfer",
      payload: {
        from_wallet_id: "cash-id",
        to_wallet_id: "gold-id",
        amount: 47,
        rule_key: "coffee",
      },
    });
    expect(await getPendingCount()).toBe(1);
  });
});
