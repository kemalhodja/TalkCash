import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { NumericKeypad } from "@/components/NumericKeypad";
import { VoiceInput } from "@/components/VoiceInput";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";

const DEMO_USER = "00000000-0000-0000-0000-000000000001";

export default function InputScreen() {
  const [text, setText] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [keypadValue, setKeypadValue] = useState("");
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [parsedData, setParsedData] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [whisperMode, setWhisperMode] = useState(false);

  const handleTextSubmit = async () => {
    if (!text.trim()) return;
    try {
      const result = await api.parseText(text, whisperMode);
      setConfirmMessage(result.message);
      setParsedData(result.parsed);
      setConfirmVisible(true);
    } catch {
      setConfirmMessage(`"${text}" kaydedilsin mi?`);
      setParsedData({ intent: "add_expense", raw_text: text });
      setConfirmVisible(true);
    }
  };

  const handleVoiceResult = async (voiceText: string) => {
    setText(voiceText);
    try {
      const result = await api.parseText(voiceText, whisperMode);
      setConfirmMessage(result.message);
      setParsedData(result.parsed);
      setConfirmVisible(true);
    } catch {
      setConfirmMessage(`${voiceText} kaydedilsin mi?`);
      setConfirmVisible(true);
    }
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    if (parsedData) {
      try {
        await api.executeAction(DEMO_USER, parsedData, true);
      } catch { /* offline demo */ }
    }
    setText("");
    setParsedData(null);
  };

  const handleTextChange = async (val: string) => {
    setText(val);
    if (val.length >= 1) {
      try {
        const res = await api.autocomplete(val);
        setSuggestions(res.suggestions);
      } catch {
        setSuggestions([]);
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeBtn, !whisperMode && styles.modeActive]}
          onPress={() => setWhisperMode(false)}
        >
          <Text style={styles.modeText}>Normal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, whisperMode && styles.modeActive]}
          onPress={() => setWhisperMode(true)}
        >
          <Text style={styles.modeText}>Fısıltı Modu</Text>
        </TouchableOpacity>
      </View>

      <VoiceInput onResult={handleVoiceResult} whisperMode={whisperMode} />

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.dividerText}>veya yazın</Text>
        <View style={styles.line} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="/150 kahve banka veya doğal dil..."
        placeholderTextColor={Colors.textMuted}
        value={text}
        onChangeText={handleTextChange}
        onSubmitEditing={handleTextSubmit}
        returnKeyType="done"
      />

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
        <Text style={styles.keypadToggleText}>
          {showKeypad ? "Klavyeyi Gizle" : "Sayısal Klavye"}
        </Text>
      </TouchableOpacity>

      {showKeypad && (
        <NumericKeypad
          value={keypadValue}
          onChange={setKeypadValue}
          onSubmit={() => { setText(keypadValue); setShowKeypad(false); }}
        />
      )}

      <TouchableOpacity style={styles.submitBtn} onPress={handleTextSubmit}>
        <Text style={styles.submitText}>Gönder</Text>
      </TouchableOpacity>

      <ConfirmationCard
        visible={confirmVisible}
        message={confirmMessage}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, padding: Spacing.md },
  modeToggle: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  modeBtn: {
    flex: 1, padding: Spacing.sm, borderRadius: 8,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  modeActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  modeText: { color: Colors.textSecondary, fontSize: 13 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: Spacing.md },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, marginHorizontal: Spacing.sm, fontSize: 13 },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.md,
    color: Colors.text, fontSize: 16, borderWidth: 1, borderColor: Colors.border,
  },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: Spacing.sm },
  chip: {
    backgroundColor: Colors.card, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { color: Colors.accent, fontSize: 13 },
  keypadToggle: { alignItems: "center", marginTop: Spacing.md },
  keypadToggleText: { color: Colors.accent, fontSize: 14 },
  submitBtn: {
    backgroundColor: Colors.accent, padding: Spacing.md,
    borderRadius: 12, alignItems: "center", marginTop: Spacing.md,
  },
  submitText: { color: Colors.bg, fontWeight: "700", fontSize: 16 },
});
