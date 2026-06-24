import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { ConflictModal } from "@/components/ConflictModal";
import { Colors, Layout, Radius, Shadow, Spacing } from "@/constants/theme";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { useI18n } from "@/i18n";

function TabIcon({ name, color, focused }: { name: keyof typeof Ionicons.glyphMap; color: string; focused: boolean }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Ionicons name={name} size={focused ? 22 : 20} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();
  useRequireUnlock();
  const { conflict, resolveConflict, pendingCount } = useOfflineSync();

  return (
    <>
    <ConflictModal
      visible={!!conflict}
      conflict={conflict}
      onResolve={(choice) => resolveConflict(choice)}
      onSkip={() => resolveConflict("skip")}
    />
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: styles.tabBar,
      tabBarActiveTintColor: Colors.accent,
      tabBarInactiveTintColor: Colors.textMuted,
      tabBarLabelStyle: styles.tabLabel,
      tabBarItemStyle: styles.tabItem,
      tabBarBackground: () => <View style={styles.tabBarBg} />,
    }}>
      <Tabs.Screen name="index" options={{
        title: t.tabs.home,
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "home" : "home-outline"} color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="transactions" options={{
        title: t.tabs.transactions,
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "list" : "list-outline"} color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="insights" options={{
        title: t.tabs.insights,
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "analytics" : "analytics-outline"} color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="input" options={{
        title: t.tabs.input,
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "add-circle" : "add-circle-outline"} color={color} focused={focused} />,
      }} />
      <Tabs.Screen name="settings" options={{
        title: t.tabs.more,
        tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? "grid" : "grid-outline"} color={color} focused={focused} />,
      }} />
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
    left: Spacing.md,
    right: Spacing.md,
    bottom: Platform.OS === "ios" ? 24 : Layout.tabBarBottom,
    height: Layout.tabBarHeight,
    borderRadius: Radius.xl,
    backgroundColor: "transparent",
    borderTopWidth: 0,
    borderWidth: 0,
    paddingBottom: 6,
    paddingTop: 8,
    elevation: 0,
  },
  tabBarBg: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.xl,
    backgroundColor: Colors.cardElevated,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    ...Shadow.card,
  },
  tabLabel: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  tabItem: { paddingVertical: 4 },
  iconWrap: {
    width: 32,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
  },
  iconWrapActive: {
    backgroundColor: Colors.accentSoft,
  },
});
