import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";
import { formatDate } from "@/utils/format";
import { navigateFromMetadata } from "@/hooks/useNotificationLinking";

export default function NotificationsScreen() {
  const { t, locale } = useI18n();
  useRequireUnlock();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setItems(await api.getNotifications());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  const unread = items.filter((n) => !n.is_read).length;

  if (loading) return <LoadingScreen />;

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen options={{ title: t.settings.notifications, headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />
      {unread > 0 ? (
        <TouchableOpacity style={styles.markAllBtn} onPress={async () => { await api.markAllNotificationsRead(); load(); }}>
          <Text style={styles.markAllText}>{t.settings.markAllRead}</Text>
        </TouchableOpacity>
      ) : null}
      {items.map((n) => (
        <TouchableOpacity
          key={n.id}
          activeOpacity={0.85}
          onPress={async () => {
            if (!n.is_read) {
              await api.markNotificationRead(n.id);
              load();
            }
            navigateFromMetadata(n.metadata);
          }}
        >
          <Surface variant={!n.is_read ? "accent" : "elevated"} style={styles.card}>
            <Text style={styles.title}>{n.title}</Text>
            <Text style={styles.body}>{n.body}</Text>
            {n.created_at ? (
              <Text style={styles.date}>{formatDate(n.created_at, locale)}</Text>
            ) : null}
          </Surface>
        </TouchableOpacity>
      ))}
      {items.length === 0 && (
        <EmptyState message={t.settings.noNotifications} icon="🔔" />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  markAllBtn: { alignSelf: "flex-end", marginBottom: Spacing.sm },
  markAllText: { color: Colors.accent, fontWeight: "600" },
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  title: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  body: { color: Colors.textSecondary, marginTop: 4 },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
});
