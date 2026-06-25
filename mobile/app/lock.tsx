import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import { consumePendingAssistant } from "@/services/assistant";
import { consumePendingInputVoice, consumePendingQuickVoice, consumePendingShare } from "@/hooks/useAssistantLinking";

function sanitizePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

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

async function finishUnlock() {
  auth.setUnlocked(true);
  await auth.persistSessionIfRemembered();
  await auth.clearBackgroundTimestamp();
  await goAfterUnlock();
}

export default function LockScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  const hasPin = user?.hasPin === true;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const u = await auth.getUser();
      if (cancelled) return;
      if (!u) {
        router.replace("/login");
        return;
      }

      let resolved = u;
      try {
        const me = await api.getMe();
        if (cancelled) return;
        if (typeof me.has_pin === "boolean" && me.has_pin !== resolved.hasPin) {
          await auth.updateUser({ hasPin: me.has_pin });
          resolved = { ...resolved, hasPin: me.has_pin };
        }
        if (!resolved.hasPin) {
          await finishUnlock();
          return;
        }
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          router.replace("/login");
          return;
        }
        /* offline — use cached user */
      }

      if (cancelled) return;
      setUser(resolved);
      setUserLoading(false);

      if (resolved.biometricEnabled && resolved.hasPin) {
        const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
        if (cancelled) return;
        if (ok) await finishUnlock();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t.lock.biometricPrompt]);

  const handlePinChange = useCallback((value: string) => {
    setPin(sanitizePin(value));
    if (error) setError("");
  }, [error]);

  const verifyPin = async () => {
    const digits = sanitizePin(pin);
    if (digits.length < 4) {
      setError(t.lock.pinTooShort);
      return;
    }
    setUnlocking(true);
    setError("");
    try {
      await api.verifyPin(digits);
      await finishUnlock();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setError(t.lock.wrongPin);
      } else if (e instanceof ApiError && e.status === 0) {
        setError(t.errors.network);
      } else if (e instanceof ApiError && e.message === "Session expired") {
        setError(t.lock.sessionExpired);
      } else {
        setError(t.lock.wrongPin);
      }
      setPin("");
    } finally {
      setUnlocking(false);
    }
  };

  const setupPin = async () => {
    const digits = sanitizePin(pin);
    if (digits.length < 4) {
      setError(t.lock.pinTooShort);
      return;
    }
    setUnlocking(true);
    setError("");
    try {
      await api.setPin(digits);
      await auth.updateUser({ hasPin: true });
      await finishUnlock();
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setError(t.errors.network);
      } else {
        setError(t.lock.pinFailed);
      }
    } finally {
      setUnlocking(false);
    }
  };

  const onSubmitPin = () => {
    if (userLoading || unlocking) return;
    if (hasPin) void verifyPin();
    else void setupPin();
  };

  if (userLoading) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator color={Colors.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <AmbientBackground variant="auth" />
      <Text style={styles.brand}>TalkCash</Text>
      <Surface variant="glass" glow style={styles.card}>
        <Text style={styles.subtitle}>{hasPin ? t.lock.enterPin : t.lock.createPin}</Text>
        <InputField
          value={pin}
          onChangeText={handlePinChange}
          keyboardType="number-pad"
          secureTextEntry
          allowReveal={false}
          maxLength={6}
          placeholder="••••"
          style={styles.pinInput}
          containerStyle={styles.pinWrap}
          returnKeyType="done"
          onSubmitEditing={onSubmitPin}
          editable={!unlocking}
          testID="lock-pin-input"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryButton
          label={hasPin ? t.lock.unlock : t.lock.create}
          onPress={hasPin ? verifyPin : setupPin}
          loading={unlocking}
          disabled={userLoading}
          style={styles.submitBtn}
          testID="lock-submit"
        />
        {user?.biometricEnabled && hasPin ? (
          <TextLink
            label={t.lock.biometric}
            onPress={async () => {
              setUnlocking(true);
              try {
                const ok = await auth.authenticateBiometric(t.lock.biometricPrompt);
                if (ok) await finishUnlock();
              } finally {
                setUnlocking(false);
              }
            }}
            style={styles.bioLink}
          />
        ) : null}
        {!hasPin ? (
          <TextLink
            label={t.lock.skipPin}
            onPress={() => finishUnlock()}
            style={styles.bioLink}
          />
        ) : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  centered: { justifyContent: "center", alignItems: "center" },
  brand: { color: Colors.text, fontSize: 28, fontWeight: "800", textAlign: "center", marginBottom: Spacing.lg, letterSpacing: -0.5 },
  card: { padding: Spacing.lg },
  subtitle: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, ...Typography.subtitle },
  pinWrap: { marginBottom: 0 },
  pinInput: { fontSize: 24, textAlign: "center", letterSpacing: 10 },
  submitBtn: { marginTop: Spacing.lg },
  bioLink: { marginTop: Spacing.lg, alignSelf: "center" },
  error: { color: Colors.danger, textAlign: "center", marginTop: Spacing.sm },
});
