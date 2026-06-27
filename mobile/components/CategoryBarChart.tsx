import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { formatMoney } from "@/utils/format";

type Item = { category: string; amount: number };

type Props = {
  items: Item[];
  locale: string;
  maxBars?: number;
};

export function CategoryBarChart({ items, locale, maxBars = 6 }: Props) {
  const rows = items.slice(0, maxBars);
  const max = Math.max(...rows.map((r) => r.amount), 1);

  if (!rows.length) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {rows.map((row) => {
        const widthPct = Math.max(8, (row.amount / max) * 100);
        return (
          <View key={row.category} style={styles.row}>
            <Text style={styles.label} numberOfLines={1}>{row.category}</Text>
            <View style={styles.track}>
              <View style={[styles.bar, { width: `${widthPct}%` }]} />
            </View>
            <Text style={styles.value}>{formatMoney(row.amount, locale)}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { gap: 4 },
  label: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600" },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: Colors.border,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: Colors.accent,
  },
  value: { color: Colors.text, fontSize: 12, fontWeight: "700", alignSelf: "flex-end" },
});
