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

jest.mock("@/services/offlineQueue", () => ({
  getQueue: jest.fn().mockResolvedValue([]),
  replaceQueue: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/services/syncCache", () => ({
  getCachedSnapshot: jest.fn().mockResolvedValue({
    wallets: [{ id: "local-wallet", name: "Nakit", balance_try: 0 }],
  }),
  patchCachedSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { getCachedSnapshot, patchCachedSnapshot } from "@/services/syncCache";
import {
  getIdMap,
  registerMapping,
  remapPayload,
  remapSnapshotWithMap,
} from "@/services/idRemap";

describe("idRemap", () => {
  it("remaps wallet ids in payloads", () => {
    const map = { "local-wallet": "server-wallet-1" };
    expect(
      remapPayload("wallet_income", { wallet_id: "local-wallet", amount: 50 }, map).wallet_id,
    ).toBe("server-wallet-1");
  });

  it("registers mapping and rewrites snapshot", async () => {
    await registerMapping("local-wallet", "server-wallet-1");
    const map = await getIdMap();
    expect(map["local-wallet"]).toBe("server-wallet-1");

    await remapSnapshotWithMap(map);
    expect(patchCachedSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        wallets: [expect.objectContaining({ id: "server-wallet-1" })],
      }),
    );
  });
});
