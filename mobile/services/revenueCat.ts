/**
 * RevenueCat SDK wrapper — init, offerings, purchase, restore, entitlement checks.
 * Keys via EXPO_PUBLIC_REVENUECAT_* env (see mobile/.env.example).
 */
import { Platform } from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { captureError } from "./observability";
import { PLAN_SKUS, type BillingPeriod, type StorePlanPrice } from "@/constants/billingSkus";
import type { PlanKey, PremiumStatus } from "./premium";

const PREMIUM_STATUS_KEY = "talkcash_premium_status";

const FREE_STATUS: PremiumStatus = {
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

export const REVENUECAT_ENTITLEMENT_ID =
  process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID
  || (Constants.expoConfig?.extra?.revenueCatEntitlementId as string | undefined)
  || "premium";

type PurchasesModule = typeof import("react-native-purchases");
type CustomerInfo = import("react-native-purchases").CustomerInfo;
type PurchasesPackage = import("react-native-purchases").PurchasesPackage;
type PurchasesOfferings = import("react-native-purchases").PurchasesOfferings;

export type PaywallPackageOption = StorePlanPrice & {
  revenueCatPackage: PurchasesPackage;
};

export class RevenueCatBillingError extends Error {
  code: string;
  userCancelled: boolean;

  constructor(message: string, code: string, userCancelled = false) {
    super(message);
    this.name = "RevenueCatBillingError";
    this.code = code;
    this.userCancelled = userCancelled;
  }
}

let initPromise: Promise<boolean> | null = null;
let configured = false;
let cachedCustomerInfo: CustomerInfo | null = null;
let cachedOfferings: PurchasesOfferings | null = null;

function getRevenueCatApiKey(): string | null {
  const androidKey =
    process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY
    || (Constants.expoConfig?.extra?.revenueCatAndroidApiKey as string | undefined);
  const iosKey =
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY
    || (Constants.expoConfig?.extra?.revenueCatIosApiKey as string | undefined);

  if (Platform.OS === "ios") return iosKey?.trim() || null;
  return androidKey?.trim() || null;
}

function getPurchasesModule(): PurchasesModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-purchases") as PurchasesModule;
  } catch {
    return null;
  }
}

export function isRevenueCatConfigured(): boolean {
  if (Platform.OS === "web") return false;
  return Boolean(getRevenueCatApiKey() && getPurchasesModule());
}

function productIdToPlan(productId: string): Exclude<PlanKey, "free"> | null {
  for (const [plan, periods] of Object.entries(PLAN_SKUS) as [Exclude<PlanKey, "free">, Record<BillingPeriod, string>][]) {
    if (Object.values(periods).includes(productId)) return plan;
  }
  return null;
}

function periodForProductId(productId: string): BillingPeriod | null {
  for (const periods of Object.values(PLAN_SKUS)) {
    if (periods.monthly === productId) return "monthly";
    if (periods.yearly === productId) return "yearly";
  }
  return null;
}

function mapPurchaseError(err: unknown): RevenueCatBillingError {
  const Purchases = getPurchasesModule();
  if (Purchases && err && typeof err === "object" && "code" in err) {
    const rcErr = err as import("react-native-purchases").PurchasesError;
    const cancelled = rcErr.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
    if (cancelled) {
      return new RevenueCatBillingError("Purchase cancelled", rcErr.code, true);
    }
    if (rcErr.code === Purchases.PURCHASES_ERROR_CODE.NETWORK_ERROR) {
      return new RevenueCatBillingError("Network error — check your connection", rcErr.code);
    }
    if (rcErr.code === Purchases.PURCHASES_ERROR_CODE.STORE_PROBLEM_ERROR) {
      return new RevenueCatBillingError("App Store / Play Store is unavailable", rcErr.code);
    }
    if (rcErr.code === Purchases.PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      return new RevenueCatBillingError("Already subscribed — try Restore purchases", rcErr.code);
    }
    return new RevenueCatBillingError(rcErr.message || "Purchase failed", rcErr.code);
  }
  if (err instanceof Error) {
    return new RevenueCatBillingError(err.message, "unknown");
  }
  return new RevenueCatBillingError("Purchase failed", "unknown");
}

