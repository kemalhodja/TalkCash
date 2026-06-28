import { useEffect, useState } from "react";
import { StyleSheet, Text, View, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MicPermissionCard } from "@/components/MicPermissionCard";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { LANGUAGE_OPTIONS } from "@/constants/languages";
import { useI18n, type Locale } from "@/i18n";
import { track, getOnboardingVariant, trackOnboardingComplete } from "@/services/analytics";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { setPendingInputText } from "@/services/firstRun";
import { registerForPushNotifications } from "@/services/notifications";
import { hapticImpact, hapticSelection } from "@/utils/haptics";
import {
  getOnboardingLastStep,
  getOnboardingPrimaryLabel,
  isOnboardingPinStep,
} from "@/utils/onboardingFlow";

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
  const [tryText, setTryText] = useState("");
  const [tryLoading, setTryLoading] = useState(false);
  const [variant, setVariant] = useState<"short" | "full">("short");

  useEffect(() => {
    getOnboardingVariant().then(setVariant);
    isOnboardingComplete().then((done) => {
      if (done) router.replace("/(tabs)");
    });
  }, []);

  const [loadingDemo, setLoadingDemo] = useState(false);
  const [micReady, setMicReady] = useState(false);

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
    await trackOnboardingComplete();
    track("onboarding_completed");
    await markOnboardingComplete();
    auth.setUnlocked(true);
    router.replace("/(tabs)");
  };

  const finishWithPin = async () => {
    await markOnboardingComplete();
    auth.setUnlocked(true);
    router.replace("/lock");
  };

  const tryParse = async () => {
    const text = tryText.trim();
    if (!text) return;
    setTryLoading(true);
    try {
      const result = await api.parseText(text, false);
      if (result?.parsed?.intent === "add_expense") {
        await setPendingInputText(text);
        Alert.alert(t.onboarding.welcomeTitle, t.firstRun.onboardingTrySuccess, [
          { text: t.firstRun.onboardingTryGo, onPress: () => router.replace("/(tabs)/input") },
          { text: t.common.close, style: "cancel" },
        ]);
      } else {
        Alert.alert(t.onboarding.welcomeTitle, result?.message || t.firstRun.onboardingTrySuccess);
      }
    } catch {
      Alert.alert(t.common.error, t.common.error);
    } finally {
      setTryLoading(false);
    }
  };

  const next = async () => {
    if (step === 1) {
      try { await registerForPushNotifications(); } catch { /* optional */ }
    }
    if (variant === "full" && step === 2) {
      try {
        await api.updateMicroSavingsPrefs({ round_up_enabled: true, round_up_step: 10 });
      } catch { /* optional */ }
    }
    const lastStep = getOnboardingLastStep(variant);
    if (step >= lastStep) {
      await hapticImpact("success");
      await finish();
      return;
    }
    hapticSelection();
    track("onboarding_step", { step: step + 1, variant });
    setStep(step + 1);
  };

  const steps = variant === "short"
    ? [
        { title: t.onboarding.welcomeTitle, body: t.onboarding.welcomeBody },
        { title: t.onboarding.voiceTitle, body: t.onboarding.voiceBody },
        { title: t.onboarding.pushTitle, body: t.onboarding.pushBody },
      ]
    : [
        { title: t.onboarding.welcomeTitle, body: t.onboarding.welcomeBody },
        { title: t.onboarding.voiceTitle, body: t.onboarding.voiceBody },
        { title: t.onboarding.pushTitle, body: t.onboarding.pushBody },
        { title: t.onboarding.microSavingsTitle, body: t.onboarding.microSavingsBody },
        { title: t.onboarding.pinTitle, body: t.onboarding.pinBody },
      ];
  const current = steps[step] ?? steps[0];
  const lastStep = getOnboardingLastStep(variant);
  const stepTotal = steps.length;
  const progressLabel = t.onboarding.stepProgress
    .replace("{current}", String(step + 1))
    .replace("{total}", String(stepTotal));

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
        <Text style={styles.progress} accessibilityRole="text" accessibilityLiveRegion="polite">
          {progressLabel}
        </Text>
        {step === 1 ? (
          <>
            {!micReady ? (
              <MicPermissionCard
                onGranted={() => setMicReady(true)}
                onSkip={() => setMicReady(true)}
              />
            ) : (
              <>
                <Text style={styles.micGranted}>{t.onboarding.micGranted}</Text>
                <View style={styles.voiceExamples}>
                  <Text style={styles.voiceExample}>{t.onboarding.voiceExample1}</Text>
                  <Text style={styles.voiceExample}>{t.onboarding.voiceExample2}</Text>
                  <Text style={styles.voiceHint}>{t.onboarding.voiceHint}</Text>
                </View>
                <Text style={styles.tryLabel}>{t.firstRun.onboardingTryTitle}</Text>
                <Text style={styles.tryBody}>{t.firstRun.onboardingTryBody}</Text>
                <InputField
                  placeholder={t.firstRun.onboardingTryPlaceholder}
                  value={tryText}
                  onChangeText={setTryText}
                  onSubmitEditing={tryParse}
                />
                <PrimaryButton
                  label={t.firstRun.onboardingTrySubmit}
                  onPress={tryParse}
                  loading={tryLoading}
                  variant="secondary"
                  style={styles.tryBtn}
                />
              </>
            )}
          </>
        ) : null}
        <View style={styles.dots} accessibilityRole="progressbar" accessibilityLabel={progressLabel}>
          {steps.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} accessibilityElementsHidden />
          ))}
        </View>
        {isOnboardingPinStep(variant, step) ? (
          <View style={styles.pinActions}>
            <PrimaryButton label={t.firstRun.pinSetupNow} onPress={finishWithPin} />
            <PrimaryButton label={t.firstRun.pinSkipStart} onPress={finish} variant="secondary" />
          </View>
        ) : (
          <PrimaryButton
            label={getOnboardingPrimaryLabel(variant, step, { next: t.onboarding.next, start: t.onboarding.start })}
            onPress={next}
          />
        )}
        {step === 0 && (
          <PrimaryButton
            label={t.onboarding.loadDemo}
            onPress={loadDemoData}
            loading={loadingDemo}
            variant="secondary"
            style={styles.demoBtn}
          />
        )}
        {step < lastStep && (
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
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.md },
  progress: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: Spacing.lg },
  voiceExamples: { marginBottom: Spacing.lg, gap: Spacing.sm },
  voiceExample: { color: Colors.text, fontSize: 15, fontWeight: "600", textAlign: "center" },
  voiceHint: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: Spacing.sm },
  micGranted: { color: Colors.accent, fontSize: 14, fontWeight: "600", textAlign: "center", marginBottom: Spacing.md },
  tryLabel: { color: Colors.text, fontWeight: "700", marginBottom: Spacing.xs },
  tryBody: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  tryBtn: { marginBottom: Spacing.md },
  dots: { flexDirection: "row", gap: 8, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 24, borderRadius: Radius.pill },
  skip: { textAlign: "center", marginTop: Spacing.lg },
  demoBtn: { marginTop: Spacing.md },
  pinActions: { gap: Spacing.sm },
});
