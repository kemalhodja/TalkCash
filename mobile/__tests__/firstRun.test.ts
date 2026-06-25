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
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  };
});

import {
  consumePendingDemoOffer,
  getCoachStep,
  hasAddedFirstExpense,
  isSimpleHomeMode,
  isSimpleInputMode,
  markCoachDone,
  markFirstExpenseAdded,
  setCoachStep,
  setPendingDemoOffer,
  setSimpleHomeMode,
  setSimpleInputMode,
} from "@/services/firstRun";

describe("firstRun service", () => {
  it("defaults to simple modes before first expense", async () => {
    expect(await isSimpleHomeMode()).toBe(true);
    expect(await isSimpleInputMode()).toBe(true);
    expect(await hasAddedFirstExpense()).toBe(false);
  });

  it("tracks first expense and coach step", async () => {
    await markFirstExpenseAdded();
    expect(await hasAddedFirstExpense()).toBe(true);
    await setCoachStep(2);
    expect(await getCoachStep()).toBe(2);
    await markCoachDone();
    expect(await isSimpleHomeMode()).toBe(false);
  });

  it("persists simple mode toggles", async () => {
    await setSimpleHomeMode(false);
    await setSimpleInputMode(false);
    expect(await isSimpleHomeMode()).toBe(false);
    expect(await isSimpleInputMode()).toBe(false);
  });

  it("consumes pending demo offer once after register", async () => {
    await setPendingDemoOffer();
    expect(await consumePendingDemoOffer()).toBe(true);
    expect(await consumePendingDemoOffer()).toBe(false);
  });
});
