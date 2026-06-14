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
import { Colors, Spacing } from "@/constants/theme";

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  bottomInset?: boolean;
};

export function ScreenShell({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  style,
  contentStyle,
  bottomInset = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const padBottom = bottomInset ? insets.bottom + 88 : insets.bottom + Spacing.md;

  if (!scroll) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + Spacing.sm }, style]}>
        {children}
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.root, style]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.sm, paddingBottom: padBottom },
        contentStyle,
      ]}
      showsVerticalScrollIndicator={false}
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
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
});
