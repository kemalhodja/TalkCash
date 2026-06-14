import { StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { Surface } from "./Surface";

export function HeroNetWorth({ label, amount }: { label: string; amount: string }) {
  return (
    <Surface variant="glass" glow style={styles.wrap}>
      <View style={styles.glowOrb} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount}>{amount}</Text>
        <View style={styles.line} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg, minHeight: 148 },
  glowOrb: {
    position: "absolute",
    top: -40,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.accentGlow,
    opacity: 0.45,
  },
  content: { padding: Spacing.lg, alignItems: "center" },
  label: { color: Colors.textSecondary, ...Typography.label, marginBottom: Spacing.sm },
  amount: { color: Colors.accent, ...Typography.hero },
  line: {
    marginTop: Spacing.md,
    width: 48,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    opacity: 0.6,
  },
});
