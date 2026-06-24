import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as Speech from "expo-speech";
import { PaywallCard } from "@/components/PaywallCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { track } from "@/services/analytics";
import { formatMoney } from "@/utils/format";
import type { SwapNudge } from "@/utils/swapNudge";

interface Props {
  nudge: SwapNudge;
  onTransferred?: () => void;
  onDismiss?: () => void;
}

export function SwapNudgeCard({ nudge, onTransferred, onDismiss }: Props) {
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(false);

  const speak = () => {
    if (nudge.speech_text) {
      Speech.speak(nudge.speech_text, { language: locale === "en" ? "en-US" : "tr-TR" });
    }
  };

  const locked = !!nudge.locked;

  const transfer = async () => {
    if (locked) return;
    if (!nudge.source_wallet_id) {
      Alert.alert(t.common.error, t.microSavings.noSourceWallet);
      return;
    }
    setLoading(true);
    track("micro_savings_transfer_tapped", { rule: nudge.rule_key, amount: nudge.saved_amount });
    try {
      await api.transferMicroSavings(
        nudge.source_wallet_id,
        nudge.target_wallet_id,
        nudge.saved_amount,
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
    <Surface variant="accent" glow style={styles.card} testID="micro-savings-nudge">
      <Text style={styles.label}>{t.microSavings.nudgeLabel}</Text>
      <Text style={styles.text}>{nudge.speech_text}</Text>
      <Text style={styles.amount}>
        {formatMoney(nudge.saved_amount, locale)} → {nudge.target_wallet_name}
      </Text>
      {locked ? (
        <>
          <Text style={styles.locked}>{nudge.upgrade_message || t.microSavings.nudgeLimitReached}</Text>
          <PaywallCard
            title={t.microSavings.title}
            message={nudge.upgrade_message || t.microSavings.nudgeLimitReached}
            recommendedPlan="pro"
          />
        </>
      ) : (
        <View style={styles.actions}>
          <PrimaryButton label={t.microSavings.listen} onPress={speak} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.microSavings.transfer} onPress={transfer} loading={loading} style={styles.btn} testID="micro-savings-transfer" />
          {onDismiss ? (
            <PrimaryButton label={t.common.close} onPress={onDismiss} variant="ghost" style={styles.btn} />
          ) : null}
        </View>
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  label: { color: Colors.accent, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  text: { color: Colors.text, fontSize: 15, lineHeight: 22, marginBottom: Spacing.sm },
  amount: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm },
  locked: { color: Colors.warning, fontSize: 13, marginBottom: Spacing.sm, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  btn: { flexGrow: 1, minWidth: 100 },
});
