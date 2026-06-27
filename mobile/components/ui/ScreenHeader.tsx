import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
};

export function ScreenHeader({ title, subtitle, actions }: Props) {
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

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  textCol: { flex: 1 },
  title: { color: Colors.text, ...Typography.title },
  subtitle: { color: Colors.textMuted, ...Typography.caption, marginTop: 4 },
  actions: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", justifyContent: "flex-end" },
});