function entitlementActive(info: CustomerInfo | null): boolean {
  if (!info) return false;
  const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  return Boolean(ent?.isActive);
}

function activeProductId(info: CustomerInfo): string | null {
  const ent = info.entitlements.active[REVENUECAT_ENTITLEMENT_ID];
  return ent?.productIdentifier || null;
}

async function cachePremiumFromCustomerInfo(info: CustomerInfo): Promise<PremiumStatus> {
  const active = entitlementActive(info);
  const productId = activeProductId(info);
  const plan = productId ? productIdToPlan(productId) : null;

  const status: PremiumStatus = active && plan
    ? {
        ...FREE_STATUS,
        plan,
        status: "active",
        is_premium: true,
        entitlements: Object.fromEntries(
          Object.keys(FREE_STATUS.entitlements).map((key) => [
            key,
            { enabled: true, limit: null, used: 0, remaining: null },
          ]),
        ),
      }
    : { ...FREE_STATUS };

  await AsyncStorage.setItem(PREMIUM_STATUS_KEY, JSON.stringify(status));
  return status;
}

export async function initRevenueCat(appUserId?: string | null): Promise<boolean> {
  if (!isRevenueCatConfigured()) return false;
  if (configured) {
    if (appUserId) await identifyRevenueCatUser(appUserId);
    return true;
  }
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const Purchases = getPurchasesModule();
    const apiKey = getRevenueCatApiKey();
    if (!Purchases || !apiKey) return false;

    try {
      if (__DEV__) {
        Purchases.default.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
      } else {
        Purchases.default.setLogLevel(Purchases.LOG_LEVEL.WARN);
      }

      Purchases.default.configure({
        apiKey,
        appUserID: appUserId?.trim() || undefined,
      });

      Purchases.default.addCustomerInfoUpdateListener((info) => {
        cachedCustomerInfo = info;
        cachePremiumFromCustomerInfo(info).catch((err) => {
          captureError(err, { feature: "revenuecat", stage: "customer_info_listener" });
        });
      });

      configured = true;
      cachedCustomerInfo = await Purchases.default.getCustomerInfo();
      await cachePremiumFromCustomerInfo(cachedCustomerInfo);
      return true;
    } catch (err) {
      captureError(err, { feature: "revenuecat", stage: "configure" });
      initPromise = null;
      return false;
    }
  })();

  return initPromise;
}

export async function identifyRevenueCatUser(appUserId: string): Promise<void> {
  if (!configured) {
    await initRevenueCat(appUserId);
    return;
  }
  const Purchases = getPurchasesModule();
  if (!Purchases) return;
  try {
    const { customerInfo } = await Purchases.default.logIn(appUserId.trim());
    cachedCustomerInfo = customerInfo;
    await cachePremiumFromCustomerInfo(customerInfo);
  } catch (err) {
    captureError(err, { feature: "revenuecat", stage: "log_in", appUserId });
    throw mapPurchaseError(err);
  }
}

export async function logoutRevenueCat(): Promise<void> {
  const Purchases = getPurchasesModule();
  if (!Purchases || !configured) return;
  try {
    const info = await Purchases.default.logOut();
    cachedCustomerInfo = info;
    cachedOfferings = null;
    await AsyncStorage.removeItem(PREMIUM_STATUS_KEY);
  } catch (err) {
    captureError(err, { feature: "revenuecat", stage: "log_out" });
  }
}

export async function fetchPaywallOfferings(force = false): Promise<PaywallPackageOption[]> {
  if (!isRevenueCatConfigured()) return [];
  const ready = await initRevenueCat();
  if (!ready) return [];

  const Purchases = getPurchasesModule();
  if (!Purchases) return [];

  try {
    if (!force && cachedOfferings?.current) {
      return packagesFromOffering(cachedOfferings);
    }
    const offerings = await Purchases.default.getOfferings();
    cachedOfferings = offerings;
    return packagesFromOffering(offerings);
  } catch (err) {
    captureError(err, { feature: "revenuecat", stage: "get_offerings" });
    throw mapPurchaseError(err);
  }
}

