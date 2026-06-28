import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConflictModal } from "@/components/ConflictModal";
import { CenterTabButton } from "@/components/ui/CenterTabButton";
import { Layout, Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { useI18n } from "@/i18n";
import { tabBarBottomOffset } from "@/utils/screenInsets";

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.iconWrap, focused && { backgroundColor: colors.accentSoft }]}>
      <Ionicons name={name} size={focused ? 21 : 20} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();
  const { colors, shadow, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBottom = tabBarBottomOffset(insets);
  useRequireUnlock();
  const { conflict, resolveConflict, pendingCount } = useOfflineSync();

  const tabBarBgStyle = {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    backgroundColor: isDark ? "rgba(18,26,40,0.92)" : "rgba(255,255,255,0.94)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.card,
  };

  return (
    <>
      <ConflictModal
        visible={!!conflict}
        conflict={conflict}
        onResolve={(choice) => resolveConflict(choice)}
        onSkip={() => resolveConflict("skip")}
      />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          tabBarStyle: [
            styles.tabBar,
            {
              bottom: tabBottom,
              height: Layout.tabBarHeight,
            },
          ],
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: styles.tabLabel,
          tabBarItemStyle: styles.tabItem,
          tabBarBackground: () => <View style={tabBarBgStyle} />,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t.tabs.home,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: t.tabs.transactions,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "list" : "list-outline"} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="insights"
          options={{
            title: t.tabs.insights,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "analytics" : "analytics-outline"} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen
          name="input"
          options={{
            title: t.tabs.input,
            tabBarLabel: () => null,
            tabBarButton: (props) => <CenterTabButton {...props} testID="tab-input-fab" />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t.tabs.more,
            tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
            tabBarButton: ({ ref: _ref, ...props }) => (
              <Pressable {...props} testID="tab-settings" />
            ),
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={focused ? "grid" : "grid-outline"} color={color} focused={focused} />
            ),
          }}
        />
        <Tabs.Screen name="shopping" options={{ href: null }} />
        <Tabs.Screen name="agenda" options={{ href: null }} />
        <Tabs.Screen name="budgets" options={{ href: null }} />
        <Tabs.Screen name="mentor" options={{ href: null }} />
        <Tabs.Screen name="social" options={{ href: null }} />
        <Tabs.Screen name="workspaces" options={{ href: null }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: Spacing.screen,
    right: Spacing.screen,
    borderRadius: Radius.xl,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderWidth: 0,
    paddingBottom: Platform.OS === "ios" ? 6 : 4,
    paddingTop: 6,
    elevation: 0,
  },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: 1, letterSpacing: 0.2 },
  tabItem: { paddingVertical: 2 },
  iconWrap: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
});
