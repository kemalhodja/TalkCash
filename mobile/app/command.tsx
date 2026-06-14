import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { PayBillModal } from "@/components/PayBillModal";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { parseAssistantUrl, storePendingAssistant, type AssistantParams } from "@/services/assistant";
import { auth } from "@/services/auth";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { scheduleAgendaReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";

export default function AssistantCommandScreen() {
  const { t, locale } = useI18n();
  useRequireUnlock();
  const params = useLocalSearchParams<{ text?: string; confirm?: string; source?: string }>();
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [payModal, setPayModal] = useState<{ title: string } | null>(null);
  const [duplicateMsg, setDuplicateMsg] = useState("");
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

  const finishSuccess = (assistant?: AssistantParams) => {
    Alert.alert(
      t.assistant.success,
      assistant?.source === "siri" || assistant?.source === "google"
        ? t.assistant.savedViaAssistant.replace("{source}", sourceLabel || t.assistant.viaAssistant)
        : t.assistant.commandDone,
    );
    router.replace("/(tabs)/input");
  };

  const executeParsed = async (parsed: any, assistant?: AssistantParams, force = false) => {
    if (parsed?.intent === "mark_paid") {
      setPayModal({ title: parsed.description || parsed.raw_text || "" });
      return;
    }
    const payload = force ? { ...parsed, force: true } : parsed;
    const res: any = await api.executeAction(payload, true);
    if (res?.status === "queued") {
      Alert.alert(t.common.confirm, t.input.queuedOffline);
      router.replace("/(tabs)/input");
      return;
    }
    if (parsed?.intent === "add_bill" && res?.result?.due_date) {
      await scheduleAgendaReminder(
        res.result.title || parsed.description || "Fatura",
        res.result.amount || parsed.amount || 0,
        new Date(res.result.due_date),
        locale,
      );
    }
    if (parsed?.intent === "add_expense") {
      await speakBudgetAlertsAfterSpend(locale);
    }
    if (parsed?.receipt_id && parsed?.amount) {
      const receiptTotal = parsed.receipt_total_amount ?? parsed.amount;
      await api.verifyReceipt(parsed.amount, receiptTotal, parsed.receipt_id);
    }
    finishSuccess(assistant);
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
      if (e instanceof ApiError && e.status === 409 && parsedData?.intent === "add_bill") {
        setDuplicateMsg(e.message);
        return;
      }
      setError(e.message);
    }
  };

  if (loading) {
    return <LoadingScreen hint={t.assistant.processing} />;
  }

  return (
    <View style={styles.container}>
      {sourceLabel ? (
        <Surface variant="accent" style={styles.sourceCard}>
          <Text style={styles.source}>{sourceLabel}</Text>
        </Surface>
      ) : null}
      {error ? (
        <Surface variant="glass" style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
        </Surface>
      ) : null}
      <ConfirmationCard visible={confirmVisible} message={confirmMessage}
        onConfirm={handleConfirm} onCancel={() => router.replace("/(tabs)")} />
      <DuplicateBillDialog
        visible={!!duplicateMsg}
        message={duplicateMsg}
        onConfirm={async () => {
          setDuplicateMsg("");
          if (!parsedData) return;
          try {
            await executeParsed(parsedData, undefined, true);
          } catch (e: any) {
            setError(e.message);
          }
        }}
        onCancel={() => { setDuplicateMsg(""); router.replace("/(tabs)"); }}
      />
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
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md, justifyContent: "center" },
  sourceCard: { padding: Spacing.md, marginBottom: Spacing.md, alignItems: "center" },
  source: { color: Colors.accent, fontSize: 13, fontWeight: "600" },
  errorCard: { padding: Spacing.lg, alignItems: "center" },
  error: { color: Colors.danger, textAlign: "center" },
});
