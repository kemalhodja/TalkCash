import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";

export default function LockScreen() {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    auth.getUser().then(async (u) => {
      if (!u) { router.replace("/login"); return; }
      setUser(u);
      if (u.biometricEnabled) {
        const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
        if (ok) router.replace("/(tabs)");
      }
    });
  }, [t.lock.biometricPrompt]);

  const verifyPin = async () => {
    try {
      await api.verifyPin(pin);
      router.replace("/(tabs)");
    } catch {
      setError(t.lock.wrongPin);
      setPin("");
    }
  };

  const setupPin = async () => {
    if (pin.length < 4) { setError(t.lock.pinTooShort); return; }
    try {
      await api.setPin(pin);
      await auth.updateUser({ hasPin: true });
      router.replace("/(tabs)");
    } catch {
      setError(t.lock.pinFailed);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔒 TalkCash</Text>
      <Text style={styles.subtitle}>{user?.hasPin ? t.lock.enterPin : t.lock.createPin}</Text>

      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={6}
        placeholder="••••"
        placeholderTextColor={Colors.textMuted}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={user?.hasPin ? verifyPin : setupPin}>
        <Text style={styles.btnText}>{user?.hasPin ? t.lock.unlock : t.lock.create}</Text>
      </TouchableOpacity>

      {user?.biometricEnabled && (
        <TouchableOpacity style={styles.bioBtn} onPress={async () => {
          const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
          if (ok) router.replace("/(tabs)");
        }}>
          <Text style={styles.bioText}>{t.lock.biometric}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  title: { fontSize: 28, textAlign: "center", marginBottom: Spacing.sm },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.xl },
  input: {
    backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.md,
    color: Colors.text, fontSize: 24, textAlign: "center", letterSpacing: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 12, alignItems: "center", marginTop: Spacing.lg },
  btnText: { color: Colors.bg, fontWeight: "700" },
  bioBtn: { alignItems: "center", marginTop: Spacing.lg },
  bioText: { color: Colors.accent },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
