import { useEffect } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import {
  ASSISTANT_PHRASES_EN,
  ASSISTANT_PHRASES_TR,
  buildAssistantUrl,
} from "@/services/assistant";
import {
  buildShortcutOptions,
  donateAllShortcuts,
  getAddToSiriButton,
  getSiriButtonStyle,
  isSiriShortcutsAvailable,
} from "@/services/siriShortcuts";

const AddToSiriButton = getAddToSiriButton();
const siriButtonStyle = getSiriButtonStyle();
const siriNative = Platform.OS === "ios" && isSiriShortcutsAvailable() && AddToSiriButton;

export function AssistantSetup() {
  const { t, locale } = useI18n();
  const phrases = locale === "en" ? ASSISTANT_PHRASES_EN : ASSISTANT_PHRASES_TR;

  useEffect(() => {
    if (siriNative) donateAllShortcuts(phrases);
  }, [phrases]);

  const copyUrl = async (text: string) => {
    const url = buildAssistantUrl(text, { source: Platform.OS === "ios" ? "siri" : "google" });
    await Clipboard.setStringAsync(url);
    Alert.alert(t.assistant.copied, url);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t.assistant.title}</Text>
      <Text style={styles.desc}>{t.assistant.description}</Text>

      {Platform.OS === "ios" ? (
        <View style={styles.steps}>
          {siriNative ? (
            <Text style={styles.step}>{t.assistant.siriNativeStep}</Text>
          ) : (
            <Text style={styles.stepMuted}>{t.assistant.siriUnavailable}</Text>
          )}
          <Text style={styles.step}>{t.assistant.siriStep1}</Text>
          <Text style={styles.step}>{t.assistant.siriStep2}</Text>
          <Text style={styles.step}>{t.assistant.siriStep3}</Text>
        </View>
      ) : (
        <View style={styles.steps}>
          <Text style={styles.step}>{t.assistant.googleStep1}</Text>
          <Text style={styles.step}>{t.assistant.googleStep2}</Text>
          <Text style={styles.step}>{t.assistant.googleStep3}</Text>
        </View>
      )}

      <Text style={styles.subTitle}>{t.assistant.quickPhrases}</Text>
      {phrases.map((p) => (
        <View key={p.text} style={styles.phraseCard}>
          <TouchableOpacity style={styles.phraseBtn} onPress={() => copyUrl(p.text)}>
            <Text style={styles.phraseLabel}>{p.label}</Text>
            <Text style={styles.phraseText}>"{p.text}"</Text>
            <Text style={styles.copyHint}>{t.assistant.tapToCopy}</Text>
          </TouchableOpacity>
          {siriNative && AddToSiriButton ? (
            <View style={styles.siriRow}>
              <AddToSiriButton
                shortcut={buildShortcutOptions(p)}
                buttonStyle={siriButtonStyle}
                style={styles.siriBtn}
              />
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  desc: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.md, lineHeight: 20 },
  steps: { backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  step: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6, lineHeight: 18 },
  stepMuted: { color: Colors.textMuted, fontSize: 13, marginBottom: 6, lineHeight: 18, fontStyle: "italic" },
  subTitle: { color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  phraseCard: { marginBottom: Spacing.sm },
  phraseBtn: { backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  phraseLabel: { color: Colors.accent, fontWeight: "700", marginBottom: 4 },
  phraseText: { color: Colors.text, fontSize: 14 },
  copyHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  siriRow: { marginTop: Spacing.sm, alignItems: "flex-start" },
  siriBtn: { height: 44, width: "100%" },
});