function packagesFromOffering(offerings: PurchasesOfferings): PaywallPackageOption[] {
  const current = offerings.current;
  if (!current) return [];

  const packages = current.availablePackages;
  const rows: PaywallPackageOption[] = [];

  for (const pkg of packages) {
    const productId = pkg.product.identifier;
    const plan = productIdToPlan(productId);
    const period = periodForProductId(productId);
    if (!plan || !period) continue;
    const localizedPrice = pkg.product.priceString;
    if (!localizedPrice) continue;
    rows.push({
      plan,
      period,
      productId,
      localizedPrice,
      revenueCatPackage: pkg,
    });
  }

  return rows;
}

export async function purchaseRevenueCatPackage(
  plan: Exclude<PlanKey, "free">,
  period: BillingPeriod,
): Promise<CustomerInfo> {
  const offerings = await fetchPaywallOfferings(true);
  const match = offerings.find((row) => row.plan === plan && row.period === period);
  if (!match) {
    throw new RevenueCatBillingError(
      `Subscription package not found for ${plan} (${period})`,
      "package_not_found",
    );
  }
  return purchasePackage(match.revenueCatPackage);
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<CustomerInfo> {
  if (!isRevenueCatConfigured()) {
    throw new RevenueCatBillingError("RevenueCat is not configured", "not_configured");
  }
  await initRevenueCat();
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    throw new RevenueCatBillingError("Billing SDK unavailable", "sdk_unavailable");
  }

  try {
    const { customerInfo } = await Purchases.default.purchasePackage(pkg);
    cachedCustomerInfo = customerInfo;
    await cachePremiumFromCustomerInfo(customerInfo);
    return customerInfo;
  } catch (err) {
    captureError(err, {
      feature: "revenuecat",
      stage: "purchase_package",
      productId: pkg.product.identifier,
    });
    throw mapPurchaseError(err);
  }
}

export async function restoreRevenueCatPurchases(): Promise<CustomerInfo> {
  if (!isRevenueCatConfigured()) {
    throw new RevenueCatBillingError("RevenueCat is not configured", "not_configured");
  }
  await initRevenueCat();
  const Purchases = getPurchasesModule();
  if (!Purchases) {
    throw new RevenueCatBillingError("Billing SDK unavailable", "sdk_unavailable");
  }

  try {
    const customerInfo = await Purchases.default.restorePurchases();
    cachedCustomerInfo = customerInfo;
    await cachePremiumFromCustomerInfo(customerInfo);
    if (!entitlementActive(customerInfo)) {
      throw new RevenueCatBillingError("No active subscriptions", "no_active_subscription");
    }
    return customerInfo;
  } catch (err) {
    if (err instanceof RevenueCatBillingError) throw err;
    captureError(err, { feature: "revenuecat", stage: "restore_purchases" });
    throw mapPurchaseError(err);
  }
}

export async function getRevenueCatCustomerInfo(force = false): Promise<CustomerInfo | null> {
  if (!isRevenueCatConfigured()) return null;
  const ready = await initRevenueCat();
  if (!ready) return null;
  if (!force && cachedCustomerInfo) return cachedCustomerInfo;

  const Purchases = getPurchasesModule();
  if (!Purchases) return null;

  try {
    cachedCustomerInfo = await Purchases.default.getCustomerInfo();
    await cachePremiumFromCustomerInfo(cachedCustomerInfo);
    return cachedCustomerInfo;
  } catch (err) {
    captureError(err, { feature: "revenuecat", stage: "get_customer_info" });
    return cachedCustomerInfo;
  }
}

/** RevenueCat entitlement gate — use before premium voice / features. */
export async function isRevenueCatPremium(force = false): Promise<boolean> {
  const info = await getRevenueCatCustomerInfo(force);
  return entitlementActive(info);
}

/** Test helper — reset module state. */
export function __resetRevenueCatForTests(): void {
  initPromise = null;
  configured = false;
  cachedCustomerInfo = null;
  cachedOfferings = null;
}