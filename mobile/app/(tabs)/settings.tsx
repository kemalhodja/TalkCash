import { ReactNode, useEffect, useState } from "react";
import {
  Alert, Linking, Modal, StyleSheet, Switch, Text, TouchableOpacity, View,
} from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { AssistantSetup } from "@/components/AssistantSetup";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { PRIVACY_POLICY_URL } from "@/constants/links";
import { useI18n, Locale } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { getAppEnv } from "@/services/config";
import { isGeofencingEnabled, restoreGeofencingIfEnabled, setupGeofencing, stopGeofencing } from "@/services/geofencing";
import { registerForPushNotifications } from "@/services/notifications";
import { flushQueue, getPendingCount } from "@/services/offlineQueue";
import { isBudgetTtsEnabled, setBudgetTtsEnabled } from "@/services/speech";

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const [biometric, setBiometric] = useState(false);
  const [geofence, setGeofence] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ttsBudget, setTtsBudget] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [securityModal, setSecurityModal] = useState<"pin" | "password" | "delete" | null>(null);
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");

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

  const closeSecurity = () => {
    setSecurityModal(null);
    setField1("");
    setField2("");
  };

  const submitSecurity = async () => {
    try {
      if (securityModal === "pin") {
        await api.changePin(field1, field2);
        Alert.alert(t.settings.changePin, t.settings.pinChanged);
      } else if (securityModal === "password") {
        await api.changePassword(field1, field2);
        Alert.alert(t.settings.changePassword, t.settings.passwordChanged);
      } else if (securityModal === "delete") {
        await api.deleteAccount(field1);
        await auth.clear();
        Alert.alert(t.settings.deleteAccount, t.settings.accountDeleted);
        router.replace("/login");
      }
      closeSecurity();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    }
  };

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
    await api.logout();
    router.replace("/login");
  };

  return (
    <>
      <ScreenShell>
        <ScreenHeader title={t.settings.title} subtitle={`${t.settings.appEnv}: ${getAppEnv()}`} />

        <ApiConnectionCard />

        <SectionTitle>{t.settings.language}</SectionTitle>
        <View style={styles.chipRow}>
          {(["tr", "en"] as Locale[]).map((l) => (
            <TouchableOpacity key={l} style={[styles.chip, locale === l && styles.chipActive]}
              onPress={() => setLocale(l)}>
              <Text style={[styles.chipText, locale === l && styles.chipTextActive]}>
                {l === "tr" ? "🇹🇷 Türkçe" : "🇬🇧 English"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <SectionTitle>{t.settings.timezone}</SectionTitle>
        <View style={styles.chipRow}>
          {TIMEZONES.map((tz) => (
            <TouchableOpacity key={tz.id} style={[styles.chip, timezone === tz.id && styles.chipActive]}
              onPress={() => selectTimezone(tz.id)}>
              <Text style={[styles.chipText, timezone === tz.id && styles.chipTextActive]}>{tz.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Surface variant="elevated" style={styles.panel}>
          <SettingRow label={t.settings.ttsBudget}>
            <Switch value={ttsBudget} onValueChange={toggleTtsBudget} trackColor={{ true: Colors.accent }} />
          </SettingRow>
          <SettingRow label={t.settings.biometric}>
            <Switch value={biometric} onValueChange={toggleBiometric} trackColor={{ true: Colors.accent }} />
          </SettingRow>
          <SettingRow label={t.settings.geofence}>
            <Switch value={geofence} onValueChange={toggleGeofence} trackColor={{ true: Colors.accent }} />
          </SettingRow>
        </Surface>

        <AssistantSetup />

        <SectionTitle>{t.settings.security}</SectionTitle>
        <PrimaryButton label={t.settings.changePin} onPress={() => setSecurityModal("pin")} variant="secondary" style={styles.actionBtn} />
        <PrimaryButton label={t.settings.changePassword} onPress={() => setSecurityModal("password")} variant="secondary" style={styles.actionBtn} />
        <PrimaryButton label={t.settings.deleteAccount} onPress={() => setSecurityModal("delete")} variant="danger" style={styles.actionBtn} />

        <SectionTitle>{t.settings.sync}</SectionTitle>
        <PrimaryButton
          label={`${syncing ? t.common.loading : t.settings.syncNow}${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
          onPress={handleSync}
          variant="secondary"
          disabled={syncing}
          loading={syncing}
          style={styles.actionBtn}
        />
        {pendingCount > 0 && (
          <Text style={styles.pendingHint}>{t.settings.pendingOps.replace("{count}", String(pendingCount))}</Text>
        )}

        <PrimaryButton label={t.settings.push} onPress={() => registerForPushNotifications()} variant="ghost" style={styles.actionBtn} />
        <PrimaryButton label={t.settings.viewNotifications} onPress={() => router.push("/notifications")} variant="ghost" style={styles.actionBtn} />
        <PrimaryButton label={t.settings.viewReceipts} onPress={() => router.push("/receipts")} variant="ghost" style={styles.actionBtn} />

        <SectionTitle>{t.settings.export}</SectionTitle>
        <PrimaryButton label={t.settings.exportPdf} onPress={() => handleExport("pdf")} variant="secondary" disabled={exporting} style={styles.actionBtn} />
        <PrimaryButton label={t.settings.exportExcel} onPress={() => handleExport("excel")} variant="secondary" disabled={exporting} style={styles.actionBtn} />

        <SectionTitle>{t.settings.about}</SectionTitle>
        <Text style={styles.versionLabel}>{t.settings.version}: 1.0.0</Text>
        <PrimaryButton
          label={t.settings.privacyPolicy}
          onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
          variant="ghost"
          style={styles.actionBtn}
        />

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>{t.settings.logout}</Text>
        </TouchableOpacity>
      </ScreenShell>

      <Modal visible={securityModal !== null} transparent animationType="slide" onRequestClose={closeSecurity}>
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {securityModal === "pin" ? t.settings.changePin
                : securityModal === "password" ? t.settings.changePassword
                  : t.settings.deleteAccount}
            </Text>
            {securityModal === "delete" && (
              <Text style={styles.modalHint}>{t.settings.deleteAccountConfirm}</Text>
            )}
            <InputField
              placeholder={
                securityModal === "pin" ? t.settings.currentPin
                  : securityModal === "delete" ? t.settings.currentPassword
                    : t.settings.currentPassword
              }
              secureTextEntry
              value={field1}
              onChangeText={setField1}
              keyboardType={securityModal === "pin" ? "number-pad" : "default"}
            />
            {securityModal !== "delete" && (
              <InputField
                placeholder={securityModal === "pin" ? t.settings.newPin : t.settings.newPassword}
                secureTextEntry
                value={field2}
                onChangeText={setField2}
                keyboardType={securityModal === "pin" ? "number-pad" : "default"}
              />
            )}
            <View style={styles.modalActions}>
              <TextLink label={t.common.cancel} onPress={closeSecurity} />
              <TextLink label={t.common.save} onPress={submitSecurity} />
            </View>
          </Surface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  chip: { flex: 1, minWidth: "45%", padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: "center", backgroundColor: Colors.card },
  chipActive: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 14 },
  chipTextActive: { color: Colors.accent, fontWeight: "600" },
  panel: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  label: { color: Colors.text, fontSize: 16 },
  actionBtn: { marginTop: Spacing.sm },
  versionLabel: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.sm },
  logoutBtn: { marginTop: Spacing.xl, marginBottom: Spacing.lg, padding: Spacing.md, alignItems: "center" },
  logoutText: { color: Colors.danger, fontWeight: "600" },
  pendingHint: { color: Colors.warning, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalHint: { color: Colors.textSecondary, marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
});
