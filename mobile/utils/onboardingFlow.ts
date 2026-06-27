/** Onboarding flow helpers (testable). */
export type OnboardingVariant = "short" | "full";

export function getOnboardingLastStep(variant: OnboardingVariant): number {
  return variant === "short" ? 2 : 4;
}

export function isOnboardingPinStep(variant: OnboardingVariant, step: number): boolean {
  return variant === "full" && step === 4;
}

export function getOnboardingPrimaryLabel(
  variant: OnboardingVariant,
  step: number,
  labels: { next: string; start: string },
): string {
  return step >= getOnboardingLastStep(variant) ? labels.start : labels.next;
}
