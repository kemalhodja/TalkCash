import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { ListRow } from "@/components/ui/ListRow";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import type { Locale } from "@/i18n";
import { formatMoney } from "@/utils/format";

type Props = {
  category: string;
  spent: number;
  limit: number;
  percent: number;
  locale: Locale;
  usedLabel: string;
  perMonthLabel: string;
  deleteLabel: string;
  onPress?: () => void;
  onLongPress?: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
};

function barColor(percent: number) {
  if (percent >= 100) return Colors.danger;
  if (percent >= 80) return Colors.warning;
  return Colors.accent;
}

export function BudgetProgressCard({
  category,
  spent,
  limit,
  percent,
  locale,
  usedLabel,
  perMonthLabel,
  deleteLabel,
  onPress,
  onLongPress,
  onDelete,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, style]}>
      <ListRow
        title={category}
        subtitle={`${formatMoney(spent, locale)} / ${formatMoney(limit, locale)} ${perMonthLabel}`}
        value={`${percent}%`}
        valueTone={percent >= 100 ? "danger" : percent >= 80 ? "accent" : "default"}
        trailing={<TextLink label={deleteLabel} onPress={onDelete} danger />}
        onPress={onPress}
        onLongPress={onLongPress}
      />
      <Text style={styles.used}>{percent}% {usedLabel}</Text>
      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor(percent) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  used: { color: Colors.textMuted, fontSize: 12, marginTop: -Spacing.xs, marginLeft: Spacing.sm + 4, marginBottom: Spacing.xs },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.pill, marginHorizontal: Spacing.sm, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: Radius.pill },
});
