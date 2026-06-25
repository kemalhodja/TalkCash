import { useEffect, useRef, useState } from "react";
import { Alert, Modal, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { PayBillModal } from "@/components/PayBillModal";
import { NumericKeypad } from "@/components/NumericKeypad";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import { ReceiptReviewModal, type ReceiptScanData } from "@/components/ReceiptReviewModal";
import { VoiceInput } from "@/components/VoiceInput";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder, scheduleSubscriptionReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { formatMoney } from "@/utils/format";
import { track } from "@/services/analytics";
import { parsePositiveAmount } from "@/utils/amount";
import { extractVoiceAlert, playExpenseFeedback, playVoiceAlert } from "@/utils/voiceAlert";
import { extractSwapNudge, type SwapNudge } from "@/utils/swapNudge";
import { extractRoundUp, type RoundUpNudge } from "@/utils/roundUp";
import { MicroSavingsNudges } from "@/components/MicroSavingsNudges";
import { parseBankSms } from "@/utils/smsExpenseParser";
import * as Clipboard from "expo-clipboard";
import { consumePendingInputVoice } from "@/hooks/useAssistantLinking";
import * as Speech from "expo-speech";
import {
  isSimpleInputMode,
  markFirstExpenseAdded,
} from "@/services/firstRun";

export default function InputScreen() {
  const { t, locale } = useI18n();
  const voiceParams = useLocalSearchParams<{ whisper?: string; hold?: string }>();
  const [text, setText] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whisperMode, setWhisperMode] = useState(false);
  const [holdToRecord, setHoldToRecord] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");
  const [payModal, setPayModal] = useState<{ title: string } | null>(null);
  const [slashMode, setSlashMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [quickExpenseOpen, setQuickExpenseOpen] = useState(false);
  const [quickAmount, setQuickAmount] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [pendingSwap, setPendingSwap] = useState<SwapNudge | null>(null);
  const [pendingRoundUp, setPendingRoundUp] = useState<RoundUpNudge | null>(null);
  const [receiptReview, setReceiptReview] = useState<ReceiptScanData | null>(null);
  const [simpleMode, setSimpleMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isSimpleInputMode().then(setSimpleMode);
  }, []);

  useEffect(() => {
    api.getInputCapabilities()
      .then((c) => setAiAvailable(Boolean(c.voice_available)))
      .catch(() => setAiAvailable(false));
  }, []);

  useEffect(() => {
    (async () => {
      const pending = await consumePendingInputVoice();
      if (voiceParams.whisper === "1" || pending?.whisper) setWhisperMode(true);
      if (voiceParams.hold === "1" || pending?.hold) setHoldToRecord(true);
    })();
  }, [voiceParams.hold, voiceParams.whisper]);

  const slashHints = locale === "en"
    ? ["/150 coffee bank", "/500 transfer bank cash", "/bill electricity 200"]
    : ["/150 kahve banka", "/500 transfer banka nakit", "/fatura elektrik 200"];

  const showConfirmation = (message: string, parsed: any) => {
    setConfirmMessage(message);
    setParsedData(parsed);
    setConfirmVisible(true);
    setError("");
  };

  const handleTextSubmit = async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const isSlash = text.trim().startsWith("/");
      const result = isSlash
        ? await api.parseSlash(text.trim())
        : await api.parseText(text, whisperMode);
      if (result?.parsed?.intent === "easter_egg") {
        handleVoiceResult(text, result);
        return;
      }
      if (result?.parsed?.intent === "manual_edit" || result?.parsed?.parse_failed) {
        showConfirmation(result.message || t.input.manualEditTitle, result.parsed);
        return;
      }
      showConfirmation(result.message, result.parsed);
    } catch (e: any) {
      setError(e.message || t.input.parseError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceResult = (voiceText: string, result?: any) => {
    if (result?.parsed?.intent === "easter_egg") {
      const message = result.parsed.description || result.message || t.input.easterEggTitle;
      Speech.speak(message, { language: locale === "en" ? "en-US" : "tr-TR" });
      Alert.alert(t.input.easterEggTitle, message);
      setText("");
      setError("");
      return;
    }
    if (result?.parsed?.intent === "manual_edit" || result?.parsed?.parse_failed) {
      showConfirmation(result.message || t.input.manualEditTitle, result.parsed);
      setText("");
      return;
    }
    if (result?.status === "needs_confirmation" && result?.parsed) {
      showConfirmation(result.message || t.input.manualEditTitle, result.parsed);
      setText("");
      return;
    }
    if (result?.status === "success" && result?.result) {
      track("voice_expense_saved");
      playExpenseFeedback(result, locale);
      setText("");
      setError("");
      return;
    }
    if (result?.parsed) showConfirmation(result.message, result.parsed);
    else if (result?.message) showConfirmation(result.message, result.parsed);
  };

  const handleConfirm = async (confirmed?: any) => {
    const payload = confirmed ?? parsedData;
    setConfirmVisible(false);
    if (payload?.intent === "mark_paid") {
      const title = payload.description || payload.raw_text || "";
      setPayModal({ title });
      return;
    }
    if (payload) {
      setIsSubmitting(true);
      try {
        const res: any = await api.executeAction(payload, true);
        if (res?.status === "queued") {
          Alert.alert(t.common.confirm, t.input.queuedOffline);
          setText("");
          setParsedData(null);
          return;
        }
        if (payload.intent === "add_bill" && res?.result?.due_date) {
          await scheduleAgendaReminder(
            res.result.title || payload.description || t.agenda.defaultBillName,
            res.result.amount || payload.amount || 0,
            new Date(res.result.due_date),
            locale,
          );
        }
        if (payload.intent === "add_expense") {
          await markFirstExpenseAdded();
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
          const swap = extractSwapNudge(res);
          if (swap) setPendingSwap(swap);
          const roundUp = extractRoundUp(res);
          if (roundUp) setPendingRoundUp(roundUp);
        }
        if (payload.receipt_id && payload.amount) {
          const receiptTotal = payload.receipt_total_amount ?? payload.receipt_total ?? payload.amount;
          const { verified, receipt_amount, transaction_amount } = await api.verifyReceipt(
            payload.amount, receiptTotal, payload.receipt_id,
          );
          const mismatchDetail = !verified && receipt_amount != null
            ? t.scanner.mismatchDetail
                .replace("{receipt}", formatMoney(Number(receipt_amount), locale))
                .replace("{tx}", formatMoney(Number(transaction_amount ?? payload.amount), locale))
            : undefined;
          Alert.alert(
            verified ? t.scanner.verified : t.scanner.mismatch,
            verified ? t.agenda.receiptLinked : mismatchDetail,
          );
        }
        setText("");
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 409 && payload?.intent === "add_bill") {
          setDuplicateMsg(e.message);
          return;
        }
        setError(e.message);
      } finally { setIsSubmitting(false); }
    }
    setParsedData(null);
  };

  const handleReceiptReviewed = async (data: ReceiptScanData, action: "expense" | "shopping") => {
    setReceiptReview(null);
    if (data.queued) return;
    try {
      if (data.receipt_id && (data.merchant || data.total_amount != null)) {
        await api.updateReceipt(data.receipt_id, {
          merchant: data.merchant,
          total_amount: data.total_amount ?? undefined,
        });
      }
      if (action === "shopping") {
        const res: any = await api.importReceiptToShopping(data.receipt_id!);
        Alert.alert(t.common.confirm, t.scanner.itemsImported.replace("{count}", String(res.added)));
        return;
      }
      showConfirmation(
        t.input.receiptConfirm
          .replace("{amount}", formatMoney(Number(data.total_amount) || 0, locale))
          .replace("{merchant}", data.merchant || t.input.receipt),
        {
          intent: "add_expense",
          amount: data.total_amount,
          category: data.category || data.suggested_category || "Genel",
          description: data.merchant,
          receipt_id: data.receipt_id,
          receipt_total_amount: data.total_amount,
        },
      );
    } catch (e: any) {
      setError(e.message || t.common.error);
    }
  };

  const handleBillReminderFromReceipt = async (data: ReceiptScanData) => {
    setReceiptReview(null);
    if (!data.due_date) return;
    try {
      if (data.receipt_id && (data.merchant || data.total_amount != null)) {
        await api.updateReceipt(data.receipt_id, {
          merchant: data.merchant,
          total_amount: data.total_amount ?? undefined,
        });
      }
      const title = data.merchant?.trim() || t.agenda.defaultBillName;
      const amount = Number(data.total_amount) || 0;
      const res: any = await api.addBill(title, amount, data.due_date);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.input.queuedOffline);
        return;
      }
      await scheduleAgendaReminder(title, amount, new Date(data.due_date), locale);
      Alert.alert(t.common.confirm, t.scanner.billReminderCreated);
    } catch (e: any) {
      setError(e.message || t.common.error);
    }
  };

  const handleTextChange = (val: string) => {
    setText(val);
    setSlashMode(val.startsWith("/"));
    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current);
    if (val.length < 2) {
      setSuggestions([]);
      return;
    }
    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await api.autocomplete(val);
        setSuggestions(res.suggestions);
      } catch {
        setSuggestions([]);
      }
    }, 350);
  };

  const submitQuickExpense = async () => {
    const amount = parsePositiveAmount(quickAmount);
    if (!amount) {
      setError(t.common.invalidAmount);
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res: any = await api.executeAction({
        intent: "add_expense",
        amount,
        category: "Genel",
        description: quickDesc.trim() || t.input.quickExpenseDefault,
        wallet_name: "Nakit",
      }, true);
      track("quick_expense_added");
      await markFirstExpenseAdded();
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.input.queuedOffline);
      } else {
        await speakBudgetAlertsAfterSpend(locale);
        playExpenseFeedback(res, locale);
        const swap = extractSwapNudge(res);
        if (swap) setPendingSwap(swap);
        const roundUp = extractRoundUp(res);
        if (roundUp) setPendingRoundUp(roundUp);
        if (!swap && !roundUp) Alert.alert(t.common.confirm, t.input.quickExpenseSaved);
      }
      setQuickExpenseOpen(false);
      setQuickAmount("");
      setQuickDesc("");
    } catch (e: any) {
      setError(e.message || t.common.error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasteSms = async () => {
    try {
      const clip = (await Clipboard.getStringAsync()).trim();
      if (!clip) {
        Alert.alert(t.input.smsPasteTitle, t.input.smsPasteEmpty);
        return;
      }
      try {
        const result = await api.parseSms(clip);
        showConfirmation(result.message, result.parsed);
        return;
      } catch {
        /* fallback below */
      }
      const draft = parseBankSms(clip);
      if (!draft) {
        Alert.alert(t.input.smsPasteTitle, t.input.smsPasteFailed);
        return;
      }
      showConfirmation(
        t.input.smsPasteConfirm.replace("{amount}", formatMoney(draft.amount, locale)),
        {
          intent: "add_expense",
          amount: draft.amount,
          category: "Genel",
          description: draft.description,
          raw_text: clip,
        },
      );
    } catch {
      Alert.alert(t.common.error, t.input.smsPasteFailed);
    }
  };

  return (
    <ScreenShell ambient contentStyle={styles.content}>
      {simpleMode && !showAdvanced ? (
        <>
          <Text style={styles.simpleHint}>{t.firstRun.simpleInputHint}</Text>
          <Surface variant="glass" style={styles.voicePanel}>
            <VoiceInput
              onResult={handleVoiceResult}
              whisperMode={whisperMode}
              holdToRecord={holdToRecord}
              disabled={!aiAvailable}
            />
          </Surface>
          <View style={styles.divider}>
            <View style={styles.line} /><Text style={styles.dividerText}>{t.input.orType}</Text><View style={styles.line} />
          </View>
          <InputField
            style={styles.textInput}
            placeholder={t.input.placeholder}
            value={text}
            onChangeText={handleTextChange}
            onSubmitEditing={handleTextSubmit}
            returnKeyType="done"
            containerStyle={styles.inputWrap}
          />
          <PrimaryButton label={t.input.send} onPress={handleTextSubmit} loading={isSubmitting} style={styles.submitBtn} />
          <PrimaryButton
            label={t.firstRun.showAdvancedInput}
            onPress={() => setShowAdvanced(true)}
            variant="ghost"
          />
        </>
      ) : (
        <>
      <SegmentedControl
        options={[
          { key: "normal", label: t.input.normal },
          { key: "whisper", label: t.input.whisper },
        ]}
        value={whisperMode ? "whisper" : "normal"}
        onChange={(k) => setWhisperMode(k === "whisper")}
      />

      <View style={styles.topActions}>
        <PrimaryButton
          label={`⚡ ${t.input.quickExpense}`}
          onPress={() => setQuickExpenseOpen(true)}
          variant="secondary"
          compact
          style={styles.topActionBtn}
          testID="quick-expense-btn"
        />
        <PrimaryButton
          label={`📷 ${t.input.receipt}`}
          onPress={() => setShowScanner(true)}
          variant="secondary"
          compact
          style={styles.topActionBtn}
        />
        <PrimaryButton
          label={`💬 ${t.input.smsPaste}`}
          onPress={handlePasteSms}
          variant="secondary"
          compact
          style={styles.topActionBtn}
        />
      </View>

      {!aiAvailable && (
        <Surface variant="accent" style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>{t.input.aiUnavailable}</Text>
        </Surface>
      )}

      <Surface variant="glass" style={styles.voicePanel}>
        <VoiceInput
          onResult={handleVoiceResult}
          whisperMode={whisperMode}
          holdToRecord={holdToRecord}
          disabled={!aiAvailable}
        />
      </Surface>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.divider}>
        <View style={styles.line} /><Text style={styles.dividerText}>{t.input.orType}</Text><View style={styles.line} />
      </View>

      <InputField
        style={[styles.textInput, slashMode && styles.slashInput]}
        placeholder={t.input.placeholder}
        value={text}
        onChangeText={handleTextChange}
        onSubmitEditing={handleTextSubmit}
        returnKeyType="done"
        containerStyle={styles.inputWrap}
      />

      {slashMode && (
        <View style={styles.slashSection}>
          <Text style={styles.slashLabel}>{t.input.slashMode}</Text>
          <View style={styles.suggestions}>
            {slashHints.map((hint) => (
              <PrimaryButton
                key={hint}
                label={hint}
                onPress={() => { setText(hint); setSlashMode(true); }}
                variant="ghost"
                compact
                style={styles.slashChipBtn}
              />
            ))}
          </View>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <PrimaryButton key={s} label={s} onPress={() => setText(s)} variant="ghost" compact style={styles.chipBtn} />
          ))}
        </View>
      )}

      <PrimaryButton
        label={showKeypad ? t.input.hideKeypad : t.input.numericKeypad}
        onPress={() => setShowKeypad(!showKeypad)}
        variant="ghost"
        style={styles.keypadToggle}
      />

      {showKeypad && <NumericKeypad value={keypadValue} onChange={setKeypadValue}
        onSubmit={() => { setText(keypadValue); setShowKeypad(false); }} />}

      <PrimaryButton
        label={t.input.send}
        onPress={handleTextSubmit}
        disabled={isSubmitting}
        loading={isSubmitting}
        style={styles.submitBtn}
      />
        </>
      )}

      <ConfirmationCard
        visible={confirmVisible}
        message={confirmMessage}
        parsed={parsedData}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
      />

      <PayBillModal
        visible={!!payModal}
        billTitle={payModal?.title || ""}
        amount={0}
        onConfirm={async (walletId) => {
          if (payModal) {
            try {
              await api.markPaid(payModal.title, walletId);
              setText("");
            } catch (e: any) { setError(e.message); }
          }
          setPayModal(null);
          setParsedData(null);
        }}
        onCancel={() => { setPayModal(null); setParsedData(null); }}
      />

      <DuplicateBillDialog
        visible={!!duplicateMsg}
        message={duplicateMsg}
        onConfirm={async () => {
          setDuplicateMsg("");
          if (!parsedData) return;
          setIsSubmitting(true);
          try {
            const res: any = await api.executeAction({ ...parsedData, force: true }, true);
            if (res?.status === "success" && res?.result?.due_date) {
              await scheduleAgendaReminder(
                res.result.title || parsedData.description || t.agenda.defaultBillName,
                res.result.amount || parsedData.amount || 0,
                new Date(res.result.due_date),
                locale,
              );
            }
            setText("");
            setParsedData(null);
          } catch (e: any) {
            setError(e.message);
          } finally {
            setIsSubmitting(false);
          }
        }}
        onCancel={() => { setDuplicateMsg(""); setParsedData(null); }}
      />

      <Modal visible={quickExpenseOpen} transparent animationType="slide" onRequestClose={() => setQuickExpenseOpen(false)}>
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.input.quickExpenseTitle}</Text>
            <InputField
              value={quickAmount}
              onChangeText={setQuickAmount}
              placeholder={t.input.quickExpenseAmount}
              keyboardType="decimal-pad"
              testID="quick-expense-amount"
            />
            <InputField
              value={quickDesc}
              onChangeText={setQuickDesc}
              placeholder={t.input.quickExpenseDesc}
              testID="quick-expense-desc"
            />
            <View style={styles.modalActions}>
              <PrimaryButton
                label={t.common.cancel}
                onPress={() => setQuickExpenseOpen(false)}
                variant="ghost"
                compact
                testID="quick-expense-cancel"
              />
              <PrimaryButton
                label={t.input.quickExpenseSave}
                onPress={submitQuickExpense}
                loading={isSubmitting}
                disabled={isSubmitting}
                compact
                testID="quick-expense-save"
              />
            </View>
          </Surface>
        </View>
      </Modal>

      <Modal visible={showScanner} animationType="slide">
        <ReceiptScanner
          onResult={(data) => {
            setShowScanner(false);
            setReceiptReview(data);
          }}
          onClose={() => setShowScanner(false)}
        />
      </Modal>

      <ReceiptReviewModal
        visible={!!receiptReview}
        data={receiptReview}
        onClose={() => setReceiptReview(null)}
        onSaveExpense={(data) => handleReceiptReviewed(data, "expense")}
        onAddToShopping={(data) => handleReceiptReviewed(data, "shopping")}
        onAddBillReminder={handleBillReminderFromReceipt}
      />

      {pendingSwap || pendingRoundUp ? (
        <MicroSavingsNudges
          swap={pendingSwap}
          roundUp={pendingRoundUp}
          onDismiss={() => {
            setPendingSwap(null);
            setPendingRoundUp(null);
          }}
        />
      ) : null}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.xl },
  topActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.sm, marginBottom: Spacing.sm },
  topActionBtn: { flexShrink: 1 },
  aiBanner: { padding: Spacing.sm, marginBottom: Spacing.sm },
  aiBannerText: { color: Colors.warning, fontSize: 13, textAlign: "center" },
  voicePanel: { padding: Spacing.md, marginBottom: Spacing.md },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.md },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, marginHorizontal: Spacing.sm, fontSize: 13 },
  inputWrap: { marginBottom: 0 },
  textInput: { fontSize: 16 },
  slashInput: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  slashSection: { marginTop: Spacing.sm },
  slashLabel: { color: Colors.accent, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  slashChipBtn: { alignSelf: "flex-start" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  chipBtn: { alignSelf: "flex-start" },
  keypadToggle: { marginTop: Spacing.md },
  submitBtn: { marginTop: Spacing.md },
  simpleHint: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.sm, lineHeight: 20 },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md, gap: Spacing.sm },
});
