import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Spacing, Typography } from "@/constants/theme";

type Props = {
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function EmptyState({
  message,
  icon = "○",
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <PrimaryButton label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <PrimaryButton label={secondaryLabel} onPress={onSecondary} variant="ghost" style={styles.secondary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.lg },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  icon: { color: Colors.accent, fontSize: 22 },
  message: { color: Colors.textMuted, ...Typography.body, textAlign: "center", lineHeight: 22 },
  action: { marginTop: Spacing.lg, alignSelf: "stretch" },
  secondary: { marginTop: Spacing.sm, alignSelf: "stretch" },
});
