import { useCallback, useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import {
  getCoachStep,
  isCoachDone,
  markCoachDone,
  setCoachStep,
} from "@/services/firstRun";

type Props = {
  /** Show coach when home is ready and user has not finished coach. */
  active: boolean;
};

const STEPS = ["expense", "wallets", "transactions"] as const;

export function FirstRunCoach({ active }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!active) return;
      let cancelled = false;
      (async () => {
        if (await isCoachDone()) return;
        const saved = await getCoachStep();
        if (cancelled) return;
        setStep(saved);
        setVisible(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [active]),
  );

  if (!visible) return null;

  const key = STEPS[step] ?? STEPS[0];
  const title = t.firstRun.coach[key].title;
  const body = t.firstRun.coach[key].body;

  const finish = async () => {
    await markCoachDone();
    setVisible(false);
  };

  const next = async () => {
    if (key === "expense") {
      setVisible(false);
      await setCoachStep(1);
      router.push("/(tabs)/input");
      return;
    }
    if (step >= STEPS.length - 1) {
      await finish();
      return;
    }
    const nextStep = step + 1;
    setStep(nextStep);
    await setCoachStep(nextStep);
    if (key === "wallets") {
      router.push("/(tabs)/transactions");
    }
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={finish}>
      <View style={styles.overlay}>
        <Surface variant="elevated" style={styles.card}>
          <Text style={styles.step}>
            {t.firstRun.coachProgress.replace("{current}", String(step + 1)).replace("{total}", String(STEPS.length))}
          </Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <View style={styles.actions}>
            <PrimaryButton
              label={step >= STEPS.length - 1 ? t.firstRun.coachDone : t.firstRun.coachNext}
              onPress={next}
            />
            <PrimaryButton label={t.firstRun.coachSkip} onPress={finish} variant="ghost" />
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "flex-end",
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  card: { padding: Spacing.lg },
  step: { color: Colors.accent, fontSize: 12, fontWeight: "700", marginBottom: Spacing.sm },
  title: { color: Colors.text, fontSize: 20, fontWeight: "800", marginBottom: Spacing.sm },
  body: { color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.lg },
  actions: { gap: Spacing.sm },
});
