import { useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiConnectionCard } from "@/components/ApiConnectionCard";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { LANGUAGE_OPTIONS } from "@/constants/languages";
import type { Locale } from "@/i18n";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { auth, AuthUser } from "@/services/auth";
import { track } from "@/services/analytics";
import { isOnboardingComplete } from "@/app/onboarding";
import { getAppEnv } from "@/services/config";
import { setPendingDemoOffer } from "@/services/firstRun";

export default function LoginScreen() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [remember, rememberedEmail] = await Promise.all([
        auth.getRememberMe(),
        auth.getRememberedEmail(),
      ]);
      if (cancelled) return;
      setRememberMe(remember);
      if (rememberedEmail) setEmail(rememberedEmail);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goAfterAuth = async (user: AuthUser) => {
    const onboardingDone = await isOnboardingComplete();
    auth.setUnlocked(true);
    if (!onboardingDone) {
      router.replace("/onboarding");
      return;
    }
    router.replace("/(tabs)");
  };

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
        assistantPersona: (result.assistant_persona as AuthUser["assistantPersona"]) || "default",
      };
      await auth.save(user);
      await auth.setRememberMe(rememberMe);
      if (rememberMe) {
        await auth.setRememberedEmail(email);
      }
      track(isRegister ? "register_success" : "login_success");
      if (isRegister) {
        await setPendingDemoOffer();
      }
      if (result.locale === "en" || result.locale === "tr") {
        await setLocale(result.locale);
      }
      await goAfterAuth(user);
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

  const showDevConnection = getAppEnv() !== "production";

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
      <AmbientBackground variant="auth" />
      <Text style={styles.brand}>TalkCash</Text>
      <Text style={styles.logo}>{t.login.title}</Text>
      <Text style={styles.subtitle}>{t.login.subtitle}</Text>

      <View style={styles.languageRow}>
        <ChipPicker
          label={t.settings.language}
          options={[...LANGUAGE_OPTIONS]}
          value={locale}
          onChange={(id) => setLocale(id as Locale)}
        />
      </View>

      <Surface variant="glass" glow style={styles.formCard}>
        {showDevConnection ? <ApiConnectionCard compact /> : null}

        {isRegister && (
          <InputField placeholder={t.login.fullName} value={fullName} onChangeText={setFullName} />
        )}
        <InputField
          placeholder={t.login.email}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="login-email"
        />
        <InputField
          placeholder={t.login.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          testID="login-password"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!isRegister ? (
          <View style={styles.rememberRow}>
            <Text style={styles.rememberLabel}>{t.login.rememberMe}</Text>
            <Switch
              value={rememberMe}
              onValueChange={setRememberMe}
              trackColor={{ true: Colors.accent }}
              testID="login-remember-me"
            />
          </View>
        ) : null}

        <PrimaryButton
          label={isRegister ? t.login.register : t.login.login}
          onPress={handleSubmit}
          loading={loading}
          style={styles.submitBtn}
          testID="login-submit"
        />

        <TextLink
          label={isRegister ? t.login.switchLogin : t.login.switchRegister}
          onPress={() => setIsRegister(!isRegister)}
          style={styles.switch}
        />
        {!isRegister ? (
          <TextLink
            label={t.login.forgotPassword}
            onPress={() => router.push("/forgot-password")}
            style={styles.forgot}
          />
        ) : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", paddingHorizontal: Spacing.lg },
  brand: { color: Colors.accent, ...Typography.label, textAlign: "center", marginBottom: Spacing.sm },
  logo: { fontSize: 34, fontWeight: "800", color: Colors.text, textAlign: "center", letterSpacing: -0.8 },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, marginTop: Spacing.sm },
  languageRow: { marginBottom: Spacing.md, paddingHorizontal: Spacing.xs },
  formCard: { padding: Spacing.lg },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
  },
  rememberLabel: { color: Colors.textSecondary, fontSize: 14 },
  submitBtn: { marginTop: Spacing.md },
  switch: { marginTop: Spacing.lg, alignSelf: "center" },
  forgot: { marginTop: Spacing.md, alignSelf: "center" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
