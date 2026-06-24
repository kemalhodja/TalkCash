import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { parseShareUrl } from "@/services/deepLink";
import { scheduleSubscriptionReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { playExpenseFeedback } from "@/utils/voiceAlert";
import { formatMoney } from "@/utils/format";
import { parseBankSms } from "@/utils/smsExpenseParser";
import * as Linking from "expo-linking";

export default function ShareImportScreen() {
  const { t, locale } = useI18n();
  useRequireUnlock();
  const params = useLocalSearchParams<{ text?: string; source?: string }>();
  const [loading, setLoading] = useState(true);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [error, setError] = useState("");

  const openConfirmation = (message: string, parsed: any) => {
    setConfirmMessage(message);
    setParsedData(parsed);
    setConfirmVisible(true);
    setError("");
  };

  const processText = async (text: string) => {
    try {
      const result = await api.parseSms(text);
      openConfirmation(result.message, result.parsed);
      return;
    } catch {
      /* regex fallback */
    }
    const smsDraft = parseBankSms(text);
    if (smsDraft) {
      openConfirmation(
        t.input.smsPasteConfirm.replace("{amount}", formatMoney(smsDraft.amount, locale)),
        {
          intent: "add_expense",
          amount: smsDraft.amount,
          category: "Genel",
          description: smsDraft.description,
          store_name: smsDraft.merchant || "Genel",
          place: smsDraft.merchant || "",
          raw_text: text,
        },
      );
      return;
    }
    const result = await api.parseText(text, false);
    openConfirmation(result.message, result.parsed);
  };

  useEffect(() => {
    (async () => {
      let text = typeof params.text === "string" ? params.text : "";
      if (!text) {
        const initial = await Linking.getInitialURL();
        if (initial) {
          const share = parseShareUrl(initial);
          text = share?.text || "";
        }
      }
      if (!text.trim()) {
        setError(t.share.empty);
        setLoading(false);
        return;
      }
      try {
        await processText(text.trim());
      } catch (e: any) {
        setError(e.message || t.input.parseError);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleConfirm = async (confirmed?: any) => {
    const payload = confirmed ?? parsedData;
    setConfirmVisible(false);
    if (!payload) return;
    try {
      const res: any = await api.executeAction(payload, true);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.input.queuedOffline);
      } else if (payload.intent === "add_expense") {
        await speakBudgetAlertsAfterSpend(locale);
        playExpenseFeedback(res, locale);
        if (res?.result?.subscription?.next_billing_date && res?.result?.subscription?.subscription_name) {
          await scheduleSubscriptionReminder(
            res.result.subscription.subscription_name,
            Number(res.result.amount || payload.amount || 0),
            new Date(res.result.subscription.next_billing_date),
            locale,
          );
        }
        Alert.alert(t.share.success, t.share.expenseSaved);
      } else {
        Alert.alert(t.share.success, t.assistant.commandDone);
      }
      router.replace("/(tabs)/transactions");
    } catch (e: any) {
      if (e instanceof ApiError) setError(e.message);
      else setError(t.common.error);
    }
  };

  if (loading) return <LoadingScreen hint={t.share.processing} />;

  return (
    <View style={styles.container}>
      {error ? (
        <Surface variant="glass" style={styles.errorCard}>
          <Text style={styles.error}>{error}</Text>
        </Surface>
      ) : null}
      <ConfirmationCard
        visible={confirmVisible}
        message={confirmMessage}
        parsed={parsedData}
        onConfirm={handleConfirm}
        onCancel={() => router.replace("/(tabs)/input")}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md, justifyContent: "center" },
  errorCard: { padding: Spacing.lg, alignItems: "center" },
  error: { color: Colors.danger, textAlign: "center" },
});
