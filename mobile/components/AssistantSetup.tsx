import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import {
  ASSISTANT_PHRASES_EN,
  ASSISTANT_PHRASES_TR,
  buildAssistantUrl,
} from "@/services/assistant";

export function AssistantSetup() {
  const { t, locale } = useI18n();
  const phrases = locale === "en" ? ASSISTANT_PHRASES_EN : ASSISTANT_PHRASES_TR;

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
        <TouchableOpacity key={p.text} style={styles.phraseBtn} onPress={() => copyUrl(p.text)}>
          <Text style={styles.phraseLabel}>{p.label}</Text>
          <Text style={styles.phraseText}>"{p.text}"</Text>
          <Text style={styles.copyHint}>{t.assistant.tapToCopy}</Text>
        </TouchableOpacity>
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
  subTitle: { color: Colors.text, fontSize: 14, fontWeight: "600", marginBottom: Spacing.sm },
  phraseBtn: { backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  phraseLabel: { color: Colors.accent, fontWeight: "700", marginBottom: 4 },
  phraseText: { color: Colors.text, fontSize: 14 },
  copyHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
});
