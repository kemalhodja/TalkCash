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

jest.mock("@/services/api", () => ({
  api: { trackEvent: jest.fn().mockResolvedValue({ tracked: true }) },
}));

import { trackFunnelOnce, FUNNEL_STEPS } from "@/services/analytics";

describe("analytics funnel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tracks funnel event only once", async () => {
    const { api } = require("@/services/api");
    await trackFunnelOnce("first_expense", { amount: 50 });
    await trackFunnelOnce("first_expense", { amount: 99 });
    expect(api.trackEvent).toHaveBeenCalledTimes(1);
    expect(api.trackEvent).toHaveBeenCalledWith("first_expense", { amount: 50 });
  });

  it("defines six funnel steps", () => {
    expect(FUNNEL_STEPS).toHaveLength(6);
    expect(FUNNEL_STEPS).toContain("register_success");
    expect(FUNNEL_STEPS).toContain("premium_upgrade_tapped");
  });
});
