import type { PlanKey } from "@/services/premium";

export type BillingPeriod = "monthly" | "yearly";

export const SUBSCRIPTION_SKUS = [
  "talkcash_pro_monthly",
  "talkcash_pro_yearly",
  "talkcash_family_monthly",
  "talkcash_family_yearly",
  "talkcash_business_monthly",
  "talkcash_business_yearly",
] as const;

export type SubscriptionSku = (typeof SUBSCRIPTION_SKUS)[number];

export const PLAN_SKUS: Record<Exclude<PlanKey, "free">, Record<BillingPeriod, SubscriptionSku>> = {
  pro: {
    monthly: "talkcash_pro_monthly",
    yearly: "talkcash_pro_yearly",
  },
  family: {
    monthly: "talkcash_family_monthly",
    yearly: "talkcash_family_yearly",
  },
  business: {
    monthly: "talkcash_business_monthly",
    yearly: "talkcash_business_yearly",
  },
};

/** @deprecated use PLAN_SKUS */
export const PLAN_TO_SKU: Record<Exclude<PlanKey, "free">, SubscriptionSku> = {
  pro: PLAN_SKUS.pro.monthly,
  family: PLAN_SKUS.family.monthly,
  business: PLAN_SKUS.business.monthly,
};

export type StorePlanPrice = {
  plan: Exclude<PlanKey, "free">;
  period: BillingPeriod;
  productId: string;
  localizedPrice: string;
};
