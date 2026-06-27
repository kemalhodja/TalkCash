import { useMemo } from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, TouchableOpacity, ViewStyle } from "react-native";
import { Radius, Touch } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { hapticImpact, hapticSelection } from "@/utils/haptics";

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
  testID?: string;
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
  testID,
}: Props) {
  const { colors, shadow } = useTheme();

  const styles = useMemo(() => {
    const variantStyles: Record<Variant, ViewStyle> = {
      primary: { backgroundColor: colors.accent, borderColor: colors.accent },
      secondary: { backgroundColor: colors.cardElevated, borderColor: colors.borderStrong },
      ghost: { backgroundColor: "transparent", borderColor: colors.border },
      danger: { backgroundColor: "rgba(248,113,113,0.12)", borderColor: colors.danger },
    };
    const textColors: Record<Variant, string> = {
      primary: colors.bgElevated,
      secondary: colors.accent,
      ghost: colors.textSecondary,
      danger: colors.danger,
    };
    return {
      variantStyles,
      textColors,
      sheet: StyleSheet.create({
        base: {
          minHeight: compact ? Touch.minHeight - 8 : Touch.buttonHeight,
          paddingVertical: compact ? 10 : 14,
          paddingHorizontal: compact ? 16 : 22,
          borderRadius: Radius.lg,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
        },
        disabled: { opacity: 0.48 },
        label: { fontWeight: "700", fontSize: compact ? 14 : 15, letterSpacing: 0.2 },
      }),
    };
  }, [colors, compact]);

  const handlePress = () => {
    if (variant === "primary") hapticImpact("medium");
    else hapticSelection();
    onPress();
  };

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.sheet.base,
        styles.variantStyles[variant],
        variant === "primary" && shadow.glow,
        (disabled || loading) && styles.sheet.disabled,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.bgElevated : colors.accent} />
      ) : (
        <Text style={[styles.sheet.label, { color: styles.textColors[variant] }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
