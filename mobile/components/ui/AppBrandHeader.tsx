import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";

export function AppBrandHeader({ greeting, name }: { greeting: string; name: string }) {
  const { colors, shadow } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: Spacing.lg },
        brandRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
        logoDot: {
          width: 11,
          height: 11,
          borderRadius: 5.5,
          backgroundColor: colors.accent,
          ...shadow.glow,
        },
        brand: { color: colors.textMuted, ...Typography.label },
        greeting: {
          color: colors.text,
          fontSize: 28,
          fontWeight: "700",
          letterSpacing: -0.6,
          lineHeight: 34,
        },
      }),
    [colors, shadow.glow],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.logoDot} />
        <Text style={styles.brand}>TalkCash</Text>
      </View>
      <Text style={styles.greeting} numberOfLines={2}>
        {greeting}, {name}
      </Text>
    </View>
  );
}
