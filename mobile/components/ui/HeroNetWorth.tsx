import { StyleSheet, Text, View } from "react-native";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { Surface } from "./Surface";

export function HeroNetWorth({ label, amount }: { label: string; amount: string }) {
  return (
    <Surface variant="glass" glow style={styles.wrap}>
      <View style={styles.glowOrbPrimary} />
      <View style={styles.glowOrbSecondary} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>
          {amount}
        </Text>
        <View style={styles.lineRow}>
          <View style={styles.line} />
          <View style={styles.lineDot} />
          <View style={[styles.line, styles.lineFade]} />
        </View>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg, minHeight: 156 },
  glowOrbPrimary: {
    position: "absolute",
    top: -48,
    right: -24,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.accentGlow,
    opacity: 0.5,
  },
  glowOrbSecondary: {
    position: "absolute",
    bottom: -30,
    left: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(59,130,246,0.25)",
    opacity: 0.4,
  },
  content: { padding: Spacing.lg, alignItems: "center" },
  label: { color: Colors.textSecondary, ...Typography.label, marginBottom: Spacing.sm },
  amount: {
    color: Colors.accent,
    ...Typography.hero,
    textAlign: "center",
    width: "100%",
  },
  lineRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: 6,
  },
  line: {
    width: 32,
    height: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    opacity: 0.7,
  },
  lineFade: { opacity: 0.25, width: 16 },
  lineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
});
