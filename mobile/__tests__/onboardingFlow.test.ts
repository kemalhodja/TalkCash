import {
  getOnboardingLastStep,
  getOnboardingPrimaryLabel,
  isOnboardingPinStep,
} from "@/utils/onboardingFlow";

describe("onboardingFlow", () => {
  it("short variant ends at step 2", () => {
    expect(getOnboardingLastStep("short")).toBe(2);
    expect(getOnboardingPrimaryLabel("short", 2, { next: "Next", start: "Start" })).toBe("Start");
    expect(getOnboardingPrimaryLabel("short", 1, { next: "Next", start: "Start" })).toBe("Next");
    expect(isOnboardingPinStep("short", 4)).toBe(false);
  });

  it("full variant ends at step 4 with pin step", () => {
    expect(getOnboardingLastStep("full")).toBe(4);
    expect(isOnboardingPinStep("full", 4)).toBe(true);
    expect(isOnboardingPinStep("full", 3)).toBe(false);
  });
});
