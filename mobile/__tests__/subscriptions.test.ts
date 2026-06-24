import { extractUpcomingSubscriptions, getSubscriptionCancelUrl } from "@/utils/subscriptions";

describe("subscriptions utils", () => {
  it("extracts upcoming recurring transactions", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const items = extractUpcomingSubscriptions([
      { is_recurring: true, subscription_name: "Netflix", next_billing_date: future.toISOString(), amount: 150 },
      { is_recurring: false, subscription_name: "X", next_billing_date: future.toISOString(), amount: 1 },
    ]);
    expect(items).toHaveLength(1);
    expect(items[0].subscription_name).toBe("Netflix");
  });

  it("returns cancel url for known providers", () => {
    expect(getSubscriptionCancelUrl("Netflix")).toContain("netflix");
    expect(getSubscriptionCancelUrl("Unknown")).toBeNull();
  });
});
