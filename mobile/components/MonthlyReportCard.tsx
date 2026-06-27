import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { ListRow } from "@/components/ui/ListRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";

export type MonthlySummaryData = {
  month: number;
  year: number;
  income: number;
  expense: number;
  savings: number;
  savings_rate?: number | null;
  net_worth?: number;
  top_categories?: { category: string; amount: number }[];
  budget_health?: { category: string; spent: number; limit: number; percent: number; status: string }[];
  wallets?: { name: string; balance: number; currency?: string }[];
};

type Props = {
  data: MonthlySummaryData;
  compact?: boolean;
  showDetailsLink?: boolean;
};

export function MonthlyReportCard({ data, compact, showDetailsLink }: Props) {
  const { t, locale } = useI18n();
  const title = t.monthlyReport.title
    .replace("{month}", String(data.month))
    .replace("{year}", String(data.year));

  return (
    <Surface variant={compact ? "glass" : "elevated"} style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <Metric label={t.insightsScreen.income} value={formatMoney(data.income, locale)} tone="success" />
        <Metric label={t.insightsScreen.expense} value={formatMoney(data.expense, locale)} tone="danger" />
        <Metric label={t.insightsScreen.savings} value={formatMoney(data.savings, locale)} />
      </View>
      {data.savings_rate != null ? (
        <Text style={styles.rate}>
          {t.monthlyReport.savingsRate.replace("{rate}", String(data.savings_rate))}
        </Text>
      ) : null}
      {!compact && data.net_worth != null ? (
        <Text style={styles.netWorth}>
          {t.insightsScreen.netWorth}: {formatMoney(data.net_worth, locale)}
        </Text>
      ) : null}
      {!compact && (data.top_categories?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.monthlyReport.topCategories}</Text>
          {data.top_categories!.slice(0, 5).map((c) => (
            <ListRow
              key={c.category}
              title={c.category}
              value={formatMoney(c.amount, locale)}
              valueTone="accent"
            />
          ))}
        </View>
      ) : null}
      {!compact && (data.budget_health?.length ?? 0) > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t.monthlyReport.budgetHealth}</Text>
          {data.budget_health!.map((b) => (
            <ListRow
              key={b.category}
              title={b.category}
              subtitle={`${b.percent}% · ${formatMoney(b.spent, locale)} / ${formatMoney(b.limit, locale)}`}
              valueTone={b.status === "danger" ? "danger" : b.status === "warning" ? "accent" : "default"}
              value={b.status === "danger" ? "!" : undefined}
            />
          ))}
        </View>
      ) : null}
      {showDetailsLink ? (
        <PrimaryButton
          label={t.monthlyReport.viewFull}
          onPress={() => router.push("/monthly-report")}
          variant="ghost"
          compact
          style={styles.linkBtn}
        />
      ) : null}
    </Surface>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "danger" }) {
  const color = tone === "success" ? Colors.success : tone === "danger" ? Colors.danger : Colors.text;
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: Spacing.sm, textTransform: "uppercase" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: Spacing.sm },
  metric: { flex: 1 },
  metricLabel: { color: Colors.textMuted, fontSize: 11, marginBottom: 2 },
  metricValue: { color: Colors.text, fontWeight: "700", fontSize: 15 },
  rate: { color: Colors.accent, marginTop: Spacing.sm, fontWeight: "600" },
  netWorth: { color: Colors.textSecondary, marginTop: Spacing.sm },
  section: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: Spacing.sm },
  linkBtn: { marginTop: Spacing.sm },
});
