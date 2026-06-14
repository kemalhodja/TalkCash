import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet } from "react-native";
import { ConflictModal } from "@/components/ConflictModal";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { useI18n } from "@/i18n";

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
    }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="transactions" options={{ title: t.tabs.transactions, tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="shopping" options={{ title: t.tabs.shopping, tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} /> }} />
      <Tabs.Screen name="agenda" options={{ title: t.tabs.agenda, tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{
        title: t.tabs.settings,
        tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
      }} />
      <Tabs.Screen name="input" options={{ href: null }} />
      <Tabs.Screen name="budgets" options={{ href: null }} />
      <Tabs.Screen name="mentor" options={{ href: null }} />
      <Tabs.Screen name="social" options={{ href: null }} />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    bottom: Platform.OS === "ios" ? 24 : 16,
    height: 68,
    borderRadius: Radius.xl,
    backgroundColor: Colors.cardElevated,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    paddingBottom: 6,
    paddingTop: 8,
    ...Shadow.card,
  },
  tabLabel: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  tabItem: { paddingVertical: 4 },
});
