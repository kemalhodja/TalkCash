import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";

export interface MicroSavingsSummary {
  week_saved?: number;
  month_saved?: number;
  investment_total?: number;
  week_transfer_count?: number;
  live_rates?: { gold_try_per_gram?: number; usd_try?: number; eur_try?: number };
  equivalents?: { gold_grams?: number; forex_usd?: number; forex_eur?: number };
}

interface Props {
  summary: MicroSavingsSummary | null;
  compact?: boolean;
}

export function MicroSavingsHeroCard({ summary, compact }: Props) {
  const { t, locale } = useI18n();
  const weekSaved = Number(summary?.week_saved || 0);
  const monthSaved = Number(summary?.month_saved || 0);
  const investmentTotal = Number(summary?.investment_total || 0);
  const hasActivity = weekSaved > 0 || monthSaved > 0 || investmentTotal > 0;

  return (
    <Surface variant="accent" glow style={styles.card} testID="micro-savings-hero">
      <Text style={styles.label}>{t.microSavings.title}</Text>
      <Text style={styles.heroValue} testID="micro-savings-week-saved">
        {formatMoney(weekSaved, locale)}
      </Text>
      <Text style={styles.heroCaption}>{t.microSavings.weekSaved}</Text>
      <View style={styles.row}>
        <Metric label={t.microSavings.monthSaved} value={formatMoney(monthSaved, locale)} />
        <Metric label={t.microSavings.investmentTotal} value={formatMoney(investmentTotal, locale)} />
      </View>
      {summary?.equivalents?.gold_grams != null && summary.equivalents.gold_grams > 0 ? (
        <Text style={styles.equiv} testID="micro-savings-gold-equiv">
          {t.microSavings.goldEquivalent.replace("{grams}", String(summary.equivalents.gold_grams))}
        </Text>
      ) : null}
      {summary?.live_rates?.gold_try_per_gram ? (
        <Text style={styles.liveRate} testID="micro-savings-live-rate">
          {t.microSavings.liveGoldRate.replace(
            "{price}",
            formatMoney(summary.live_rates.gold_try_per_gram, locale),
          )}
        </Text>
      ) : null}
      {!hasActivity ? (
        <Text style={styles.hint}>{t.microSavings.heroEmptyHint}</Text>
      ) : null}
      {!compact ? (
        <View style={styles.actions}>
          <PrimaryButton
            label={t.microSavings.heroCtaExpense}
            onPress={() => router.push("/input")}
            style={styles.btn}
            testID="micro-savings-hero-expense"
          />
          <PrimaryButton
            label={t.microSavings.settingsTitle}
            onPress={() => router.push("/micro-savings-settings")}
            variant="ghost"
            style={styles.btn}
            testID="micro-savings-hero-settings"
          />
        </View>
      ) : null}
    </Surface>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  label: { color: Colors.accent, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  heroValue: { ...Typography.hero, color: Colors.text },
  heroCaption: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  row: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  metric: { flex: 1 },
  metricLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  metricValue: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  hint: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  equiv: { color: Colors.accent, fontSize: 13, fontWeight: "600", marginBottom: 4 },
  liveRate: { color: Colors.textMuted, fontSize: 11, marginBottom: Spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.xs },
  btn: { flexGrow: 1, minWidth: 120 },
});
