import { Pressable, StyleSheet, View } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { Layout, Radius } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { hapticImpact } from "@/utils/haptics";

/** Elevated center mic tab — premium floating action entry. */
export function CenterTabButton({ onPress, accessibilityState, accessibilityLabel, testID }: BottomTabBarButtonProps) {
  const { colors, shadow, isDark } = useTheme();
  const focused = accessibilityState?.selected;

  return (
    <Pressable
      onPress={(e) => {
        hapticImpact("medium");
        onPress?.(e);
      }}
      style={styles.wrap}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
    >
      <View
        style={[
          styles.ring,
          {
            backgroundColor: colors.bg,
            borderColor: isDark ? colors.borderStrong : colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.fab,
            { backgroundColor: colors.accent },
            shadow.glowStrong,
            focused && styles.fabFocused,
          ]}
        >
          <Ionicons name={focused ? "mic" : "mic-outline"} size={26} color={colors.bgElevated} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    top: -Layout.fabLift,
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  ring: {
    width: Layout.fabSize + 8,
    height: Layout.fabSize + 8,
    borderRadius: (Layout.fabSize + 8) / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    width: Layout.fabSize,
    height: Layout.fabSize,
    borderRadius: Layout.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  fabFocused: {
    transform: [{ scale: 1.04 }],
  },
});
