import { useCallback, useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Stack } from "expo-router";
import { ErrorState } from "@/components/ErrorState";
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

function parseTime(value: string): Date {
  const [h, m] = value.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export default function NotificationSettingsScreen() {
  const { t } = useI18n();
  useRequireUnlock();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<"start" | "end" | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      setPrefs(await api.getNotificationPrefs());
    } catch (e: any) {
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

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

  const onTimeChange = (_: unknown, date?: Date) => {
    if (Platform.OS === "android") setPicker(null);
    if (!date || !prefs || !picker) return;
    const key = picker === "start" ? "quiet_hours_start" : "quiet_hours_end";
    update({ [key]: formatTime(date) });
  };

  if (loading) return <LoadingScreen />;
  if (error || !prefs) return <ErrorState message={error || t.common.error} onRetry={load} />;

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
        <View style={styles.timeRow}>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setPicker("start")} accessibilityRole="button">
            <Text style={styles.timeLabel}>{t.notificationPrefs.quietStart}</Text>
            <Text style={styles.timeValue}>{prefs.quiet_hours_start}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.timeBtn} onPress={() => setPicker("end")} accessibilityRole="button">
            <Text style={styles.timeLabel}>{t.notificationPrefs.quietEnd}</Text>
            <Text style={styles.timeValue}>{prefs.quiet_hours_end}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.hint}>
          {t.notificationPrefs.quietHoursHint
            .replace("{start}", prefs.quiet_hours_start)
            .replace("{end}", prefs.quiet_hours_end)}
        </Text>
        {picker ? (
          <DateTimePicker
            value={parseTime(picker === "start" ? prefs.quiet_hours_start : prefs.quiet_hours_end)}
            mode="time"
            is24Hour
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onTimeChange}
          />
        ) : null}
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  hint: { color: Colors.textMuted, fontSize: 13, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  timeRow: { flexDirection: "row", gap: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.sm },
  timeBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timeLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 4 },
  timeValue: { color: Colors.text, fontSize: 18, fontWeight: "700" },
});
