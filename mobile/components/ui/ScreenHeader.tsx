import { ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function ScreenHeader({ title, subtitle, actions }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: Spacing.lg,
          gap: Spacing.md,
        },
        textCol: { flex: 1 },
        title: { color: colors.text, ...Typography.title },
        subtitle: { color: colors.textMuted, ...Typography.caption, marginTop: 6 },
        actions: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" },
      }),
    [colors],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        {subtitle ? <Text style={styles.subtitle} accessibilityRole="text">{subtitle}</Text> : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}
