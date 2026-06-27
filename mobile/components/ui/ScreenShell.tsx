import { ReactNode, useMemo } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Layout, Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { stackBottomPadding, tabBarScrollClearance } from "@/utils/screenInsets";
import { AmbientBackground } from "./AmbientBackground";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
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
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        content: {
          paddingHorizontal: Layout.screenPadding,
          flexGrow: 1,
          width: "100%",
          maxWidth: Layout.maxContentWidth,
          alignSelf: "center",
        },
      }),
    [colors.bg],
  );
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
        <View style={[styles.content, contentStyle]}>{shell}</View>
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
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        ) : undefined
      }
    >
      {shell}
    </ScrollView>
  );
}
