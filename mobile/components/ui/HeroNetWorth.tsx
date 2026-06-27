import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { Surface } from "./Surface";

export function HeroNetWorth({ label, amount }: { label: string; amount: string }) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: Spacing.lg, minHeight: 168 },
        glowOrbPrimary: {
          position: "absolute",
          top: -52,
          right: -28,
          width: 168,
          height: 168,
          borderRadius: 84,
          backgroundColor: colors.accentGlow,
          opacity: 0.45,
        },
        glowOrbSecondary: {
          position: "absolute",
          bottom: -36,
          left: -24,
          width: 108,
          height: 108,
          borderRadius: 54,
          backgroundColor: "rgba(79,142,247,0.22)",
          opacity: 0.35,
        },
        content: { paddingVertical: Spacing.xl, paddingHorizontal: Spacing.lg, alignItems: "center" },
        label: { color: colors.textSecondary, ...Typography.label, marginBottom: Spacing.sm },
        amount: {
          color: colors.accent,
          ...Typography.hero,
          textAlign: "center",
          width: "100%",
        },
        lineRow: {
          flexDirection: "row",
          alignItems: "center",
          marginTop: Spacing.md,
          gap: 8,
        },
        line: {
          width: 36,
          height: 3,
          borderRadius: Radius.pill,
          backgroundColor: colors.accent,
          opacity: 0.75,
        },
        lineFade: { opacity: 0.22, width: 18 },
        lineDot: {
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: colors.accent,
        },
      }),
    [colors],
  );

  return (
    <Surface variant="glass" glow style={styles.wrap}>
      <View style={styles.glowOrbPrimary} />
      <View style={styles.glowOrbSecondary} />
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1} minimumFontScale={0.65}>
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
