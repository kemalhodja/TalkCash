import { useEffect, useRef, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { PayBillModal } from "@/components/PayBillModal";
import { NumericKeypad } from "@/components/NumericKeypad";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import { VoiceInput } from "@/components/VoiceInput";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { formatMoney } from "@/utils/format";

export default function InputScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whisperMode, setWhisperMode] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");
  const [payModal, setPayModal] = useState<{ title: string } | null>(null);
  const [slashMode, setSlashMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.getInputCapabilities().then((c) => setAiAvailable(c.voice_available && c.llm_available)).catch(() => setAiAvailable(false));
  }, []);

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
      showConfirmation(result.message, result.parsed);
    } catch (e: any) {
      setError(e.message || t.input.parseError);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoiceResult = (voiceText: string, result?: any) => {
    if (result?.parsed) showConfirmation(result.message, result.parsed);
    else if (result?.message) showConfirmation(result.message, result.parsed);
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    if (parsedData?.intent === "mark_paid") {
      const title = parsedData.description || parsedData.raw_text || "";
      setPayModal({ title });
      return;
    }
    if (parsedData) {
      setIsSubmitting(true);
      try {
        const res: any = await api.executeAction(parsedData, true);
        if (res?.status === "queued") {
          Alert.alert(t.common.confirm, t.input.queuedOffline);
          setText("");
          setParsedData(null);
          return;
        }
        if (parsedData.intent === "add_bill" && res?.result?.due_date) {
          await scheduleAgendaReminder(
            res.result.title || parsedData.description || "Fatura",
            res.result.amount || parsedData.amount || 0,
            new Date(res.result.due_date),
            locale,
          );
        }
        if (parsedData.intent === "add_expense") {
          await speakBudgetAlertsAfterSpend(locale);
        }
        if (parsedData.receipt_id && parsedData.amount) {
          const receiptTotal = parsedData.receipt_total_amount ?? parsedData.receipt_total ?? parsedData.amount;
          const { verified, receipt_amount, transaction_amount } = await api.verifyReceipt(
            parsedData.amount, receiptTotal, parsedData.receipt_id,
          );
          const mismatchDetail = !verified && receipt_amount != null
            ? t.scanner.mismatchDetail
                .replace("{receipt}", formatMoney(Number(receipt_amount), locale))
                .replace("{tx}", formatMoney(Number(transaction_amount ?? parsedData.amount), locale))
            : undefined;
          Alert.alert(
            verified ? t.scanner.verified : t.scanner.mismatch,
            verified ? t.agenda.receiptLinked : mismatchDetail,
          );
        }
        setText("");
      } catch (e: any) {
        if (e instanceof ApiError && e.status === 409 && parsedData?.intent === "add_bill") {
          setDuplicateMsg(e.message);
          return;
        }
        setError(e.message);
      } finally { setIsSubmitting(false); }
    }
    setParsedData(null);
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

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + 100 }]}>
      <View style={styles.glowOrb} />

      <SegmentedControl
        options={[
          { key: "normal", label: t.input.normal },
          { key: "whisper", label: t.input.whisper },
        ]}
        value={whisperMode ? "whisper" : "normal"}
        onChange={(k) => setWhisperMode(k === "whisper")}
      />

      <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanner(true)}>
        <Text style={styles.scanText}>📷 {t.input.receipt}</Text>
      </TouchableOpacity>

      {!aiAvailable && (
        <Surface variant="accent" style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>{t.input.aiUnavailable}</Text>
        </Surface>
      )}

      <Surface variant="glass" style={styles.voicePanel}>
        <VoiceInput onResult={handleVoiceResult} whisperMode={whisperMode} disabled={!aiAvailable} />
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
              <TouchableOpacity key={hint} style={styles.slashChip} onPress={() => { setText(hint); setSlashMode(true); }}>
                <Text style={styles.slashChipText}>{hint}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.suggestions}>
          {suggestions.map((s) => (
            <TouchableOpacity key={s} style={styles.chip} onPress={() => setText(s)}>
              <Text style={styles.chipText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.keypadToggle} onPress={() => setShowKeypad(!showKeypad)}>
        <Text style={styles.keypadToggleText}>{showKeypad ? t.input.hideKeypad : t.input.numericKeypad}</Text>
      </TouchableOpacity>

      {showKeypad && <NumericKeypad value={keypadValue} onChange={setKeypadValue}
        onSubmit={() => { setText(keypadValue); setShowKeypad(false); }} />}

      <PrimaryButton
        label={t.input.send}
        onPress={handleTextSubmit}
        disabled={isSubmitting}
        loading={isSubmitting}
        style={styles.submitBtn}
      />

      <ConfirmationCard visible={confirmVisible} message={confirmMessage}
        onConfirm={handleConfirm} onCancel={() => setConfirmVisible(false)} />

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
                res.result.title || parsedData.description || "Fatura",
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

      <Modal visible={showScanner} animationType="slide">
        <ReceiptScanner
          onResult={(data) => {
            setShowScanner(false);
            Alert.alert(t.input.receipt, "", [
              {
                text: t.scanner.addToList,
                onPress: async () => {
                  try {
                    const res: any = await api.importReceiptToShopping(data.receipt_id);
                    Alert.alert(t.common.confirm, t.scanner.itemsImported.replace("{count}", String(res.added)));
                  } catch (e: any) {
                    setError(e.message);
                  }
                },
              },
              {
                text: t.input.send,
                onPress: () => showConfirmation(
                  t.input.receiptConfirm
                    .replace("{amount}", formatMoney(Number(data.total_amount) || 0, locale))
                    .replace("{merchant}", data.merchant || t.input.receipt),
                  {
                    intent: "add_expense", amount: data.total_amount, description: data.merchant,
                    receipt_id: data.receipt_id, receipt_total_amount: data.total_amount,
                  },
                ),
              },
              { text: t.common.cancel, style: "cancel" },
            ]);
          }}
          onClose={() => setShowScanner(false)}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, paddingHorizontal: Spacing.md },
  glowOrb: {
    position: "absolute",
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accentGlow,
    opacity: 0.25,
  },
  scanBtn: {
    alignSelf: "flex-end",
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
  },
  scanText: { color: Colors.textSecondary, fontSize: 13 },
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
  slashChip: { backgroundColor: Colors.accentSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.borderStrong },
  slashChipText: { color: Colors.accent, fontSize: 12, fontFamily: "monospace" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  chip: { backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  chipText: { color: Colors.accent, fontSize: 13 },
  keypadToggle: { alignItems: "center", marginTop: Spacing.md },
  keypadToggleText: { color: Colors.accent, fontSize: 14 },
  submitBtn: { marginTop: Spacing.md },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
