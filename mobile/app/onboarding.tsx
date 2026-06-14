import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { registerForPushNotifications } from "@/services/notifications";

const ONBOARDING_KEY = "talkcash_onboarding_done";

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}

export default function OnboardingScreen() {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  useEffect(() => {
    isOnboardingComplete().then((done) => {
      if (done) router.replace("/lock");
    });
  }, []);

  const finish = async () => {
    await markOnboardingComplete();
    router.replace("/lock");
  };

  const next = async () => {
    if (step === 1) {
      try { await registerForPushNotifications(); } catch { /* optional */ }
    }
    if (step >= 2) {
      await finish();
      return;
    }
    setStep(step + 1);
  };

  const steps = [
    { title: t.onboarding.welcomeTitle, body: t.onboarding.welcomeBody },
    { title: t.onboarding.pushTitle, body: t.onboarding.pushBody },
    { title: t.onboarding.pinTitle, body: t.onboarding.pinBody },
  ];
  const current = steps[step];

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.lg }]}>
      <AmbientBackground variant="auth" />
      <View style={styles.brandRow}>
        <View style={styles.logoDot} />
        <Text style={styles.brand}>TalkCash</Text>
      </View>

      <Surface variant="glass" glow style={styles.card}>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton label={step >= 2 ? t.onboarding.start : t.onboarding.next} onPress={next} />
        {step < 2 && (
          <TextLink label={t.onboarding.skip} onPress={finish} style={styles.skip} />
        )}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: Spacing.xl },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent },
  brand: { color: Colors.textMuted, ...Typography.label },
  card: { padding: Spacing.xl },
  title: { color: Colors.text, ...Typography.title, marginBottom: Spacing.md },
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.xl },
  dots: { flexDirection: "row", gap: 8, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 24, borderRadius: Radius.pill },
  skip: { textAlign: "center", marginTop: Spacing.lg },
});
