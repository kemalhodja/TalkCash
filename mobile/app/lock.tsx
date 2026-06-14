import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { consumePendingAssistant } from "@/services/assistant";

async function goAfterUnlock() {
  const pending = await consumePendingAssistant();
  if (pending) {
    const qs = new URLSearchParams({ text: pending.text, confirm: String(pending.confirm), source: pending.source });
    router.replace(`/command?${qs.toString()}`);
  } else {
    router.replace("/(tabs)");
  }
}

export default function LockScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    auth.getUser().then(async (u) => {
      if (!u) { router.replace("/login"); return; }
      setUser(u);
      if (u.biometricEnabled) {
        const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
        if (ok) { auth.setUnlocked(true); await goAfterUnlock(); }
      }
    });
  }, [t.lock.biometricPrompt]);

  const verifyPin = async () => {
    try {
      await api.verifyPin(pin);
      auth.setUnlocked(true);
      await goAfterUnlock();
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
      auth.setUnlocked(true);
      await goAfterUnlock();
    } catch {
      setError(t.lock.pinFailed);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.glow} />
      <Text style={styles.brand}>TalkCash</Text>
      <Surface variant="glass" glow style={styles.card}>
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
            if (ok) { auth.setUnlocked(true); await goAfterUnlock(); }
          }}>
            <Text style={styles.bioText}>{t.lock.biometric}</Text>
          </TouchableOpacity>
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  glow: {
    position: "absolute",
    top: "20%",
    alignSelf: "center",
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accentGlow,
    opacity: 0.3,
  },
  brand: { color: Colors.text, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: Spacing.lg, letterSpacing: -0.5 },
  card: { padding: Spacing.lg },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, ...Typography.subtitle },
  input: {
    backgroundColor: Colors.bgElevated, borderRadius: Radius.md, padding: Spacing.md,
    color: Colors.text, fontSize: 24, textAlign: "center", letterSpacing: 10,
    borderWidth: 1, borderColor: Colors.borderStrong,
  },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: Radius.md, alignItems: "center", marginTop: Spacing.lg },
  btnText: { color: Colors.bg, fontWeight: "700" },
  bioBtn: { alignItems: "center", marginTop: Spacing.lg },
  bioText: { color: Colors.accent, fontWeight: "600" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
