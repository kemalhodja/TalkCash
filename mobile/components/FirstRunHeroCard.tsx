import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";

type Props = {
  onTryDemo?: () => void;
  loadingDemo?: boolean;
};

export function FirstRunHeroCard({ onTryDemo, loadingDemo }: Props) {
  const { t } = useI18n();

  return (
    <Surface variant="accent" glow style={styles.card} testID="first-run-hero">
      <Text style={styles.eyebrow}>{t.firstRun.heroEyebrow}</Text>
      <Text style={styles.title}>{t.firstRun.heroTitle}</Text>
      <Text style={styles.body}>{t.firstRun.heroBody}</Text>
      <View style={styles.actions}>
        <PrimaryButton
          label={t.firstRun.heroCtaExpense}
          onPress={() => router.push("/(tabs)/input")}
          testID="first-run-add-expense"
        />
        {onTryDemo ? (
          <PrimaryButton
            label={t.firstRun.heroCtaDemo}
            onPress={onTryDemo}
            loading={loadingDemo}
            variant="secondary"
          />
        ) : null}
      </View>
      <Text style={styles.hint}>{t.firstRun.heroHint}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, marginBottom: Spacing.md },
  eyebrow: { color: Colors.accent, ...Typography.label, marginBottom: Spacing.xs },
  title: { color: Colors.text, fontSize: 22, fontWeight: "800", marginBottom: Spacing.sm },
  body: { color: Colors.textSecondary, lineHeight: 22, marginBottom: Spacing.md },
  actions: { gap: Spacing.sm },
  hint: { color: Colors.textMuted, fontSize: 12, marginTop: Spacing.md, textAlign: "center" },
});
