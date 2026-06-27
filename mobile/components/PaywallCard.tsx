import { useEffect, useMemo, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { FEEDBACK_MAILTO } from "@/constants/links";
import { Surface } from "@/components/ui/Surface";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { track, trackPaywallView, trackPremiumUpgradeTapped } from "@/services/analytics";
import { PlanKey, canUseInternalUpgrade, upgradeInternalPlan } from "@/services/premium";
import {
  BillingPeriod,
  getStorePlanPrices,
  isStoreBillingSupported,
  purchaseSubscription,
  restoreSubscriptions,
} from "@/services/storeBilling";
import { hapticImpact } from "@/utils/haptics";

type Props = {
  title?: string;
  message?: string;
  recommendedPlan?: Exclude<PlanKey, "free">;
  onUpgraded?: () => void;
};

const PLAN_OPTIONS: Exclude<PlanKey, "free">[] = ["pro", "family", "business"];

export function PaywallCard({
  title,
  message,
  recommendedPlan = "pro",
  onUpgraded,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [plan, setPlan] = useState<Exclude<PlanKey, "free">>(recommendedPlan);
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [prices, setPrices] = useState<Record<Exclude<PlanKey, "free">, Record<BillingPeriod, string | null>>>({
    pro: { monthly: null, yearly: null },
    family: { monthly: null, yearly: null },
    business: { monthly: null, yearly: null },
  });

  useEffect(() => {
    trackPaywallView(plan);
  }, [plan]);

  useEffect(() => {
    setPlan(recommendedPlan);
  }, [recommendedPlan]);

  useEffect(() => {
    if (!isStoreBillingSupported()) return;
    getStorePlanPrices()
      .then((rows) => {
        const next = {
          pro: { monthly: null, yearly: null },
          family: { monthly: null, yearly: null },
          business: { monthly: null, yearly: null },
        } as typeof prices;
        for (const row of rows) {
          next[row.plan][row.period] = row.localizedPrice;
        }
        setPrices(next);
      })
      .catch(() => {});
  }, []);

  const priceLabel = prices[plan][period];
  const periodSuffix = period === "yearly" ? t.premium.perYear : t.premium.perMonth;

  const upgradeLabel = useMemo(() => {
    if (!priceLabel) return t.premium.upgrade;
    return `${t.premium.upgrade} — ${priceLabel}`;
  }, [priceLabel, t.premium.upgrade]);

  const planFeatures: Record<Exclude<PlanKey, "free">, string> = {
    pro: t.premium.comparePro,
    family: t.premium.compareFamily,
    business: t.premium.compareBusiness,
  };

  const upgrade = async () => {
    setLoading(true);
    track("premium_upgrade_tapped", { plan, period });
    await trackPremiumUpgradeTapped(plan, period);
    try {
      if (canUseInternalUpgrade()) {
        await upgradeInternalPlan(plan);
      } else if (isStoreBillingSupported()) {
        await purchaseSubscription(plan, period);
      } else {
        Alert.alert(t.premium.title, t.premium.storeComingSoon, [
          { text: t.premium.openPlayStore, onPress: () => Linking.openURL("https://play.google.com/store/apps/details?id=io.talkcash.app") },
          { text: t.premium.contactSupport, onPress: () => Linking.openURL(FEEDBACK_MAILTO) },
          { text: t.common.close, style: "cancel" },
        ]);
        return;
      }
      await hapticImpact("success");
      Alert.alert(t.premium.title, t.premium.upgraded);
      onUpgraded?.();
    } catch (e: any) {
      hapticImpact("error");
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  const restore = async () => {
    if (!isStoreBillingSupported()) {
      Linking.openURL(FEEDBACK_MAILTO);
      return;
    }
    setRestoring(true);
    try {
      await restoreSubscriptions();
      await hapticImpact("success");
      Alert.alert(t.premium.title, t.premium.restored);
      onUpgraded?.();
    } catch (e: any) {
      hapticImpact("warning");
      Alert.alert(t.premium.title, e.message?.includes("No active") ? t.premium.noSubscriptions : (e.message || t.common.error));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Surface variant="accent" glow style={styles.card} accessibilityRole="summary" accessibilityLabel={title || t.premium.lockedTitle}>
      <Text style={styles.eyebrow}>{t.premium.badge}</Text>
      <Text style={styles.title}>{title || t.premium.lockedTitle}</Text>
      <Text style={styles.message}>{message || t.premium.lockedMessage}</Text>

      <View style={styles.trustRow}>
        <Text style={styles.trustItem}>🔒 {t.premium.trustSecure}</Text>
        <Text style={styles.trustItem}>↩ {t.premium.trustCancel}</Text>
      </View>

      <ChipPicker
        label={t.premium.choosePlan}
        options={PLAN_OPTIONS.map((key) => ({ id: key, label: key.charAt(0).toUpperCase() + key.slice(1) }))}
        value={plan}
        onChange={(id) => setPlan(id as Exclude<PlanKey, "free">)}
      />

      <Text style={styles.planDetail}>{planFeatures[plan]}</Text>

      <View style={styles.features}>
        <Text style={styles.feature}>{t.premium.featureAi}</Text>
        <Text style={styles.feature}>{t.premium.featureReports}</Text>
        <Text style={styles.feature}>{t.premium.featureWorkspace}</Text>
      </View>

      <SegmentedControl
        accessibilityLabel={t.premium.billingPeriod}
        options={[
          { key: "yearly", label: t.premium.billingYearly },
          { key: "monthly", label: t.premium.billingMonthly },
        ]}
        value={period}
        onChange={(k) => setPeriod(k as BillingPeriod)}
      />
      {period === "yearly" ? (
        <Text style={styles.savingsBadge}>{t.premium.yearlySavings}</Text>
      ) : null}
      {priceLabel ? (
        <Text style={styles.price} accessibilityRole="text">
          {priceLabel} / {periodSuffix}
        </Text>
      ) : null}
      <Text style={styles.trialHint}>{t.premium.trialHint}</Text>
      <Text style={styles.tagline}>{t.premium.tagline}</Text>
      <PrimaryButton
        label={upgradeLabel}
        onPress={upgrade}
        loading={loading}
        disabled={loading || restoring}
        style={styles.button}
        accessibilityLabel={upgradeLabel}
      />
      <View style={styles.secondaryActions}>
        <PrimaryButton
          label={t.premium.restorePurchases}
          onPress={restore}
          variant="ghost"
          compact
          loading={restoring}
          disabled={loading || restoring}
          style={styles.secondaryBtn}
        />
        <PrimaryButton
          label={t.feedback.title}
          onPress={() => router.push("/feedback")}
          variant="ghost"
          compact
          style={styles.secondaryBtn}
        />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md },
  eyebrow: { color: Colors.accent, ...Typography.label, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: 22, fontWeight: "800", marginBottom: Spacing.sm },
  message: { color: Colors.textSecondary, lineHeight: 21 },
  trustRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md },
  trustItem: { color: Colors.textMuted, fontSize: 12, fontWeight: "600" },
  planDetail: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  features: { gap: Spacing.xs, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  feature: { color: Colors.text, fontWeight: "600" },
  button: { marginTop: Spacing.md },
  price: { color: Colors.accent, fontWeight: "700", marginTop: Spacing.sm },
  savingsBadge: {
    color: Colors.success,
    fontWeight: "700",
    fontSize: 12,
    marginTop: Spacing.xs,
  },
  trialHint: { color: Colors.textSecondary, fontSize: 12, marginTop: Spacing.xs },
  tagline: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.xs, fontStyle: "italic" },
  secondaryActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  secondaryBtn: { flex: 1 },
});
