import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { consumePendingAssistant } from "@/services/assistant";
import { consumePendingInputVoice, consumePendingQuickVoice, consumePendingShare } from "@/hooks/useAssistantLinking";

async function goAfterUnlock() {
  const pending = await consumePendingAssistant();
  if (pending) {
    const qs = new URLSearchParams({ text: pending.text, confirm: String(pending.confirm), source: pending.source });
    router.replace(`/command?${qs.toString()}`);
    return;
  }
  const shared = await consumePendingShare();
  if (shared) {
    router.replace(`/share?text=${encodeURIComponent(shared)}&source=share`);
    return;
  }
  const inputVoice = await consumePendingInputVoice();
  if (inputVoice) {
    router.replace(`/(tabs)/input?whisper=${inputVoice.whisper ? "1" : "0"}&hold=${inputVoice.hold ? "1" : "0"}`);
    return;
  }
  const quickVoice = await consumePendingQuickVoice();
  if (quickVoice) {
    router.replace("/quick-voice?hold=1");
    return;
  }
  router.replace("/(tabs)");
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
      <AmbientBackground variant="auth" />
      <Text style={styles.brand}>TalkCash</Text>
      <Surface variant="glass" glow style={styles.card}>
        <Text style={styles.subtitle}>{user?.hasPin ? t.lock.enterPin : t.lock.createPin}</Text>
        <InputField
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={6}
          placeholder="••••"
          style={styles.pinInput}
          containerStyle={styles.pinWrap}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={user?.hasPin ? t.lock.unlock : t.lock.create}
          onPress={user?.hasPin ? verifyPin : setupPin}
          style={styles.submitBtn}
        />
        {user?.biometricEnabled && user?.hasPin && (
          <TextLink
            label={t.lock.biometric}
            onPress={async () => {
              const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
              if (ok) { auth.setUnlocked(true); await goAfterUnlock(); }
            }}
            style={styles.bioLink}
          />
        )}
        {!user?.hasPin && (
          <TextLink
            label={t.lock.skipPin}
            onPress={async () => {
              auth.setUnlocked(true);
              await goAfterUnlock();
            }}
            style={styles.bioLink}
          />
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  brand: { color: Colors.text, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: Spacing.lg, letterSpacing: -0.5 },
  card: { padding: Spacing.lg },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, ...Typography.subtitle },
  pinWrap: { marginBottom: 0 },
  pinInput: { fontSize: 24, textAlign: "center", letterSpacing: 10 },
  submitBtn: { marginTop: Spacing.lg },
  bioLink: { marginTop: Spacing.lg, alignSelf: "center" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
