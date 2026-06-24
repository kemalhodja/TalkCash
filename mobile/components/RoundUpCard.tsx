import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { formatMoney } from "@/utils/format";
import type { RoundUpNudge } from "@/utils/roundUp";

interface Props {
  nudge: RoundUpNudge;
  onTransferred?: () => void;
  onDismiss?: () => void;
}

export function RoundUpCard({ nudge, onTransferred, onDismiss }: Props) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);

  if (nudge.auto_applied) {
    return (
      <Surface variant="glass" style={styles.card}>
        <Text style={styles.label}>{t.microSavings.roundUpTitle}</Text>
        <Text style={styles.text}>
          {t.microSavings.roundUpAutoApplied.replace("{amount}", formatMoney(nudge.spare_amount, locale))}
        </Text>
      </Surface>
    );
  }

  const transfer = async () => {
    if (!nudge.source_wallet_id) {
      Alert.alert(t.common.error, t.microSavings.noSourceWallet);
      return;
    }
    setLoading(true);
    try {
      await api.transferMicroSavings(
        nudge.source_wallet_id,
        nudge.target_wallet_id,
        nudge.spare_amount,
        nudge.rule_key,
      );
      Alert.alert(t.microSavings.title, t.microSavings.transferred);
      onTransferred?.();
      onDismiss?.();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface variant="glass" style={styles.card}>
      <Text style={styles.label}>{t.microSavings.roundUpTitle}</Text>
      <Text style={styles.text}>{nudge.speech_text}</Text>
      {nudge.auto_requires_premium ? (
        <Text style={styles.premiumHint}>{t.microSavings.autoRoundUpPremium}</Text>
      ) : null}
      <Text style={styles.amount}>
        {formatMoney(nudge.spare_amount, locale)} → {nudge.target_wallet_name}
      </Text>
      <View style={styles.actions}>
        <PrimaryButton
          label={t.microSavings.listen}
          onPress={() => Speech.speak(nudge.speech_text, { language: locale === "en" ? "en-US" : "tr-TR" })}
          variant="ghost"
          style={styles.btn}
        />
        <PrimaryButton label={t.microSavings.roundUpTransfer} onPress={transfer} loading={loading} style={styles.btn} />
        {onDismiss ? (
          <PrimaryButton label={t.common.close} onPress={onDismiss} variant="ghost" style={styles.btn} />
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  label: { color: Colors.accent, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  text: { color: Colors.text, fontSize: 15, lineHeight: 22, marginBottom: Spacing.sm },
  premiumHint: { color: Colors.warning, fontSize: 12, marginBottom: Spacing.sm },
  amount: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  btn: { flexGrow: 1, minWidth: 100 },
});
