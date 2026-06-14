import { useEffect, useState } from "react";
import { StyleSheet } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
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
      <SectionBlock
        title={t.settings.notifications}
        actionLabel={unread > 0 ? t.settings.markAllRead : undefined}
        onAction={unread > 0 ? async () => { await api.markAllNotificationsRead(); load(); } : undefined}
        bare
      >
        {items.map((n) => (
          <ListRow
            key={n.id}
            title={n.title}
            subtitle={n.body}
            value={n.created_at ? formatDate(n.created_at, locale) : undefined}
            valueTone={!n.is_read ? "accent" : "default"}
            onPress={async () => {
              if (!n.is_read) {
                await api.markNotificationRead(n.id);
                load();
              }
              navigateFromMetadata(n.metadata);
            }}
            style={!n.is_read ? styles.unread : undefined}
          />
        ))}
        {items.length === 0 && (
          <EmptyState message={t.settings.noNotifications} icon="🔔" />
        )}
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  unread: { backgroundColor: Colors.accentSoft, borderRadius: 8, marginBottom: Spacing.xs },
});
