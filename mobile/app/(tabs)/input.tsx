import { useEffect, useMemo, useRef, useState } from "react";
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
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { getApiErrorMessage } from "@/utils/apiErrors";
import { scheduleAgendaReminder, scheduleSubscriptionReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { formatMoney } from "@/utils/format";
import { track } from "@/services/analytics";
import { parsePositiveAmount } from "@/utils/amount";
import { extractVoiceAlert, playExpenseFeedback, playVoiceAlert } from "@/utils/voiceAlert";
import { hapticImpact, hapticSuccessDouble } from "@/utils/haptics";
import { extractSwapNudge, type SwapNudge } from "@/utils/swapNudge";
import { extractRoundUp, type RoundUpNudge } from "@/utils/roundUp";
import { MicroSavingsNudges } from "@/components/MicroSavingsNudges";
import { SmsImportCard } from "@/components/SmsImportCard";
import { parseBankSms } from "@/utils/smsExpenseParser";
import * as Clipboard from "expo-clipboard";
import { consumePendingInputVoice } from "@/hooks/useAssistantLinking";
import { consumePendingVoiceResult } from "@/services/voiceQueue";
import { applyOptimisticExpense } from "@/services/syncCache";
import * as Speech from "expo-speech";
import {
  isSimpleInputMode,
  markFirstExpenseAdded,
  consumePendingInputText,
} from "@/services/firstRun";

export default function InputScreen() {
  const { t, locale } = useI18n();
  const { colors } = useTheme();
  const voiceParams = useLocalSearchParams<{ whisper?: string; hold?: string; sms?: string; text?: string }>();
  const [text, setText] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whisperMode, setWhisperMode] = useState(false);
  const [holdToRecord, setHoldToRecord] = useState(false);
  const [autoRecordVoice, setAutoRecordVoice] = useState(false);
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
  const [confirmInstant, setConfirmInstant] = useState(false);
  const [simpleMode, setSimpleMode] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { paddingBottom: Spacing.xl, gap: Spacing.sm },
        topActions: { flexDirection: "row", justifyContent: "flex-end", gap: Spacing.sm, marginBottom: Spacing.xs },
        topActionBtn: { flexShrink: 1 },
        aiBanner: { padding: Spacing.md, marginBottom: Spacing.sm },
        aiBannerText: { color: colors.warning, fontSize: 13, textAlign: "center", lineHeight: 18 },
        voicePanel: {
          paddingVertical: Spacing.lg,
          paddingHorizontal: Spacing.md,
          marginBottom: Spacing.md,
          alignItems: "center",
        },
        divider: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.lg },
        line: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.border },
        dividerText: { color: colors.textMuted, marginHorizontal: Spacing.md, fontSize: 13, fontWeight: "600" },
        inputWrap: { marginBottom: 0 },
        textInput: { fontSize: 16 },
        slashInput: { borderColor: colors.borderStrong, backgroundColor: colors.accentSoft },
        slashSection: { marginTop: Spacing.sm },
        slashLabel: { color: colors.accent, fontSize: 12, fontWeight: "600", marginBottom: 6 },
        slashChipBtn: { alignSelf: "flex-start" },
        suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.sm },
        chipBtn: { alignSelf: "flex-start" },
        keypadToggle: { marginTop: Spacing.md },
        submitBtn: { marginTop: Spacing.md },
        simpleHint: {
          color: colors.textSecondary,
          fontSize: 14,
          marginBottom: Spacing.md,
          lineHeight: 21,
          textAlign: "center",
          paddingHorizontal: Spacing.sm,
        },
        error: { color: colors.danger, textAlign: "center", marginTop: Spacing.sm, lineHeight: 20 },
        modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: "center", padding: Spacing.lg },
        modalCard: { padding: Spacing.lg },
        modalTitle: { color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
        modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md, gap: Spacing.sm },
      }),
    [colors],
  );

  useEffect(() => {
    isSimpleInputMode().then(setSimpleMode);
    consumePendingInputText().then((pending) => {
      if (pending) setText(pending);
    });
    consumePendingVoiceResult().then((pending) => {
      if (pending) handleVoiceResult("", pending);
    });
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
      if (voiceParams.hold === "1" || pending?.hold) {
        setHoldToRecord(true);
        setAutoRecordVoice(true);
      }
      if (voiceParams.sms === "1" || pending?.smsPaste) {
        setTimeout(() => { handlePasteSms(); }, 400);
      }
    })();
  }, [voiceParams.hold, voiceParams.whisper, voiceParams.sms]);

  const slashHints: string[] = Array.isArray(t.input.slashHints)
    ? t.input.slashHints
    : ["/150 kahve banka", "/500 transfer banka nakit", "/fatura elektrik 200"];

  const handleTextSubmitFromParam = async (value: string) => {
    if (!value.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const result = await api.parseText(value.trim(), whisperMode);
      if (result?.parsed?.intent === "easter_egg") {
        handleVoiceResult(value, result);
        return;
      }
      if (result?.parsed?.intent === "manual_edit" || result?.parsed?.parse_failed) {
        showConfirmation(result.message || t.input.manualEditTitle, result.parsed);
        return;
      }
      if (result?.parsed) showConfirmation(result.message, result.parsed);
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, {
        network: t.input.voiceNetworkError,
        timeout: t.input.voiceTimeoutError,
        auth: t.input.voiceAuthError,
        validation: t.input.parseError,
        server: t.input.voiceServerError,
        unknown: t.input.parseError,
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const showConfirmation = (message: string, parsed: any) => {
    setConfirmMessage(message);
    setParsedData(parsed);
    setConfirmInstant(parsed?.intent === "add_expense" || parsed?.intent === "manual_edit");
    setConfirmVisible(true);
    setError("");
  };

  useEffect(() => {
    if (voiceParams.text) {
      setText(String(voiceParams.text));
      handleTextSubmitFromParam(String(voiceParams.text));
    }
  }, [voiceParams.text]);

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
    } catch (e: unknown) {
      setError(getApiErrorMessage(e, {
        network: t.input.voiceNetworkError,
        timeout: t.input.voiceTimeoutError,
        auth: t.input.voiceAuthError,
        validation: t.input.parseError,
        server: t.input.voiceServerError,
        unknown: t.input.parseError,
      }));
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
      hapticSuccessDouble();
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
    if (payload?.intent === "mark_paid") {
      setConfirmVisible(false);
      const title = payload.description || payload.raw_text || "";
      setPayModal({ title });
      return;
    }
    if (!payload) {
      setParsedData(null);
      return;
    }

    const instantExpense = payload.intent === "add_expense";
    if (instantExpense) {
      applyOptimisticExpense(payload).catch(() => {});
      setConfirmVisible(false);
      setParsedData(null);
      setText("");
      track("voice_expense_saved");
      markFirstExpenseAdded();
      hapticSuccessDouble();
      playExpenseFeedback({ status: "success" }, locale);
    }

    setIsSubmitting(true);
    try {
      const res: any = await api.executeAction(payload, true);
      if (res?.status === "queued") {
        if (!instantExpense) {
          setConfirmVisible(false);
          setParsedData(null);
          Alert.alert(t.common.confirm, t.input.queuedOffline);
        }
        setText("");
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
      if (payload.intent === "add_expense" && !instantExpense) {
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
      if (instantExpense) {
        await speakBudgetAlertsAfterSpend(locale);
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
      } else {
        setConfirmVisible(false);
        setParsedData(null);
        setText("");
      }
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 409 && payload?.intent === "add_bill") {
        setConfirmVisible(false);
        setDuplicateMsg(e.message);
        return;
      }
      setConfirmVisible(true);
      setError(getApiErrorMessage(e, {
        network: t.input.voiceNetworkError,
        timeout: t.input.voiceTimeoutError,
        auth: t.input.voiceAuthError,
        validation: t.common.error,
        server: t.input.voiceServerError,
        unknown: t.common.error,
      }));
    } finally {
      setIsSubmitting(false);
    }
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
          category: data.category || data.suggested_category || t.categories.general,
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
        category: t.categories.general,
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
          category: t.categories.general,
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
          <SmsImportCard onPaste={handlePasteSms} />
          <Text style={styles.simpleHint}>{t.firstRun.simpleInputHint}</Text>
          <Surface variant="glass" style={styles.voicePanel}>
            <VoiceInput
              onResult={handleVoiceResult}
              whisperMode={whisperMode}
              holdToRecord={holdToRecord}
              autoRecord={autoRecordVoice}
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
      <SmsImportCard onPaste={handlePasteSms} compact />
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
          autoRecord={autoRecordVoice}
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
        variant={confirmInstant ? "instant" : "default"}
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
