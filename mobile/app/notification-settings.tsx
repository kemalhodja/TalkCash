import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Stack } from "expo-router";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { SettingSwitchRow } from "@/components/ui/SettingSwitchRow";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";

type Prefs = {
  agenda_reminder: boolean;
  budget_warning: boolean;
  budget_exceeded: boolean;
  price_change: boolean;
  premium_expiry_reminder: boolean;
  premium_grace: boolean;
  premium_expired: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
};

export default function NotificationSettingsScreen() {
  const { t } = useI18n();
  useRequireUnlock();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setPrefs(await api.getNotificationPrefs());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (patch: Partial<Prefs>) => {
    if (!prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    try {
      setPrefs(await api.updateNotificationPrefs(patch));
    } catch {
      setPrefs(prefs);
    }
  };

  if (loading || !prefs) return <LoadingScreen />;

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen
        options={{
          title: t.notificationPrefs.title,
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
        }}
      />
      <SectionBlock title={t.notificationPrefs.reminders} bare>
        <SettingSwitchRow
          label={t.notificationPrefs.agenda}
          value={prefs.agenda_reminder}
          onValueChange={(v) => update({ agenda_reminder: v })}
        />
        <SettingSwitchRow
          label={t.notificationPrefs.budgetWarning}
          value={prefs.budget_warning}
          onValueChange={(v) => update({ budget_warning: v })}
        />
        <SettingSwitchRow
          label={t.notificationPrefs.budgetExceeded}
          value={prefs.budget_exceeded}
          onValueChange={(v) => update({ budget_exceeded: v })}
        />
        <SettingSwitchRow
          label={t.notificationPrefs.priceChange}
          value={prefs.price_change}
          onValueChange={(v) => update({ price_change: v })}
        />
        <SettingSwitchRow
          label={t.notificationPrefs.premium}
          value={prefs.premium_expiry_reminder && prefs.premium_grace && prefs.premium_expired}
          onValueChange={(v) => update({
            premium_expiry_reminder: v,
            premium_grace: v,
            premium_expired: v,
          })}
        />
      </SectionBlock>
      <SectionBlock title={t.notificationPrefs.quietHours} bare>
        <SettingSwitchRow
          label={t.notificationPrefs.quietHoursEnabled}
          value={prefs.quiet_hours_enabled}
          onValueChange={(v) => update({ quiet_hours_enabled: v })}
        />
        <Text style={styles.hint}>
          {t.notificationPrefs.quietHoursHint
            .replace("{start}", prefs.quiet_hours_start)
            .replace("{end}", prefs.quiet_hours_end)}
        </Text>
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
});
