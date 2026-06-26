import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { getAppEnv } from "@/services/config";

export default function ForgotPasswordScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const goReset = (token: string) => {
    router.push({ pathname: "/reset-password", params: { token } });
  };

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setError(t.login.email);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await api.forgotPassword(trimmed);
      const showDevToken = getAppEnv() !== "production" && result.reset_token;

      if (result.reset_token && !result.email_sent) {
        Alert.alert(
          t.forgotPassword.inAppResetTitle,
          t.forgotPassword.inAppResetBody,
          [
            { text: t.resetPassword.submit, onPress: () => goReset(result.reset_token!) },
            { text: t.forgotPassword.backToLogin, style: "cancel", onPress: () => router.replace("/login") },
          ],
        );
        return;
      }

      if (showDevToken && result.reset_token) {
        Alert.alert(
          t.forgotPassword.sent,
          `${t.forgotPassword.devTokenHint}: ${result.reset_token}`,
          [
            { text: t.resetPassword.submit, onPress: () => goReset(result.reset_token!) },
            { text: t.forgotPassword.backToLogin, onPress: () => router.replace("/login") },
          ],
        );
        return;
      }

      Alert.alert(t.forgotPassword.title, t.forgotPassword.sent, [
        { text: t.forgotPassword.backToLogin, onPress: () => router.replace("/login") },
      ]);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 0) {
        setError(t.errors.network);
      } else {
        setError(e.message || t.common.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
      <AmbientBackground variant="auth" />
      <Text style={styles.title}>{t.forgotPassword.title}</Text>
      <Text style={styles.subtitle}>{t.forgotPassword.subtitle}</Text>

      <Surface variant="glass" glow style={styles.formCard}>
        <InputField
          placeholder={t.login.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={t.forgotPassword.submit} onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
        <TextLink label={t.forgotPassword.backToLogin} onPress={() => router.replace("/login")} style={styles.switch} />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", paddingHorizontal: Spacing.lg },
  title: { fontSize: 28, fontWeight: "800", color: Colors.text, textAlign: "center" },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, marginTop: Spacing.sm },
  formCard: { padding: Spacing.lg },
  submitBtn: { marginTop: Spacing.md },
  switch: { marginTop: Spacing.lg, alignSelf: "center" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
