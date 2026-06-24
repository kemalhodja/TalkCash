import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { getAppEnv } from "./config";

const PREMIUM_STATUS_KEY = "talkcash_premium_status";

export type PlanKey = "free" | "pro" | "family" | "business";

export type EntitlementStatus = {
  enabled: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
};

export type PremiumStatus = {
  plan: PlanKey;
  status: "inactive" | "active" | "trialing" | "canceled" | "expired" | "grace_period" | "past_due";
  is_premium?: boolean;
  entitlements: Record<string, EntitlementStatus>;
};

export const FREE_STATUS: PremiumStatus = {
  plan: "free",
  status: "inactive",
  is_premium: false,
  entitlements: {
    basic_finance: { enabled: true, limit: null, used: 0, remaining: null },
    receipt_ocr: { enabled: true, limit: 5, used: 0, remaining: 5 },
    ai_coach: { enabled: true, limit: 10, used: 0, remaining: 10 },
    advanced_reports: { enabled: false, limit: 0, used: 0, remaining: 0 },
    shared_workspace: { enabled: false, limit: 0, used: 0, remaining: 0 },
    price_watch: { enabled: true, limit: 3, used: 0, remaining: 3 },
    swap_nudges: { enabled: true, limit: 3, used: 0, remaining: 3 },
    portfolio_coach: { enabled: false, limit: 0, used: 0, remaining: 0 },
  },
};

export async function getPremiumStatus(force = false): Promise<PremiumStatus> {
  if (!force) {
    const cached = await AsyncStorage.getItem(PREMIUM_STATUS_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        await AsyncStorage.removeItem(PREMIUM_STATUS_KEY);
      }
    }
  }
  try {
    const status = await api.getPremiumStatus();
    await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(status));
    return status;
  } catch {
    return FREE_STATUS;
  }
}

export async function refreshPremiumStatus(): Promise<PremiumStatus> {
  return getPremiumStatus(true);
}

export function hasEntitlement(status: PremiumStatus | null, key: string): boolean {
  const ent = status?.entitlements?.[key];
  return !!ent?.enabled && (ent.limit == null || ent.remaining == null || ent.remaining > 0);
}

export function canUseInternalUpgrade(): boolean {
  if (__DEV__) return true;
  const env = getAppEnv();
  return env === "development" || env === "staging";
}

export async function upgradeInternalPlan(plan: PlanKey): Promise<PremiumStatus> {
  const res = await api.upgradeInternalPlan(plan);
  const status = res.status as PremiumStatus;
  await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(status));
  return status;
}
