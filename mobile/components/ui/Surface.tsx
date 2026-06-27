import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewProps, ViewStyle } from "react-native";
import { Colors, Radius, Shadow } from "@/constants/theme";

type Variant = "default" | "elevated" | "glass" | "accent" | "interactive";

const variantStyle: Record<Variant, ViewStyle> = {
  default: { backgroundColor: Colors.card, borderColor: Colors.border },
  elevated: { backgroundColor: Colors.cardElevated, borderColor: Colors.border },
  glass: { backgroundColor: "rgba(15,21,32,0.88)", borderColor: Colors.borderStrong },
  accent: { backgroundColor: Colors.accentSoft, borderColor: Colors.borderStrong },
  interactive: {
    backgroundColor: Colors.cardElevated,
    borderColor: Colors.borderStrong,
  },
};

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
  return (
    <View
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        variantStyle[variant],
        glow && Shadow.glow,
        variant === "interactive" && styles.interactive,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    ...Shadow.card,
  },
  interactive: {
    borderColor: Colors.borderStrong,
  },
});
