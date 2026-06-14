import { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Colors, Spacing } from "@/constants/theme";
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
    <View style={styles.container}>
      <Text style={styles.logo}>💬 TalkCash</Text>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body}>{current.body}</Text>
      <View style={styles.dots}>
        {steps.map((_, i) => (
          <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
        ))}
      </View>
      <TouchableOpacity style={styles.btn} onPress={next}>
        <Text style={styles.btnText}>{step >= 2 ? t.onboarding.start : t.onboarding.next}</Text>
      </TouchableOpacity>
      {step < 2 && (
        <TouchableOpacity onPress={finish}>
          <Text style={styles.skip}>{t.onboarding.skip}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: "center", padding: Spacing.lg },
  logo: { color: Colors.text, fontSize: 28, fontWeight: "700", textAlign: "center", marginBottom: Spacing.xl },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.md },
  body: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.xl },
  dots: { flexDirection: "row", gap: 8, marginBottom: Spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: Colors.accent, width: 20 },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  btnText: { color: Colors.bg, fontWeight: "700", fontSize: 16 },
  skip: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.lg },
});
