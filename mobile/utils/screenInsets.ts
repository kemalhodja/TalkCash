import { Platform } from "react-native";
import type { EdgeInsets } from "react-native-safe-area-context";
import { Layout, Spacing } from "@/constants/theme";

/** Bottom offset for the floating tab bar (gesture nav / home indicator aware). */
export function tabBarBottomOffset(insets: EdgeInsets): number {
  const min = Platform.OS === "ios" ? 20 : 12;
  return Math.max(insets.bottom, min) + Layout.tabBarBottom;
}

/** Scroll content padding so the last row clears the floating tab bar. */
export function tabBarScrollClearance(insets: EdgeInsets): number {
  return tabBarBottomOffset(insets) + Layout.tabBarHeight + Spacing.md;
}

/** Bottom padding for full-screen stack routes (no tab bar). */
export function stackBottomPadding(insets: EdgeInsets): number {
  return Math.max(insets.bottom, Spacing.md) + Spacing.md;
}
