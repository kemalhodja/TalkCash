import { StyleSheet, Text, View } from "react-native";
import { InsightChip } from "@/components/ui/InsightChip";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";

type PortfolioData = {
  health_score: number;
  allocation: {
    gold_share_pct: number;
    forex_share_pct: number;
    investment_share_pct: number;
  };
  target: {
    gold_share_pct: number;
    forex_share_pct: number;
  };
  tips: string[];
  disclaimer: string;
};

type ProjectionRow = {
  month: number;
  added: number;
  cumulative: number;
};

interface Props {
  portfolio?: PortfolioData | null;
  monthlyProjection?: ProjectionRow[] | null;
  yearProjection?: number | null;
}

export function PortfolioCoachCard({ portfolio, monthlyProjection, yearProjection }: Props) {
  const { t, locale } = useI18n();
  if (!portfolio) return null;

  return (
    <Surface variant="default" style={styles.card}>
      <Text style={styles.title}>{t.portfolio.title}</Text>
      <Text style={styles.score}>
        {t.portfolio.healthScore.replace("{score}", String(portfolio.health_score))}
      </Text>
      <View style={styles.row}>
        <Metric
          label={t.portfolio.goldShare}
          value={`%${portfolio.allocation.gold_share_pct}`}
          target={`%${portfolio.target.gold_share_pct}`}
        />
        <Metric
          label={t.portfolio.forexShare}
          value={`%${portfolio.allocation.forex_share_pct}`}
          target={`%${portfolio.target.forex_share_pct}`}
        />
      </View>
      {portfolio.tips.map((tip) => (
        <InsightChip key={tip} text={tip} tone="neutral" />
      ))}
      {yearProjection != null && yearProjection > 0 ? (
        <Text style={styles.projection}>
          {t.portfolio.yearProjection.replace("{amount}", formatMoney(yearProjection, locale))}
        </Text>
      ) : null}
      {monthlyProjection && monthlyProjection.length > 0 ? (
        <View style={styles.projectionList}>
          <Text style={styles.subtitle}>{t.portfolio.monthlyProjection}</Text>
          {monthlyProjection.slice(0, 6).map((row) => (
            <Text key={row.month} style={styles.projectionRow}>
              {t.portfolio.monthLabel.replace("{month}", String(row.month))}: {formatMoney(row.cumulative, locale)}
            </Text>
          ))}
          {monthlyProjection.length > 6 ? (
            <Text style={styles.muted}>{t.portfolio.moreMonths.replace("{count}", String(monthlyProjection.length - 6))}</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.disclaimer}>{portfolio.disclaimer}</Text>
    </Surface>
  );
}

function Metric({ label, value, target }: { label: string; value: string; target: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.target}>{target}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.sm },
  score: { color: Colors.accent, fontWeight: "700", marginBottom: Spacing.sm },
  row: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  metric: { flex: 1 },
  metricLabel: { color: Colors.textMuted, fontSize: 12 },
  metricValue: { color: Colors.text, fontWeight: "700", fontSize: 18 },
  target: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  projection: { color: Colors.text, fontWeight: "600", marginTop: Spacing.sm },
  projectionList: { marginTop: Spacing.sm },
  subtitle: { color: Colors.textSecondary, fontWeight: "600", marginBottom: 4 },
  projectionRow: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
  muted: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, marginTop: Spacing.sm, fontStyle: "italic" },
});
