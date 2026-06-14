import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityLabel?: string;
};

const variantStyles: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  secondary: { backgroundColor: Colors.cardElevated, borderColor: Colors.borderStrong },
  ghost: { backgroundColor: "transparent", borderColor: Colors.border },
  danger: { backgroundColor: "rgba(248,113,113,0.12)", borderColor: Colors.danger },
};

const textColors: Record<Variant, string> = {
  primary: Colors.bg,
  secondary: Colors.accent,
  ghost: Colors.textSecondary,
  danger: Colors.danger,
};

export function PrimaryButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
  compact,
  accessibilityLabel,
}: Props) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyles[variant],
        compact && styles.compact,
        variant === "primary" && Shadow.glow,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? Colors.bg : Colors.accent} />
      ) : (
        <Text style={[styles.label, { color: textColors[variant] }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  compact: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  disabled: { opacity: 0.5 },
  label: { fontWeight: "700", fontSize: 15 },
});
