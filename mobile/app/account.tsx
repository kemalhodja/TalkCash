import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Modal, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Stack, router } from "expo-router";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { FunnelProgressCard } from "@/components/FunnelProgressCard";
import { ErrorState } from "@/components/ErrorState";
import { InputField } from "@/components/ui/InputField";
import { ListRow } from "@/components/ui/ListRow";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from "@/constants/links";
import { useI18n } from "@/i18n";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { getLocalFunnelProgress } from "@/services/analytics";
import { api } from "@/services/api";
import { auth } from "@/services/auth";

export default function AccountScreen() {
  const { t } = useI18n();
  useRequireUnlock();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [funnel, setFunnel] = useState<{ events: Record<string, number> } | null>(null);
  const [localFunnel, setLocalFunnel] = useState<Record<string, boolean>>({});
  const [email, setEmail] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const [me, funnelData, local] = await Promise.all([
        api.getMe(),
        api.getAnalyticsFunnel(),
        getLocalFunnelProgress(),
      ]);
      setEmail(me.email || "");
      setFunnel(funnelData);
      setLocalFunnel(local);
    } catch (e: any) {
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => { load(); }, [load]);

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
        Alert.alert(t.settings.export, t.account.exportSuccess);
      };
      reader.readAsDataURL(blob);
    } catch (e: any) {
      Alert.alert(t.settings.export, e.message || t.common.error);
    } finally {
      setExporting(false);
    }
  };

  const startDelete = () => {
    setDeleteStep(1);
    setDeletePassword("");
    setDeleteConfirm("");
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteStep === 1) {
      if (deleteConfirm.trim().toUpperCase() !== t.account.deleteTypeWord.toUpperCase()) {
        Alert.alert(t.settings.deleteAccount, t.account.deleteTypeConfirm);
        return;
      }
      setDeleteStep(2);
      return;
    }
    if (!deletePassword.trim()) {
      Alert.alert(t.settings.deleteAccount, t.settings.deleteAccountConfirm);
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAccount(deletePassword);
      await auth.clear();
      setDeleteOpen(false);
      Alert.alert(t.settings.deleteAccount, t.settings.accountDeleted, [
        { text: t.login.login, onPress: () => router.replace("/login") },
      ]);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error && !funnel) return <ErrorState message={error} onRetry={load} />;

  const version = Constants.expoConfig?.version ?? "1.0.0";

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen options={{ title: t.account.title, headerTintColor: Colors.text, headerStyle: { backgroundColor: Colors.bg } }} />

      <SectionBlock title={t.account.profile} bare>
        <Surface variant="elevated" style={styles.panel}>
          <ListRow title={t.login.email} subtitle={email || t.common.noData} />
        </Surface>
      </SectionBlock>

      {funnel ? (
        <FunnelProgressCard events={funnel.events} local={localFunnel as any} />
      ) : null}

      <SectionBlock title={t.settings.dataAndPrivacy} bare>
        <Text style={styles.hint}>{t.settings.exportHint}</Text>
        <PrimaryButton
          label={t.settings.exportPdf}
          onPress={() => handleExport("pdf")}
          variant="secondary"
          loading={exporting}
          disabled={exporting}
          style={styles.btn}
        />
        <PrimaryButton
          label={t.settings.exportExcel}
          onPress={() => handleExport("excel")}
          variant="secondary"
          disabled={exporting}
          style={styles.btn}
        />
        <PrimaryButton label={t.settings.privacyPolicy} onPress={() => Linking.openURL(PRIVACY_POLICY_URL)} variant="ghost" style={styles.btn} />
        <PrimaryButton label={t.settings.termsOfService} onPress={() => Linking.openURL(TERMS_OF_SERVICE_URL)} variant="ghost" style={styles.btn} />
      </SectionBlock>

      <SectionBlock title={t.settings.account} bare>
        <Surface variant="default" style={styles.dangerPanel}>
          <Text style={styles.dangerHint}>{t.settings.deleteAccountDataHint}</Text>
          <PrimaryButton label={t.settings.deleteAccount} onPress={startDelete} variant="danger" />
        </Surface>
        <Text style={styles.version}>{t.settings.version}: {version}</Text>
      </SectionBlock>

      <Modal visible={deleteOpen} transparent animationType="slide" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.settings.deleteAccount}</Text>
            {deleteStep === 1 ? (
              <>
                <Text style={styles.modalHint}>{t.account.deleteStep1}</Text>
                <InputField
                  placeholder={t.account.deleteTypePlaceholder}
                  value={deleteConfirm}
                  onChangeText={setDeleteConfirm}
                  autoCapitalize="characters"
                />
              </>
            ) : (
              <>
                <Text style={styles.modalHint}>{t.settings.deleteAccountConfirm}</Text>
                <InputField
                  placeholder={t.login.password}
                  value={deletePassword}
                  onChangeText={setDeletePassword}
                  secureTextEntry
                />
              </>
            )}
            <View style={styles.modalActions}>
              <PrimaryButton label={t.common.cancel} onPress={() => setDeleteOpen(false)} variant="ghost" style={styles.modalBtn} />
              <PrimaryButton
                label={deleteStep === 1 ? t.common.confirm : t.settings.deleteAccount}
                onPress={confirmDelete}
                variant="danger"
                loading={deleting}
                disabled={deleting}
                style={styles.modalBtn}
              />
            </View>
          </Surface>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.sm },
  hint: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.sm, paddingHorizontal: Spacing.xs },
  btn: { marginBottom: Spacing.sm },
  dangerPanel: { padding: Spacing.md, borderColor: Colors.danger, borderWidth: 1 },
  dangerHint: { color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  version: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.lg, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modalCard: { padding: Spacing.lg, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalTitle: { color: Colors.text, fontSize: 20, fontWeight: "800", marginBottom: Spacing.sm },
  modalHint: { color: Colors.textSecondary, marginBottom: Spacing.md, lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  modalBtn: { flex: 1 },
});
