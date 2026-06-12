import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { PayBillModal } from "@/components/PayBillModal";
import { NumericKeypad } from "@/components/NumericKeypad";
import { ReceiptScanner } from "@/components/ReceiptScanner";
import { VoiceInput } from "@/components/VoiceInput";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { formatMoney } from "@/utils/format";

export default function InputScreen() {
  const { t, locale } = useI18n();
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
    <View style={styles.container}>
      <View style={styles.modeToggle}>
        <TouchableOpacity style={[styles.modeBtn, !whisperMode && styles.modeActive]} onPress={() => setWhisperMode(false)}>
          <Text style={styles.modeText}>{t.input.normal}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.modeBtn, whisperMode && styles.modeActive]} onPress={() => setWhisperMode(true)}>
          <Text style={styles.modeText}>{t.input.whisper}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={() => setShowScanner(true)}>
          <Text style={styles.modeText}>📷 {t.input.receipt}</Text>
        </TouchableOpacity>
      </View>

      {!aiAvailable && (
        <View style={styles.aiBanner}>
          <Text style={styles.aiBannerText}>{t.input.aiUnavailable}</Text>
        </View>
      )}
      <VoiceInput onResult={handleVoiceResult} whisperMode={whisperMode} disabled={!aiAvailable} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.divider}>
        <View style={styles.line} /><Text style={styles.dividerText}>{t.input.orType}</Text><View style={styles.line} />
      </View>

      <TextInput style={[styles.input, slashMode && styles.slashInput]} placeholder={t.input.placeholder}
        placeholderTextColor={Colors.textMuted} value={text} onChangeText={handleTextChange}
        onSubmitEditing={handleTextSubmit} returnKeyType="done" />

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

      <TouchableOpacity style={[styles.submitBtn, isSubmitting && styles.submitDisabled]} onPress={handleTextSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.submitText}>{t.input.send}</Text>}
      </TouchableOpacity>

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
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  modeToggle: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  modeBtn: { flex: 1, padding: Spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  scanBtn: { padding: Spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  modeActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  modeText: { color: Colors.textSecondary, fontSize: 13 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.md },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, marginHorizontal: Spacing.sm, fontSize: 13 },
  input: { backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.md, color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  slashInput: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.05)" },
  slashSection: { marginTop: Spacing.sm },
  slashLabel: { color: Colors.accent, fontSize: 12, fontWeight: "600", marginBottom: 6 },
  slashChip: { backgroundColor: "rgba(0,212,170,0.12)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.accent },
  slashChipText: { color: Colors.accent, fontSize: 12, fontFamily: "monospace" },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  chip: { backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  chipText: { color: Colors.accent, fontSize: 13 },
  keypadToggle: { alignItems: "center", marginTop: Spacing.md },
  keypadToggleText: { color: Colors.accent, fontSize: 14 },
  submitBtn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 12, alignItems: "center", marginTop: Spacing.md },
  submitDisabled: { opacity: 0.6 },
  submitText: { color: Colors.bg, fontWeight: "700", fontSize: 16 },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
  aiBanner: {
    backgroundColor: "rgba(245,158,11,0.15)", borderRadius: 10, padding: Spacing.sm,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: "rgba(245,158,11,0.4)",
  },
  aiBannerText: { color: Colors.warning, fontSize: 13, textAlign: "center" },
});
