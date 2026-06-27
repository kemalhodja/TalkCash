import { useState } from "react";
import { Alert, Platform, StyleSheet, Text, View } from "react-native";
import Constants from "expo-constants";
import { Stack, router } from "expo-router";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { hapticImpact } from "@/utils/haptics";

const APP_VERSION = Constants.expoConfig?.version ?? "1.0.0";

export default function FeedbackScreen() {
  const { t } = useI18n();
  const [rating, setRating] = useState("4");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = message.trim();
    if (text.length < 3) {
      Alert.alert(t.feedback.title, t.feedback.messageRequired);
      return;
    }
    setSending(true);
    try {
      await api.submitFeedback({
        message: text,
        rating: Number(rating),
        app_version: APP_VERSION,
        platform: Platform.OS,
      });
      await hapticImpact("success");
      Alert.alert(t.feedback.title, t.feedback.thanks, [
        { text: t.common.close, onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen options={{ title: t.feedback.title, headerTintColor: Colors.text, headerStyle: { backgroundColor: Colors.bg } }} />
      <Surface variant="elevated" style={styles.card}>
        <Text style={styles.label}>{t.feedback.rating}</Text>
        <ChipPicker
          options={[
            { id: "5", label: "⭐⭐⭐⭐⭐" },
            { id: "4", label: "⭐⭐⭐⭐" },
            { id: "3", label: "⭐⭐⭐" },
            { id: "2", label: "⭐⭐" },
            { id: "1", label: "⭐" },
          ]}
          value={rating}
          onChange={setRating}
        />
        <InputField
          placeholder={t.feedback.placeholder}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          style={styles.input}
        />
        <PrimaryButton label={t.feedback.submit} onPress={submit} loading={sending} disabled={sending} />
      </Surface>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, margin: Spacing.md },
  label: { color: Colors.textMuted, fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm },
  input: { minHeight: 120, textAlignVertical: "top" },
});
