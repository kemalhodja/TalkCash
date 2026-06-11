import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ConflictModal } from "@/components/ConflictModal";
import { Colors } from "@/constants/theme";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { useI18n } from "@/i18n";

export default function TabLayout() {
  const { t } = useI18n();
  useRequireUnlock();
  const { conflict, resolveConflict } = useOfflineSync();

  return (
    <>
    <ConflictModal
      visible={!!conflict}
      conflict={conflict}
      onResolve={(choice) => resolveConflict(choice)}
      onSkip={() => resolveConflict("skip")}
    />
    <Tabs screenOptions={{
      tabBarStyle: { backgroundColor: Colors.card, borderTopColor: Colors.border },
      tabBarActiveTintColor: Colors.accent,
      tabBarInactiveTintColor: Colors.textMuted,
      headerStyle: { backgroundColor: Colors.bg },
      headerTintColor: Colors.text,
    }}>
      <Tabs.Screen name="index" options={{ title: t.tabs.home, tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="transactions" options={{ title: t.tabs.transactions, tabBarIcon: ({ color, size }) => <Ionicons name="list" size={size} color={color} /> }} />
      <Tabs.Screen name="shopping" options={{ title: t.tabs.shopping, tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} /> }} />
      <Tabs.Screen name="agenda" options={{ title: t.tabs.agenda, tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="input" options={{ title: t.tabs.input, tabBarIcon: ({ color, size }) => <Ionicons name="mic" size={size} color={color} /> }} />
      <Tabs.Screen name="budgets" options={{ title: t.tabs.budget, tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="social" options={{ title: t.tabs.social, tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: t.tabs.settings, tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} /> }} />
    </Tabs>
    </>
  );
}
