import { useEffect, useState } from "react";
import {
  Alert, Linking, Modal, StyleSheet, Switch, Text, View,
} from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { AssistantSetup } from "@/components/AssistantSetup";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { ListRow } from "@/components/ui/ListRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { PRIVACY_POLICY_URL } from "@/constants/links";
import { useI18n, Locale } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { getAppEnv } from "@/services/config";
import { isGeofencingEnabled, restoreGeofencingIfEnabled, setupGeofencing, stopGeofencing } from "@/services/geofencing";
import { registerForPushNotifications } from "@/services/notifications";
import { flushQueue, getPendingCount } from "@/services/offlineQueue";
import { pullAndCacheSnapshot } from "@/services/syncCache";
import { isBudgetTtsEnabled, setBudgetTtsEnabled } from "@/services/speech";

const TIMEZONES = [
  { id: "Europe/Istanbul", label: "🇹🇷 Istanbul" },
  { id: "Europe/London", label: "🇬🇧 London" },
  { id: "America/New_York", label: "🇺🇸 New York" },
  { id: "Asia/Tokyo", label: "🇯🇵 Tokyo" },
];

const LANGUAGE_OPTIONS = [
  { id: "tr", label: "🇹🇷 Türkçe" },
  { id: "en", label: "🇬🇧 English" },
];

function SettingSwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  return (
    <ListRow
      title={label}
      trailing={<Switch value={value} onValueChange={onValueChange} trackColor={{ true: Colors.accent }} />}
    />
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
      await pullAndCacheSnapshot();
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

  const handleLogout = () => {
    const doLogout = async () => {
      await api.logout();
      router.replace("/login");
    };
    if (pendingCount > 0) {
      Alert.alert(
        t.settings.logoutPendingTitle,
        t.settings.logoutPendingMessage.replace("{count}", String(pendingCount)),
        [
          { text: t.common.cancel, style: "cancel" },
          { text: t.settings.logoutConfirm, style: "destructive", onPress: doLogout },
        ],
      );
      return;
    }
    doLogout();
  };

  return (
    <>
      <ScreenShell ambient="subtle">
        <ScreenHeader title={t.settings.title} subtitle={`${t.settings.appEnv}: ${getAppEnv()}`} />

        <ApiConnectionCard />

        <SectionBlock title={t.settings.language} bare>
          <ChipPicker
            options={LANGUAGE_OPTIONS}
            value={locale}
            onChange={(id) => setLocale(id as Locale)}
          />
        </SectionBlock>

        <SectionBlock title={t.settings.timezone} bare>
          <ChipPicker
            options={TIMEZONES}
            value={timezone}
            onChange={selectTimezone}
          />
        </SectionBlock>

        <Surface variant="elevated" style={styles.prefsPanel}>
          <SettingSwitchRow label={t.settings.ttsBudget} value={ttsBudget} onValueChange={toggleTtsBudget} />
          <SettingSwitchRow label={t.settings.biometric} value={biometric} onValueChange={toggleBiometric} />
          <SettingSwitchRow label={t.settings.geofence} value={geofence} onValueChange={toggleGeofence} />
        </Surface>

        <AssistantSetup />

        <SectionBlock title={t.settings.security} bare>
          <PrimaryButton label={t.settings.changePin} onPress={() => setSecurityModal("pin")} variant="secondary" style={styles.actionBtn} />
          <PrimaryButton label={t.settings.changePassword} onPress={() => setSecurityModal("password")} variant="secondary" style={styles.actionBtn} />
          <PrimaryButton label={t.settings.deleteAccount} onPress={() => setSecurityModal("delete")} variant="danger" style={styles.actionBtn} />
        </SectionBlock>

        <SectionBlock title={t.settings.sync} bare>
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
        </SectionBlock>

        <SectionBlock title={t.settings.export} bare>
          <PrimaryButton label={t.settings.exportPdf} onPress={() => handleExport("pdf")} variant="secondary" disabled={exporting} style={styles.actionBtn} />
          <PrimaryButton label={t.settings.exportExcel} onPress={() => handleExport("excel")} variant="secondary" disabled={exporting} style={styles.actionBtn} />
        </SectionBlock>

        <SectionBlock title={t.settings.about} bare>
          <ListRow title={`${t.settings.version}: 1.0.0`} />
          <PrimaryButton
            label={t.settings.privacyPolicy}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            variant="ghost"
            style={styles.actionBtn}
          />
          <PrimaryButton label={t.settings.logout} onPress={handleLogout} variant="danger" style={styles.actionBtn} />
        </SectionBlock>
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
  prefsPanel: { paddingHorizontal: Spacing.sm, marginBottom: Spacing.sm },
  actionBtn: { marginTop: Spacing.sm },
  pendingHint: { color: Colors.warning, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalHint: { color: Colors.textSecondary, marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
});
