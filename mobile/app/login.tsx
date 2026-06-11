import { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth, AuthUser } from "@/services/auth";

export default function LoginScreen() {
  const { t, setLocale } = useI18n();
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
        biometricEnabled: result.biometric_enabled,
        hasPin: result.has_pin,
      };
      await auth.save(user);
      if (result.locale === "en" || result.locale === "tr") {
        await setLocale(result.locale);
      }
      auth.setUnlocked(false);
      router.replace("/lock");
    } catch (e: any) {
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.logo}>💬 {t.login.title}</Text>
      <Text style={styles.subtitle}>{t.login.subtitle}</Text>

      {isRegister && (
        <TextInput style={styles.input} placeholder={t.login.fullName} placeholderTextColor={Colors.textMuted}
          value={fullName} onChangeText={setFullName} />
      )}
      <TextInput style={styles.input} placeholder={t.login.email} placeholderTextColor={Colors.textMuted}
        value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
      <TextInput style={styles.input} placeholder={t.login.password} placeholderTextColor={Colors.textMuted}
        value={password} onChangeText={setPassword} secureTextEntry />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.btnText}>{loading ? "..." : isRegister ? t.login.register : t.login.login}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
        <Text style={styles.switch}>{isRegister ? t.login.switchLogin : t.login.switchRegister}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  logo: { fontSize: 32, fontWeight: "800", color: Colors.text, textAlign: "center" },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.xl },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 12, alignItems: "center", marginTop: Spacing.md },
  btnText: { color: Colors.bg, fontWeight: "700", fontSize: 16 },
  switch: { color: Colors.accent, textAlign: "center", marginTop: Spacing.lg },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
