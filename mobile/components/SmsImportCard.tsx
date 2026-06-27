import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

type Props = {
  onPaste: () => void;
  compact?: boolean;
};

export function SmsImportCard({ onPaste, compact }: Props) {
  const { t } = useI18n();
  return (
    <Surface variant={compact ? "glass" : "accent"} style={styles.card} accessibilityRole="summary">
      <Text style={styles.eyebrow}>{t.input.smsImportEyebrow}</Text>
      <Text style={styles.title}>{t.input.smsImportTitle}</Text>
      <Text style={styles.body}>{t.input.smsImportBody}</Text>
      <PrimaryButton
        label={t.input.smsPaste}
        onPress={onPaste}
        variant={compact ? "secondary" : "primary"}
        compact={compact}
        accessibilityLabel={t.input.smsPaste}
      />
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  eyebrow: { color: Colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, marginBottom: Spacing.xs },
  title: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.xs },
  body: { color: Colors.textSecondary, lineHeight: 20, marginBottom: Spacing.md },
});
