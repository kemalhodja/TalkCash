import { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { track } from "@/services/analytics";
import { PlanKey, canUseInternalUpgrade, upgradeInternalPlan } from "@/services/premium";
import {
  BillingPeriod,
  getStorePlanPrices,
  isStoreBillingSupported,
  purchaseSubscription,
} from "@/services/storeBilling";

type Props = {
  title?: string;
  message?: string;
  recommendedPlan?: Exclude<PlanKey, "free">;
  onUpgraded?: () => void;
};

export function PaywallCard({
  title,
  message,
  recommendedPlan = "pro",
  onUpgraded,
}: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<BillingPeriod>("yearly");
  const [prices, setPrices] = useState<Record<BillingPeriod, string | null>>({ monthly: null, yearly: null });

  useEffect(() => {
    if (!isStoreBillingSupported()) return;
    getStorePlanPrices()
      .then((rows) => {
        const monthly = rows.find((p) => p.plan === recommendedPlan && p.period === "monthly")?.localizedPrice ?? null;
        const yearly = rows.find((p) => p.plan === recommendedPlan && p.period === "yearly")?.localizedPrice ?? null;
        setPrices({ monthly, yearly });
      })
      .catch(() => {});
  }, [recommendedPlan]);

  const priceLabel = prices[period];
  const periodSuffix = period === "yearly" ? t.premium.perYear : t.premium.perMonth;

  const upgradeLabel = useMemo(() => {
    if (!priceLabel) return t.premium.upgrade;
    return `${t.premium.upgrade} — ${priceLabel}`;
  }, [priceLabel, t.premium.upgrade]);

  const upgrade = async () => {
    setLoading(true);
    track("premium_upgrade_tapped", { plan: recommendedPlan, period });
    try {
      if (canUseInternalUpgrade()) {
        await upgradeInternalPlan(recommendedPlan);
      } else if (isStoreBillingSupported()) {
        await purchaseSubscription(recommendedPlan, period);
      } else {
        Alert.alert(t.premium.title, t.premium.storeComingSoon);
        return;
      }
      Alert.alert(t.premium.title, t.premium.upgraded);
      onUpgraded?.();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface variant="accent" glow style={styles.card}>
      <Text style={styles.eyebrow}>{t.premium.badge}</Text>
      <Text style={styles.title}>{title || t.premium.lockedTitle}</Text>
      <Text style={styles.message}>{message || t.premium.lockedMessage}</Text>
      <View style={styles.features}>
        <Text style={styles.feature}>{t.premium.featureAi}</Text>
        <Text style={styles.feature}>{t.premium.featureReports}</Text>
        <Text style={styles.feature}>{t.premium.featureWorkspace}</Text>
      </View>
      <SegmentedControl
        options={[
          { key: "yearly", label: t.premium.billingYearly },
          { key: "monthly", label: t.premium.billingMonthly },
        ]}
        value={period}
        onChange={(k) => setPeriod(k as BillingPeriod)}
      />
      {priceLabel ? (
        <Text style={styles.price}>
          {priceLabel} / {periodSuffix}
        </Text>
      ) : null}
      <Text style={styles.trialHint}>{t.premium.trialHint}</Text>
      <Text style={styles.tagline}>{t.premium.tagline}</Text>
      <PrimaryButton
        label={upgradeLabel}
        onPress={upgrade}
        loading={loading}
        disabled={loading}
        style={styles.button}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md },
  eyebrow: { color: Colors.accent, ...Typography.label, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: 22, fontWeight: "800", marginBottom: Spacing.sm },
  message: { color: Colors.textSecondary, lineHeight: 21 },
  features: { gap: Spacing.xs, marginTop: Spacing.md },
  feature: { color: Colors.text, fontWeight: "600" },
  button: { marginTop: Spacing.md },
  price: { color: Colors.accent, fontWeight: "700", marginTop: Spacing.sm },
  trialHint: { color: Colors.textSecondary, fontSize: 12, marginTop: Spacing.xs },
  tagline: { color: Colors.textSecondary, fontSize: 13, marginTop: Spacing.xs, fontStyle: "italic" },
});
