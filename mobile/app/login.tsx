import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { auth, AuthUser } from "@/services/auth";

export default function LoginScreen() {
  const { t, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setLoading(true);
    setError("");
    try {
      const result = isRegister
        ? await api.register(email, password, fullName)
        : await api.login(email, password);

      const user: AuthUser = {
        userId: result.user_id,
        fullName: result.full_name,
        token: result.access_token,
        refreshToken: result.refresh_token,
        biometricEnabled: result.biometric_enabled,
        hasPin: result.has_pin,
      };
      await auth.save(user);
      if (result.locale === "en" || result.locale === "tr") {
        await setLocale(result.locale);
      }
      auth.setUnlocked(false);
      router.replace("/onboarding");
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
      <Text style={styles.brand}>TalkCash</Text>
      <Text style={styles.logo}>{t.login.title}</Text>
      <Text style={styles.subtitle}>{t.login.subtitle}</Text>

      <Surface variant="glass" glow style={styles.formCard}>
        <ApiConnectionCard compact />

        {isRegister && (
          <InputField placeholder={t.login.fullName} value={fullName} onChangeText={setFullName} />
        )}
        <InputField
          placeholder={t.login.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <InputField
          placeholder={t.login.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <PrimaryButton
          label={isRegister ? t.login.register : t.login.login}
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
        />

        <TextLink
          label={isRegister ? t.login.switchLogin : t.login.switchRegister}
          onPress={() => setIsRegister(!isRegister)}
          style={styles.switch}
        />
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", paddingHorizontal: Spacing.lg },
  brand: { color: Colors.accent, ...Typography.label, textAlign: "center", marginBottom: Spacing.sm },
  logo: { fontSize: 34, fontWeight: "800", color: Colors.text, textAlign: "center", letterSpacing: -0.8 },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, marginTop: Spacing.sm },
  formCard: { padding: Spacing.lg },
  submitBtn: { marginTop: Spacing.md },
  switch: { marginTop: Spacing.lg, alignSelf: "center" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
