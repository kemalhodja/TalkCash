import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

export function track(eventName: string, properties?: Record<string, unknown>) {
  api.trackEvent(eventName, properties).catch(() => {});
}

const FUNNEL_PREFIX = "talkcash_funnel_";

export const FUNNEL_STEPS = [
  "register_success",
  "onboarding_completed",
  "first_expense",
  "first_sync",
  "paywall_viewed",
  "premium_upgrade_tapped",
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export async function trackFunnelOnce(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  const key = `${FUNNEL_PREFIX}${eventName}`;
  if ((await AsyncStorage.getItem(key)) === "1") return;
  await AsyncStorage.setItem(key, "1");
  track(eventName, properties);
}

export function trackPaywallView(plan?: string) {
  track("paywall_viewed", { plan: plan || "pro" });
}

export async function trackRegisterSuccess(properties?: Record<string, unknown>) {
  await trackFunnelOnce("register_success", properties);
}

export async function trackOnboardingComplete(properties?: Record<string, unknown>) {
  await trackFunnelOnce("onboarding_completed", properties);
}

export async function trackFirstExpense(properties?: Record<string, unknown>) {
  await trackFunnelOnce("first_expense", properties);
}

export async function trackFirstSync(properties?: Record<string, unknown>) {
  await trackFunnelOnce("first_sync", properties);
}

export async function trackPremiumUpgradeTapped(plan: string, period?: string) {
  await trackFunnelOnce("premium_upgrade_tapped", { plan, period });
}

export async function getLocalFunnelProgress(): Promise<Record<FunnelStep, boolean>> {
  const out = {} as Record<FunnelStep, boolean>;
  await Promise.all(
    FUNNEL_STEPS.map(async (step) => {
      out[step] = (await AsyncStorage.getItem(`${FUNNEL_PREFIX}${step}`)) === "1";
    }),
  );
  return out;
}

export async function getOnboardingVariant(): Promise<"short" | "full"> {
  const stored = await AsyncStorage.getItem("talkcash_onboarding_variant");
  if (stored === "short" || stored === "full") return stored;
  const variant = Math.random() < 0.5 ? "short" : "full";
  await AsyncStorage.setItem("talkcash_onboarding_variant", variant);
  return variant;
}
