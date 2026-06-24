import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { LANGUAGE_OPTIONS } from "@/constants/languages";
import { useI18n, type Locale } from "@/i18n";
import { track } from "@/services/analytics";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { registerForPushNotifications } from "@/services/notifications";

const ONBOARDING_KEY = "talkcash_onboarding_done";

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(ONBOARDING_KEY)) === "1";
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_KEY, "1");
}

export default function OnboardingScreen() {
  const { t, locale, setLocale } = useI18n();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  useEffect(() => {
    isOnboardingComplete().then((done) => {
      if (done) router.replace("/(tabs)");
    });
  }, []);

  const [loadingDemo, setLoadingDemo] = useState(false);

  const loadDemoData = async () => {
    setLoadingDemo(true);
    try {
      const res = await api.seedDemoData();
      track("demo_data_loaded", { status: res.status });
      Alert.alert(t.onboarding.demoTitle, res.status === "seeded" ? t.onboarding.demoLoaded : t.onboarding.demoSkipped);
    } catch {
      Alert.alert(t.common.error, t.onboarding.demoFailed);
    } finally {
      setLoadingDemo(false);
    }
  };

  const finish = async () => {
    track("onboarding_completed");
    await markOnboardingComplete();
    auth.setUnlocked(true);
    router.replace("/(tabs)");
  };

  const next = async () => {
    if (step === 2) {
      try { await registerForPushNotifications(); } catch { /* optional */ }
    }
    if (step === 3) {
      track("onboarding_micro_savings_viewed", { variant: "default" });
      try {
        await api.updateMicroSavingsPrefs({ round_up_enabled: true, round_up_step: 10 });
      } catch { /* optional */ }
    }
    if (step >= 4) {
      await finish();
      return;
    }
    setStep(step + 1);
  };

  const steps = [
    { title: t.onboarding.welcomeTitle, body: t.onboarding.welcomeBody },
    { title: t.onboarding.voiceTitle, body: t.onboarding.voiceBody },
    { title: t.onboarding.pushTitle, body: t.onboarding.pushBody },
    { title: t.onboarding.microSavingsTitle, body: t.onboarding.microSavingsBody },
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
        {step === 0 ? (
          <>
            <ChipPicker
              label={t.settings.language}
              options={[...LANGUAGE_OPTIONS]}
              value={locale}
              onChange={(id) => setLocale(id as Locale)}
            />
            <Surface variant="accent" style={styles.privacyBadge}>
              <Text style={styles.privacyIcon}>🛡️</Text>
              <Text style={styles.privacyTitle}>{t.onboarding.privacyTitle}</Text>
              <Text style={styles.privacyBody}>{t.onboarding.privacyBody}</Text>
            </Surface>
          </>
        ) : null}
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.body}>{current.body}</Text>
        {step === 1 ? (
          <View style={styles.voiceExamples}>
            <Text style={styles.voiceExample}>{t.onboarding.voiceExample1}</Text>
            <Text style={styles.voiceExample}>{t.onboarding.voiceExample2}</Text>
            <Text style={styles.voiceHint}>{t.onboarding.voiceHint}</Text>
          </View>
        ) : null}
        <View style={styles.dots}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <PrimaryButton label={step >= 4 ? t.onboarding.start : t.onboarding.next} onPress={next} />
        {step === 0 && (
          <PrimaryButton
            label={t.onboarding.loadDemo}
            onPress={loadDemoData}
            loading={loadingDemo}
            variant="secondary"
            style={styles.demoBtn}
          />
        )}
        {step < 4 && (
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
  privacyBadge: { padding: Spacing.md, marginBottom: Spacing.lg, alignItems: "center" },
  privacyIcon: { fontSize: 28, marginBottom: Spacing.xs },
  privacyTitle: { color: Colors.accent, fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: Spacing.xs },
  privacyBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, textAlign: "center" },
  title: { color: Colors.text, ...Typography.title, marginBottom: Spacing.md },
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.xl },
  voiceExamples: { marginBottom: Spacing.lg, gap: Spacing.sm },
  voiceExample: { color: Colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  voiceHint: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: Spacing.sm },
  dots: { flexDirection: "row", gap: 8, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 24, borderRadius: Radius.pill },
  skip: { textAlign: "center", marginTop: Spacing.lg },
  demoBtn: { marginTop: Spacing.md },
});
