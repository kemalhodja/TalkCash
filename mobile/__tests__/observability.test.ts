import { setObservabilityUser, captureError } from "@/services/observability";

describe("observability", () => {
  it("setObservabilityUser runs without Sentry in tests", () => {
    expect(() => setObservabilityUser({ id: "u1", name: "Test" })).not.toThrow();
    expect(() => setObservabilityUser(null)).not.toThrow();
  });

  it("captureError accepts context", () => {
    expect(() => captureError(new Error("x"), { path: "/wallets" })).not.toThrow();
  });
});
