import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n, Locale } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { isGeofencingEnabled, restoreGeofencingIfEnabled, setupGeofencing, stopGeofencing } from "@/services/geofencing";
import { registerForPushNotifications } from "@/services/notifications";
import { flushQueue, getPendingCount } from "@/services/offlineQueue";
import { AssistantSetup } from "@/components/AssistantSetup";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { isBudgetTtsEnabled, setBudgetTtsEnabled } from "@/services/speech";

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const [biometric, setBiometric] = useState(false);
  const [geofence, setGeofence] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ttsBudget, setTtsBudget] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const TIMEZONES = [
    { id: "Europe/Istanbul", label: "🇹🇷 Istanbul" },
    { id: "Europe/London", label: "🇬🇧 London" },
    { id: "America/New_York", label: "🇺🇸 New York" },
    { id: "Asia/Tokyo", label: "🇯🇵 Tokyo" },
  ];

  useEffect(() => {
    isBudgetTtsEnabled().then(setTtsBudget);
    api.getMe().then((u) => {
      if (u.timezone) setTimezone(u.timezone);
      if (typeof u.biometric_enabled === "boolean") setBiometric(u.biometric_enabled);
    }).catch(() => {});
    isGeofencingEnabled().then(setGeofence).catch(() => {});
    getPendingCount().then(setPendingCount);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await flushQueue(async (c) => new Promise((resolve) => {
        Alert.alert(c.message, t.sync.conflictHint, [
          { text: t.sync.keepLocal, onPress: () => resolve("local") },
          { text: t.sync.keepServer, onPress: () => resolve("server") },
          { text: t.sync.skip, style: "cancel", onPress: () => resolve("skip") },
        ]);
      }));
      setPendingCount(await getPendingCount());
      Alert.alert(
        t.settings.sync,
        t.settings.syncResult
          .replace("{applied}", String(result.applied))
          .replace("{conflicts}", String(result.conflicts))
          .replace("{failed}", String(result.failed)),
      );
    } catch {
      Alert.alert(t.settings.sync, t.common.error);
    } finally {
      setSyncing(false);
    }
  };

  const toggleBiometric = async (val: boolean) => {
    setBiometric(val);
    try { await api.toggleBiometric(val); await auth.updateUser({ biometricEnabled: val }); }
    catch { setBiometric(!val); }
  };

  const toggleTtsBudget = async (val: boolean) => {
    setTtsBudget(val);
    await setBudgetTtsEnabled(val);
  };

  const selectTimezone = async (tz: string) => {
    setTimezone(tz);
    try { await api.setTimezone(tz); } catch { /* keep local selection */ }
  };

  const toggleGeofence = async (val: boolean) => {
    if (val) {
      const ok = await setupGeofencing();
      if (!ok) {
        Alert.alert(t.settings.geofence, t.common.error);
        return;
      }
    } else {
      await stopGeofencing();
    }
    setGeofence(val);
  };

  useEffect(() => {
    restoreGeofencingIfEnabled().catch(() => {});
  }, []);

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(true);
    try {
      const blob = type === "pdf" ? await api.exportPdf() : await api.exportExcel();
      const ext = type === "pdf" ? "pdf" : "xlsx";
      const path = `${FileSystem.cacheDirectory}${t.settings.exportFilename}.${ext}`;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      };
      reader.readAsDataURL(blob);
    } catch {
      Alert.alert(t.settings.export, t.common.error);
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await auth.clear();
    router.replace("/login");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.settings.title}</Text>

      <ApiConnectionCard />

      <Text style={styles.sectionTitle}>{t.settings.language}</Text>
      <View style={styles.langRow}>
        {(["tr", "en"] as Locale[]).map((l) => (
          <TouchableOpacity key={l} style={[styles.langBtn, locale === l && styles.langActive]}
            onPress={() => setLocale(l)}>
            <Text style={[styles.langText, locale === l && styles.langTextActive]}>
              {l === "tr" ? "🇹🇷 Türkçe" : "🇬🇧 English"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionTitle}>{t.settings.timezone}</Text>
      <View style={styles.langRow}>
        {TIMEZONES.map((tz) => (
          <TouchableOpacity key={tz.id} style={[styles.langBtn, timezone === tz.id && styles.langActive]}
            onPress={() => selectTimezone(tz.id)}>
            <Text style={[styles.langText, timezone === tz.id && styles.langTextActive]}>{tz.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.ttsBudget}</Text>
        <Switch value={ttsBudget} onValueChange={toggleTtsBudget} trackColor={{ true: Colors.accent }} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.biometric}</Text>
        <Switch value={biometric} onValueChange={toggleBiometric} trackColor={{ true: Colors.accent }} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>{t.settings.geofence}</Text>
        <Switch value={geofence} onValueChange={toggleGeofence} trackColor={{ true: Colors.accent }} />
      </View>

      <AssistantSetup />

      <Text style={styles.sectionTitle}>{t.settings.sync}</Text>
      <TouchableOpacity style={styles.btn} onPress={handleSync} disabled={syncing}>
        <Text style={styles.btnText}>
          {syncing ? t.common.loading : t.settings.syncNow}
          {pendingCount > 0 ? ` (${pendingCount})` : ""}
        </Text>
      </TouchableOpacity>
      {pendingCount > 0 && (
        <Text style={styles.pendingHint}>{t.settings.pendingOps.replace("{count}", String(pendingCount))}</Text>
      )}

      <TouchableOpacity style={styles.btn} onPress={() => registerForPushNotifications()}>
        <Text style={styles.btnText}>{t.settings.push}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => router.push("/notifications")}>
        <Text style={styles.btnText}>{t.settings.viewNotifications}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.btn} onPress={() => router.push("/receipts")}>
        <Text style={styles.btnText}>{t.settings.viewReceipts}</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>{t.settings.export}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => handleExport("pdf")} disabled={exporting}>
        <Text style={styles.btnText}>{t.settings.exportPdf}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { marginTop: Spacing.sm }]} onPress={() => handleExport("excel")} disabled={exporting}>
        <Text style={styles.btnText}>{t.settings.exportExcel}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t.settings.logout}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  langRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  langBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  langActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  langText: { color: Colors.textSecondary },
  langTextActive: { color: Colors.accent, fontWeight: "600" },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  label: { color: Colors.text, fontSize: 16 },
  btn: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: 10, alignItems: "center", marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  btnText: { color: Colors.accent, fontWeight: "600" },
  logoutBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: "center" },
  logoutText: { color: Colors.danger, fontWeight: "600" },
  pendingHint: { color: Colors.warning, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
});
