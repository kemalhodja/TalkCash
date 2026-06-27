import { ReactNode, useMemo } from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";

type Variant = "default" | "elevated" | "glass" | "accent" | "interactive";

export function Surface({
  children,
  style,
  variant = "default",
  glow = false,
  testID,
  accessibilityRole,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: Variant;
  glow?: boolean;
} & Pick<ViewProps, "testID" | "accessibilityRole" | "accessibilityLabel">) {
  const { colors, shadow, isDark } = useTheme();

  const variantStyle = useMemo<Record<Variant, ViewStyle>>(
    () => ({
      default: { backgroundColor: colors.card, borderColor: colors.border },
      elevated: { backgroundColor: colors.cardElevated, borderColor: colors.border },
      glass: {
        backgroundColor: isDark ? "rgba(15,21,32,0.88)" : "rgba(255,255,255,0.92)",
        borderColor: colors.borderStrong,
      },
      accent: { backgroundColor: colors.accentSoft, borderColor: colors.borderStrong },
      interactive: {
        backgroundColor: colors.cardElevated,
        borderColor: colors.borderStrong,
      },
    }),
    [colors, isDark],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        base: {
          borderRadius: Radius.lg,
          borderWidth: 1,
          overflow: "hidden",
          ...shadow.card,
        },
        interactive: {
          borderColor: colors.borderStrong,
        },
      }),
    [colors.borderStrong, shadow.card],
  );

  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        variantStyle[variant],
        glow && shadow.glow,
        variant === "interactive" && styles.interactive,
        style,
      ]}
    >
      {children}
    </View>
  );
}
