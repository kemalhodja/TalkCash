import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";

type Tone = "neutral" | "warning" | "danger" | "success";

const toneMap: Record<Tone, { bg: string; border: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  neutral: { bg: Colors.cardElevated, border: Colors.border, color: Colors.textSecondary, icon: "analytics-outline" },
  warning: { bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.25)", color: Colors.warning, icon: "warning-outline" },
  danger: { bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.25)", color: Colors.danger, icon: "alert-circle-outline" },
  success: { bg: Colors.accentSoft, border: Colors.borderStrong, color: Colors.accent, icon: "trending-up-outline" },
};

export function InsightChip({ text, tone = "neutral" }: { text: string; tone?: Tone }) {
  const t = toneMap[tone];
  return (
    <View style={[styles.chip, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Ionicons name={t.icon} size={16} color={t.color} />
      <Text style={[styles.text, { color: t.color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "500" },
});
