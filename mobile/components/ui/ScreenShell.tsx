import { ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Colors, Layout, Spacing } from "@/constants/theme";
import { stackBottomPadding, tabBarScrollClearance } from "@/utils/screenInsets";
import { AmbientBackground } from "./AmbientBackground";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** When true (default), reserve space for the floating tab bar. */
  bottomInset?: boolean;
  ambient?: boolean | "subtle";
};

export function ScreenShell({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  contentStyle,
  bottomInset = true,
  ambient = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const padTop = insets.top + Spacing.sm;
  const padBottom = bottomInset ? tabBarScrollClearance(insets) : stackBottomPadding(insets);
  const ambientVariant = ambient === "subtle" ? "subtle" : "default";

  const shell = (
    <>
      {ambient ? <AmbientBackground variant={ambientVariant} /> : null}
      {children}
    </>
  );

  if (!scroll) {
    return (
      <View
        style={[
          styles.root,
          { paddingTop: padTop, paddingBottom: padBottom },
          style,
        ]}
      >
        {shell}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: padTop, paddingBottom: padBottom },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
            colors={[Colors.accent]}
          />
        ) : undefined
      }
    >
      {shell}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: {
    paddingHorizontal: Layout.screenPadding,
    flexGrow: 1,
  },
});
