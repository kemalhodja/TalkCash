import { StyleSheet, Text, View } from "react-native";
import { SwapNudgeCard } from "@/components/SwapNudgeCard";
import { RoundUpCard } from "@/components/RoundUpCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { pullAndCacheSnapshot } from "@/services/syncCache";
import type { SwapNudge } from "@/utils/swapNudge";
import type { RoundUpNudge } from "@/utils/roundUp";

interface Props {
  swap: SwapNudge | null;
  roundUp: RoundUpNudge | null;
  onDismiss: () => void;
  onRefresh?: () => void;
}

export function MicroSavingsNudges({ swap, roundUp, onDismiss, onRefresh }: Props) {
  const { t } = useI18n();
  if (!swap && !roundUp) return null;

  const refresh = async () => {
    try {
      await pullAndCacheSnapshot();
    } catch {
      /* best-effort */
    }
    onRefresh?.();
  };

  const both = !!(swap && roundUp);

  return (
    <View style={styles.stack}>
      {both ? <Text style={styles.hint}>{t.microSavings.combinedHint}</Text> : null}
      {roundUp ? (
        <RoundUpCard
          nudge={roundUp}
          onTransferred={refresh}
          onDismiss={both ? undefined : onDismiss}
        />
      ) : null}
      {swap ? (
        <SwapNudgeCard
          nudge={swap}
          onTransferred={refresh}
          onDismiss={both ? undefined : onDismiss}
        />
      ) : null}
      {both ? (
        <PrimaryButton label={t.common.close} onPress={onDismiss} variant="ghost" style={styles.closeAll} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { marginBottom: Spacing.md },
  hint: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  closeAll: { marginTop: Spacing.xs },
});
