import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack } from "expo-router";
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

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.settings.notifications }} />
      {unread > 0 ? (
        <TouchableOpacity style={styles.markAllBtn} onPress={async () => { await api.markAllNotificationsRead(); load(); }}>
          <Text style={styles.markAllText}>{t.settings.markAllRead}</Text>
        </TouchableOpacity>
      ) : null}
      {items.map((n) => (
        <TouchableOpacity
          key={n.id}
          style={[styles.card, !n.is_read && styles.unread]}
          onPress={async () => {
            if (!n.is_read) {
              await api.markNotificationRead(n.id);
              load();
            }
            navigateFromMetadata(n.metadata);
          }}
        >
          <Text style={styles.title}>{n.title}</Text>
          <Text style={styles.body}>{n.body}</Text>
          {n.created_at ? (
            <Text style={styles.date}>{formatDate(n.created_at, locale)}</Text>
          ) : null}
        </TouchableOpacity>
      ))}
      {items.length === 0 && (
        <Text style={styles.empty}>{t.settings.noNotifications}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  markAllBtn: { alignSelf: "flex-end", marginBottom: Spacing.sm },
  markAllText: { color: Colors.accent, fontWeight: "600" },
  card: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  unread: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.06)" },
  title: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  body: { color: Colors.textSecondary, marginTop: 4 },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 8 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
});
