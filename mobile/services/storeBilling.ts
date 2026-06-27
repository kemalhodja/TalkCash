import { Platform } from "react-native";
import Constants from "expo-constants";
import { api } from "./api";
import { captureError } from "./observability";
import { PlanKey, refreshPremiumStatus } from "./premium";
import {
  BillingPeriod,
  PLAN_SKUS,
  SUBSCRIPTION_SKUS,
  SubscriptionSku,
  StorePlanPrice,
} from "@/constants/billingSkus";

export type { BillingPeriod, StorePlanPrice, SubscriptionSku };
export { PLAN_SKUS, SUBSCRIPTION_SKUS, PLAN_TO_SKU } from "@/constants/billingSkus";

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

async function getRevenueCat() {
  return import("./revenueCat");
}

export function isStoreBillingSupported(): boolean {
  const { isRevenueCatConfigured } = require("./revenueCat") as typeof import("./revenueCat");
  if (isRevenueCatConfigured()) return true;
  return getIapModule() !== null;
}

export async function initStoreBilling(): Promise<boolean> {
  const rc = await getRevenueCat();
  if (rc.isRevenueCatConfigured()) {
    return rc.initRevenueCat();
  }
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
  const rc = await getRevenueCat();
  if (rc.isRevenueCatConfigured()) {
    try {
      const rows = await rc.fetchPaywallOfferings();
      return rows.map(({ plan, period, productId, localizedPrice }) => ({
        plan,
        period,
        productId,
        localizedPrice,
      }));
    } catch {
      return [];
    }
  }
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
  const rc = await getRevenueCat();
  if (rc.isRevenueCatConfigured()) {
    try {
      await rc.purchaseRevenueCatPackage(plan, period);
      await refreshPremiumStatus();
      return;
    } catch (err) {
      if (err instanceof rc.RevenueCatBillingError && err.userCancelled) {
        throw new Error("Purchase cancelled");
      }
      throw err;
    }
  }
  const iap = getIapModule();
  if (!iap) throw new Error("Store billing unavailable");

  const sku = PLAN_SKUS[plan][period];
  const ready = await initStoreBilling();
  if (!ready) throw new Error("Store billing unavailable");

  const purchaseResult = await iap.requestSubscription({ sku });
  const purchase = Array.isArray(purchaseResult) ? purchaseResult[0] : purchaseResult;
  if (!purchase) throw new Error("Purchase cancelled");

  await verifyPurchaseWithBackend(purchase);
  try {
    await iap.finishTransaction({ purchase, isConsumable: false });
  } catch (err) {
    captureError(err, { feature: "store_billing", stage: "finish_transaction", productId: purchase.productId });
  }
  await refreshPremiumStatus();
}

export async function restoreSubscriptions(): Promise<void> {
  const rc = await getRevenueCat();
  if (rc.isRevenueCatConfigured()) {
    try {
      await rc.restoreRevenueCatPurchases();
      await refreshPremiumStatus();
      return;
    } catch (err) {
      if (err instanceof rc.RevenueCatBillingError && err.code === "no_active_subscription") {
        throw new Error("No active subscriptions");
      }
      throw err;
    }
  }
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
  try {
    await iap.finishTransaction({ purchase: active[0], isConsumable: false });
  } catch (err) {
    captureError(err, { feature: "store_billing", stage: "restore_finish", productId: active[0].productId });
  }
  await refreshPremiumStatus();
}
