import { StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

type Props = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Surface variant="glass" style={styles.card}>
        <Text style={styles.icon}>!</Text>
        <Text style={styles.message}>{message || t.common.error}</Text>
        {onRetry ? (
          <PrimaryButton label={t.common.retry} onPress={onRetry} style={styles.btn} />
        ) : null}
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: Spacing.lg, backgroundColor: Colors.bg },
  card: { padding: Spacing.xl, alignItems: "center", width: "100%", maxWidth: 320 },
  icon: {
    color: Colors.danger,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: Spacing.md,
    width: 48,
    height: 48,
    lineHeight: 48,
    textAlign: "center",
    borderRadius: 24,
    backgroundColor: "rgba(248,113,113,0.12)",
    overflow: "hidden",
  },
  message: { color: Colors.textSecondary, textAlign: "center", marginBottom: Spacing.lg, lineHeight: 22 },
  btn: { alignSelf: "stretch" },
});
