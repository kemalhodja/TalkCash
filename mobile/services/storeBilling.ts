import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { PlanKey, refreshPremiumStatus } from "./premium";

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

let connectionReady = false;

function getIapModule(): typeof import("react-native-iap") | null {
  if (Platform.OS !== "android" && Platform.OS !== "ios") return null;
  if (Constants.appOwnership === "expo") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-iap");
  } catch {
    return null;
  }
}

function skuToPlan(sku: string): StorePlanPrice | null {
  for (const [plan, periods] of Object.entries(PLAN_SKUS) as [Exclude<PlanKey, "free">, Record<BillingPeriod, SubscriptionSku>][]) {
    for (const [period, productId] of Object.entries(periods) as [BillingPeriod, SubscriptionSku][]) {
      if (productId === sku) {
        return { plan, period, productId, localizedPrice: "" };
      }
    }
  }
  return null;
}

function purchaseProof(purchase: any): { productId: string; token: string; transactionId?: string } {
  const productId = purchase.productId as string;
  if (Platform.OS === "ios") {
    const token =
      purchase.transactionReceipt
      || purchase.purchaseToken
      || purchase.transactionId
      || "";
    return { productId, token, transactionId: purchase.transactionId };
  }
  return { productId, token: purchase.purchaseToken || "" };
}

async function verifyPurchaseWithBackend(purchase: any): Promise<void> {
  const { productId, token, transactionId } = purchaseProof(purchase);
  if (!token) throw new Error("Missing purchase token");
  if (Platform.OS === "ios") {
    await api.verifyApplePurchase(productId, token, transactionId);
  } else {
    await api.verifyGooglePurchase(productId, token);
  }
}

export function isStoreBillingSupported(): boolean {
  return getIapModule() !== null;
}

export async function initStoreBilling(): Promise<boolean> {
  const iap = getIapModule();
  if (!iap) return false;
  if (connectionReady) return true;
  try {
    await iap.initConnection();
    connectionReady = true;
    return true;
  } catch {
    return false;
  }
}

export async function getStorePlanPrices(): Promise<StorePlanPrice[]> {
  const iap = getIapModule();
  if (!iap) return [];
  const ready = await initStoreBilling();
  if (!ready) return [];

  try {
    const subs = await iap.getSubscriptions({ skus: [...SUBSCRIPTION_SKUS] });
    return subs
      .map((item) => {
        const base = skuToPlan(item.productId);
        if (!base) return null;
        const androidOffer = "subscriptionOfferDetails" in item ? item.subscriptionOfferDetails?.[0] : undefined;
        const localizedPrice =
          ("localizedPrice" in item && item.localizedPrice)
          || androidOffer?.pricingPhases?.pricingPhaseList?.[0]?.formattedPrice
          || "";
        if (!localizedPrice) return null;
        return { ...base, localizedPrice };
      })
      .filter((row): row is StorePlanPrice => !!row);
  } catch {
    return [];
  }
}

export async function purchaseSubscription(
  plan: Exclude<PlanKey, "free">,
  period: BillingPeriod = "yearly",
): Promise<void> {
  const iap = getIapModule();
  if (!iap) throw new Error("Store billing unavailable");

  const sku = PLAN_SKUS[plan][period];
  const ready = await initStoreBilling();
  if (!ready) throw new Error("Store billing unavailable");

  const purchaseResult = await iap.requestSubscription({ sku });
  const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;
  if (!purchase) throw new Error("Purchase cancelled");

  await verifyPurchaseWithBackend(purchase);
  await iap.finishTransaction({ purchase, isConsumable: false });
  await refreshPremiumStatus();
}

export async function restoreSubscriptions(): Promise<void> {
  const iap = getIapModule();
  if (!iap) throw new Error("Store billing unavailable");

  const ready = await initStoreBilling();
  if (!ready) throw new Error("Store billing unavailable");

  const purchases = await iap.getAvailablePurchases();
  const active = purchases
    .filter((item) => {
      if (!SUBSCRIPTION_SKUS.includes(item.productId as SubscriptionSku)) return false;
      const proof = purchaseProof(item);
      return Boolean(proof.token);
    })
    .sort((a, b) => (b.transactionDate || 0) - (a.transactionDate || 0));

  if (!active.length) {
    throw new Error("No active subscriptions");
  }

  await verifyPurchaseWithBackend(active[0]);
  await refreshPremiumStatus();
}
