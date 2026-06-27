import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

type Narrative = { tone?: string; text: string };

type Props = {
  items: Narrative[];
};

const TONE_COLOR: Record<string, string> = {
  success: Colors.success,
  warning: Colors.warning,
  danger: Colors.danger,
};

export function TrendInsightCard({ items }: Props) {
  if (!items.length) return null;

  return (
    <View style={styles.wrap}>
      {items.slice(0, 4).map((item, idx) => (
        <View
          key={`${idx}-${item.text.slice(0, 24)}`}
          style={[styles.card, { borderLeftColor: TONE_COLOR[item.tone || ""] || Colors.accent }]}
        >
          <Text style={styles.text}>{item.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  card: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  text: { color: Colors.textSecondary, lineHeight: 20, fontSize: 14 },
});
