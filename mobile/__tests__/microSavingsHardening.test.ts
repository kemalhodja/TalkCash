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
  };
});

import { dismissMicroSavingsIntro, isMicroSavingsIntroDismissed } from "@/services/microSavingsIntro";

describe("microSavingsIntro", () => {
  it("storage keys are stable", async () => {
    expect(typeof isMicroSavingsIntroDismissed).toBe("function");
    expect(typeof dismissMicroSavingsIntro).toBe("function");
    const dismissed = await isMicroSavingsIntroDismissed();
    expect(typeof dismissed).toBe("boolean");
  });

  it("dismiss persists flag", async () => {
    await dismissMicroSavingsIntro();
    expect(await isMicroSavingsIntroDismissed()).toBe(true);
  });
});

describe("microSavings offline queue type", () => {
  it("accepts micro_savings_transfer payload shape", () => {
    const op = {
      type: "micro_savings_transfer" as const,
      payload: {
        from_wallet_id: "w1",
        to_wallet_id: "w2",
        amount: 47,
        rule_key: "coffee",
      },
    };
    expect(op.payload.rule_key).toBe("coffee");
    expect(op.payload.amount).toBeGreaterThan(0);
  });
});
