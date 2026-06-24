import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { track } from "@/services/analytics";
import { dismissMicroSavingsIntro, isMicroSavingsIntroDismissed } from "@/services/microSavingsIntro";

interface Props {
  visibleWhenEmpty?: boolean;
}

export function MicroSavingsIntroBanner({ visibleWhenEmpty = true }: Props) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    isMicroSavingsIntroDismissed().then((dismissed) => {
      if (!dismissed) setVisible(true);
    });
  }, []);

  if (!visible || !visibleWhenEmpty) return null;

  const dismiss = async () => {
    track("micro_savings_intro_dismissed");
    await dismissMicroSavingsIntro();
    setVisible(false);
  };

  const tryIt = async () => {
    track("micro_savings_intro_cta");
    await dismissMicroSavingsIntro();
    setVisible(false);
    router.push("/input");
  };

  return (
    <Surface variant="glass" style={styles.card} testID="micro-savings-intro">
      <Text style={styles.title}>{t.microSavings.onboardingTitle}</Text>
      <Text style={styles.body}>{t.microSavings.onboardingBody}</Text>
      <View style={styles.actions}>
        <PrimaryButton label={t.microSavings.heroCtaExpense} onPress={tryIt} style={styles.btn} />
        <PrimaryButton label={t.common.close} onPress={dismiss} variant="ghost" style={styles.btn} />
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.accent, fontSize: 14, fontWeight: "800", marginBottom: 4 },
  body: { color: Colors.textSecondary, fontSize: 13, lineHeight: 20, marginBottom: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap" },
  btn: { flexGrow: 1, minWidth: 120 },
});
