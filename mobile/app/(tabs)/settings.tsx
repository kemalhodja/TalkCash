import { useCallback, useEffect, useState } from "react";
import {
  Alert, Linking, Modal, StyleSheet, Text, View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { AssistantSetup } from "@/components/AssistantSetup";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { PaywallCard } from "@/components/PaywallCard";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { ListRow } from "@/components/ui/ListRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { SettingSwitchRow } from "@/components/ui/SettingSwitchRow";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL, FEEDBACK_MAILTO } from "@/constants/links";
import { useI18n, Locale } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { getAppEnv } from "@/services/config";
import { isGeofencingEnabled, restoreGeofencingIfEnabled, setupGeofencing, stopGeofencing } from "@/services/geofencing";
import { registerForPushNotifications } from "@/services/notifications";
import { flushQueue, getPendingCount } from "@/services/offlineQueue";
import { getPendingReceiptScanCount } from "@/services/receiptQueue";
import { getPremiumStatus, PremiumStatus } from "@/services/premium";
import { isStoreBillingSupported, restoreSubscriptions } from "@/services/storeBilling";
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

export default function SettingsScreen() {
  const { t, locale, setLocale } = useI18n();
  const [biometric, setBiometric] = useState(false);
  const [geofence, setGeofence] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ttsBudget, setTtsBudget] = useState(true);
  const [timezone, setTimezone] = useState("Europe/Istanbul");
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingReceipts, setPendingReceipts] = useState(0);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null);
  const [persona, setPersona] = useState<"default" | "angry_mom" | "street_smart">("default");
  const [securityModal, setSecurityModal] = useState<"pin" | "password" | "delete" | null>(null);
  const [field1, setField1] = useState("");
  const [field2, setField2] = useState("");

  const refreshPending = useCallback(() => {
    getPendingCount().then(setPendingCount);
    getPendingReceiptScanCount().then(setPendingReceipts);
  }, []);

  useEffect(() => {
    isBudgetTtsEnabled().then(setTtsBudget);
    api.getMe().then((u) => {
      if (u.timezone) setTimezone(u.timezone);
      if (typeof u.biometric_enabled === "boolean") setBiometric(u.biometric_enabled);
      if (u.assistant_persona) setPersona(u.assistant_persona);
    }).catch(() => {});
    isGeofencingEnabled().then(setGeofence).catch(() => {});
    refreshPending();
    getPremiumStatus().then(setPremiumStatus).catch(() => {});
  }, [refreshPending]);

  useFocusEffect(
    useCallback(() => {
      refreshPending();
    }, [refreshPending]),
  );

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
      refreshPending();
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

  const handleDemoSeed = async () => {
    setSeedingDemo(true);
    try {
      const res = await api.seedDemoData();
      Alert.alert(
        t.onboarding.demoTitle,
        res.status === "seeded" ? t.onboarding.demoLoaded : t.onboarding.demoSkipped,
      );
    } catch {
      Alert.alert(t.onboarding.demoTitle, t.onboarding.demoFailed);
    } finally {
      setSeedingDemo(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      await restoreSubscriptions();
      setPremiumStatus(await getPremiumStatus(true));
      Alert.alert(t.premium.title, t.premium.restored);
    } catch (e: any) {
      Alert.alert(t.premium.title, e.message?.includes("No active") ? t.premium.noSubscriptions : (e.message || t.common.error));
    }
  };

  return (
    <>
      <ScreenShell ambient="subtle">
        <ScreenHeader title={t.settings.title} subtitle={`${t.settings.appEnv}: ${getAppEnv()}`} />

        <ApiConnectionCard />

        <SectionBlock title={t.premium.title} bare>
          <Surface variant="elevated" style={styles.premiumSummary}>
            <Text style={styles.premiumPlan}>{(premiumStatus?.plan || "free").toUpperCase()}</Text>
            <Text style={styles.premiumMeta}>{t.premium.usage}: AI {premiumStatus?.entitlements.ai_coach?.used ?? 0}/{premiumStatus?.entitlements.ai_coach?.limit ?? "∞"}</Text>
          </Surface>
          {premiumStatus?.plan === "free" || !premiumStatus ? (
            <PaywallCard onUpgraded={() => getPremiumStatus(true).then(setPremiumStatus)} />
          ) : null}
          {isStoreBillingSupported() ? (
            <>
              <PrimaryButton
                label={t.premium.restorePurchases}
                onPress={handleRestorePurchases}
                variant="ghost"
                style={styles.actionBtn}
              />
              <PrimaryButton
                label={t.premium.manageSubscriptions}
                onPress={() => Linking.openURL("https://play.google.com/store/account/subscriptions?package=io.talkcash.app")}
                variant="ghost"
                style={styles.actionBtn}
              />
            </>
          ) : null}
        </SectionBlock>

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

        <SectionBlock title={t.settings.preferences} variant="elevated">
          <SettingSwitchRow label={t.settings.ttsBudget} value={ttsBudget} onValueChange={toggleTtsBudget} />
          <SettingSwitchRow label={t.settings.biometric} value={biometric} onValueChange={toggleBiometric} />
          <SettingSwitchRow label={t.settings.geofence} value={geofence} onValueChange={toggleGeofence} />
        </SectionBlock>

        <SectionBlock title={t.persona.title} bare>
          <Text style={styles.demoHint}>{t.persona.hint}</Text>
          <ChipPicker
            options={[
              { id: "default", label: t.persona.default },
              { id: "angry_mom", label: t.persona.angryMom },
              { id: "street_smart", label: t.persona.streetSmart },
            ]}
            value={persona}
            onChange={async (id) => {
              const prev = persona;
              const next = id as typeof persona;
              setPersona(next);
              try {
                await api.setAssistantPersona(next);
                await auth.updateUser({ assistantPersona: next });
              } catch (e: any) {
                setPersona(prev);
                Alert.alert(t.common.error, e.message || t.common.error);
              }
            }}
          />
        </SectionBlock>

        <SectionBlock title={t.quickVoice.title} bare>
          <Text style={styles.demoHint}>{t.quickVoice.hint}</Text>
          <Text style={styles.demoHint}>{t.quickVoice.tileHint}</Text>
          <PrimaryButton label={t.quickVoice.title} onPress={() => router.push("/quick-voice?hold=1")} variant="secondary" style={styles.actionBtn} />
        </SectionBlock>

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
            testID="settings-sync"
          />
          {pendingCount > 0 && (
            <Text style={styles.pendingHint}>{t.settings.pendingOps.replace("{count}", String(pendingCount))}</Text>
          )}
          {pendingReceipts > 0 && (
            <Text style={styles.pendingHint}>{t.settings.pendingReceiptScans.replace("{count}", String(pendingReceipts))}</Text>
          )}
        </SectionBlock>

        <SectionBlock title={t.onboarding.demoTitle} bare>
          <Text style={styles.demoHint}>{t.settings.loadDemoHint}</Text>
          <PrimaryButton
            label={t.settings.loadDemo}
            onPress={handleDemoSeed}
            variant="secondary"
            loading={seedingDemo}
            disabled={seedingDemo}
            style={styles.actionBtn}
            testID="settings-load-demo"
          />
        </SectionBlock>

        <SectionBlock title={t.settings.notifications} bare>
          <PrimaryButton label={t.settings.push} onPress={() => registerForPushNotifications()} variant="ghost" style={styles.actionBtn} />
          <PrimaryButton label={t.settings.viewNotifications} onPress={() => router.push("/notifications")} variant="ghost" style={styles.actionBtn} />
          <PrimaryButton label={t.notificationPrefs.title} onPress={() => router.push("/notification-settings")} variant="ghost" style={styles.actionBtn} />
          <PrimaryButton label={t.roadmap.title} onPress={() => router.push("/roadmap")} variant="ghost" style={styles.actionBtn} testID="settings-roadmap" />
        </SectionBlock>

        <SectionBlock title={t.microSavings.settingsTitle} bare>
          <PrimaryButton
            label={t.microSavings.settingsTitle}
            onPress={() => router.push("/micro-savings-settings")}
            variant="secondary"
            style={styles.actionBtn}
          />
        </SectionBlock>

        <SectionBlock title={t.settings.viewReceipts} bare>
          <PrimaryButton label={t.settings.viewReceipts} onPress={() => router.push("/receipts")} variant="ghost" style={styles.actionBtn} />
        </SectionBlock>

        <SectionBlock title={t.workspaces.title} bare>
          <PrimaryButton label={t.workspaces.title} onPress={() => router.push("/workspaces")} variant="secondary" style={styles.actionBtn} />
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
          <PrimaryButton
            label={t.settings.termsOfService}
            onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)}
            variant="ghost"
            style={styles.actionBtn}
          />
          <PrimaryButton
            label={t.settings.sendFeedback}
            onPress={() => Linking.openURL(FEEDBACK_MAILTO)}
            variant="ghost"
            style={styles.actionBtn}
          />
        </SectionBlock>

        <SectionBlock title={t.settings.account} bare>
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
              <Text style={styles.modalHint}>{t.settings.deleteAccountDataHint}</Text>
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
  actionBtn: { marginTop: Spacing.sm },
  premiumSummary: { padding: Spacing.md, marginBottom: Spacing.sm },
  premiumPlan: { color: Colors.accent, fontSize: 22, fontWeight: "800" },
  premiumMeta: { color: Colors.textSecondary, marginTop: 4 },
  pendingHint: { color: Colors.warning, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
  demoHint: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalHint: { color: Colors.textSecondary, marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
});
