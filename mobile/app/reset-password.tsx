import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";

export default function ResetPasswordScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(params.token || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      await api.resetPassword(token.trim(), password);
      Alert.alert(t.resetPassword.title, t.resetPassword.success, [
        { text: t.login.login, onPress: () => router.replace("/login") },
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
      <Text style={styles.title}>{t.resetPassword.title}</Text>
      <Text style={styles.subtitle}>{t.resetPassword.subtitle}</Text>

      <Surface variant="glass" glow style={styles.formCard}>
        <InputField
          placeholder={t.resetPassword.token}
          value={token}
          onChangeText={setToken}
          autoCapitalize="none"
        />
        <InputField
          placeholder={t.resetPassword.newPassword}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton label={t.resetPassword.submit} onPress={handleSubmit} loading={loading} style={styles.submitBtn} />
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
