import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { PayBillModal } from "@/components/PayBillModal";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { parseAssistantUrl, storePendingAssistant, type AssistantParams } from "@/services/assistant";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import * as Linking from "expo-linking";

export default function AssistantCommandScreen() {
  const { t, locale } = useI18n();
  const params = useLocalSearchParams<{ text?: string; confirm?: string; source?: string }>();
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [payModal, setPayModal] = useState<{ title: string } | null>(null);
  const [error, setError] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");

  const resolveParams = (): AssistantParams | null => {
    if (params.text) {
      return {
        text: String(params.text),
        confirm: params.confirm === "true",
        source: (params.source as AssistantParams["source"]) || "unknown",
      };
    }
    return null;
  };

  const runCommand = async (assistant: AssistantParams) => {
    setSourceLabel(
      assistant.source === "siri" ? t.assistant.viaSiri
        : assistant.source === "google" ? t.assistant.viaGoogle
          : assistant.source === "shortcut" ? t.assistant.viaShortcut
            : "",
    );

    try {
      const result = await api.parseText(assistant.text, false);
      if (assistant.confirm) {
        await executeParsed(result.parsed, assistant);
        return;
      }
      setConfirmMessage(result.message);
      setParsedData(result.parsed);
      setConfirmVisible(true);
    } catch (e: any) {
      setError(e.message || t.input.parseError);
    } finally {
      setLoading(false);
    }
  };

  const executeParsed = async (parsed: any, assistant?: AssistantParams) => {
    if (parsed?.intent === "mark_paid") {
      setPayModal({ title: parsed.description || parsed.raw_text || "" });
      return;
    }
    await api.executeAction(parsed, true);
    if (parsed?.intent === "add_expense") {
      await speakBudgetAlertsAfterSpend(locale);
    }
    if (parsed?.receipt_id && parsed?.amount) {
      const receiptTotal = parsed.receipt_total_amount ?? parsed.amount;
      await api.verifyReceipt(parsed.amount, receiptTotal, parsed.receipt_id);
    }
    Alert.alert(
      t.assistant.success,
      assistant?.source === "siri" || assistant?.source === "google"
        ? t.assistant.savedViaAssistant.replace("{source}", sourceLabel || t.assistant.viaAssistant)
        : t.assistant.commandDone,
    );
    router.replace("/(tabs)/input");
  };

  useEffect(() => {
    (async () => {
      const user = await auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      if (!auth.isUnlocked()) {
        const assistant = resolveParams();
        if (assistant) await storePendingAssistant(assistant);
        router.replace("/lock");
        return;
      }

      let assistant = resolveParams();
      if (!assistant) {
        const initial = await Linking.getInitialURL();
        if (initial) assistant = parseAssistantUrl(initial);
      }
      if (!assistant?.text) {
        setError(t.assistant.noCommand);
        setLoading(false);
        return;
      }
      await runCommand(assistant);
    })();
  }, []);

  const handleConfirm = async () => {
    setConfirmVisible(false);
    if (!parsedData) return;
    try {
      await executeParsed(parsedData);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.accent} size="large" />
        <Text style={styles.hint}>{t.assistant.processing}</Text>
        {sourceLabel ? <Text style={styles.source}>{sourceLabel}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ConfirmationCard visible={confirmVisible} message={confirmMessage}
        onConfirm={handleConfirm} onCancel={() => router.replace("/(tabs)")} />
      <PayBillModal
        visible={!!payModal}
        billTitle={payModal?.title || ""}
        amount={0}
        onConfirm={async (walletId) => {
          if (payModal) {
            try {
              await api.markPaid(payModal.title, walletId);
              Alert.alert(t.assistant.success, t.assistant.commandDone);
              router.replace("/(tabs)/agenda");
            } catch (e: any) { setError(e.message); }
          }
          setPayModal(null);
        }}
        onCancel={() => { setPayModal(null); router.replace("/(tabs)"); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  hint: { color: Colors.textSecondary, marginTop: Spacing.md },
  source: { color: Colors.accent, marginTop: Spacing.sm, fontSize: 13 },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.xl },
});
