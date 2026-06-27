import { StyleSheet, Text, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { FUNNEL_STEPS, type FunnelStep } from "@/services/analytics";

type Props = {
  events: Record<string, number>;
  local?: Partial<Record<FunnelStep, boolean>>;
};

function stepLabel(t: ReturnType<typeof useI18n>["t"], step: FunnelStep): string {
  const map: Record<FunnelStep, string> = {
    register_success: t.account.funnelRegister,
    onboarding_completed: t.account.funnelOnboarding,
    first_expense: t.account.funnelFirstExpense,
    first_sync: t.account.funnelFirstSync,
    paywall_viewed: t.account.funnelPaywall,
    premium_upgrade_tapped: t.account.funnelUpgrade,
  };
  return map[step];
}

export function FunnelProgressCard({ events, local }: Props) {
  const { t } = useI18n();
  const completed = FUNNEL_STEPS.filter(
    (step) => (events[step] ?? 0) > 0 || local?.[step],
  ).length;

  return (
    <Surface variant="glass" style={styles.card}>
      <Text style={styles.title}>{t.account.funnelTitle}</Text>
      <Text style={styles.meta}>
        {t.account.funnelProgress.replace("{done}", String(completed)).replace("{total}", String(FUNNEL_STEPS.length))}
      </Text>
      {FUNNEL_STEPS.map((step) => {
        const done = (events[step] ?? 0) > 0 || local?.[step];
        return (
          <View key={step} style={styles.row}>
            <Text style={[styles.dot, done && styles.dotDone]}>{done ? "✓" : "○"}</Text>
            <Text style={[styles.label, done && styles.labelDone]}>{stepLabel(t, step)}</Text>
          </View>
        );
      })}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.xs },
  meta: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.xs },
  dot: { color: Colors.textMuted, width: 20, fontWeight: "700" },
  dotDone: { color: Colors.accent },
  label: { color: Colors.textSecondary, flex: 1 },
  labelDone: { color: Colors.text, fontWeight: "600" },
});
