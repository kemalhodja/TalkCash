import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { Surface } from "./Surface";

type Props = {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  variant?: "default" | "elevated" | "glass";
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bare?: boolean;
};

export function SectionBlock({
  title,
  children,
  actionLabel,
  onAction,
  variant = "default",
  style,
  contentStyle,
  bare = false,
}: Props) {
  const header = (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction ? (
        <TouchableOpacity onPress={onAction} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  if (bare) {
    return (
      <View style={[styles.bare, style]}>
        {header}
        <View style={contentStyle}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      {header}
      <Surface variant={variant} style={[styles.surface, contentStyle]}>
        {children}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  bare: { marginBottom: Spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  title: { color: Colors.text, ...Typography.title, fontSize: 18 },
  action: { color: Colors.accent, fontSize: 13, fontWeight: "700" },
  surface: { padding: Spacing.md },
});
