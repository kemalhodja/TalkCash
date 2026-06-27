import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { BrokerLinksCard } from "@/components/BrokerLinksCard";
import { ErrorState } from "@/components/ErrorState";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { SettingSwitchRow } from "@/components/ui/SettingSwitchRow";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getPremiumStatus, hasEntitlement } from "@/services/premium";

type Prefs = {
  round_up_enabled: boolean;
  round_up_step: number;
  auto_round_up: boolean;
  preferred_broker: string;
  default_investment_wallet: string;
};

export default function MicroSavingsSettingsScreen() {
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const [p, premium] = await Promise.all([
        api.getMicroSavingsPrefs(),
        getPremiumStatus(true),
      ]);
      setPrefs(p);
      setIsPremium(hasEntitlement(premium, "portfolio_coach") || !!premium.is_premium);
    } catch (e: any) {
      setError(e.message || t.common.error);
    }
  }, [t.common.error]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = usePullRefresh(load);

  const patch = async (partial: Partial<Prefs>) => {
    if (!prefs) return;
    try {
      const next = await api.updateMicroSavingsPrefs(partial);
      setPrefs(next);
    } catch (e: any) {
      Alert.alert(t.common.error, e.message);
    }
  };

  if (!prefs && error) return <ErrorState message={error} onRetry={load} />;
  if (!prefs) return <LoadingScreen />;

  const stepOptions = [5, 10, 25].map((n) => ({ id: String(n), label: `${n} TL` }));
  const walletOptions = [
    { id: "investment_gold", label: t.microSavings.walletGold },
    { id: "investment_forex", label: t.microSavings.walletForex },
  ];
  const brokerOptions = [
    { id: "midas", label: "Midas" },
    { id: "papara", label: "Papara" },
    { id: "none", label: t.microSavings.brokerNone },
  ];

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t.microSavings.settingsTitle} subtitle={t.microSavings.settingsSubtitle} />
      <SectionBlock title={t.microSavings.roundUpTitle} bare>
        <Surface variant="default" style={styles.panel}>
          <SettingSwitchRow
            label={t.microSavings.roundUpEnabled}
            value={prefs.round_up_enabled}
            onValueChange={(v) => patch({ round_up_enabled: v })}
          />
          <ChipPicker
            label={t.microSavings.roundUpStep}
            options={stepOptions}
            value={String(prefs.round_up_step)}
            onChange={(id) => patch({ round_up_step: Number(id) })}
          />
          <SettingSwitchRow
            label={t.microSavings.autoRoundUp}
            value={prefs.auto_round_up}
            onValueChange={(v) => {
              if (v && !isPremium) {
                Alert.alert(t.premium.title, t.microSavings.autoRoundUpPremium);
                return;
              }
              patch({ auto_round_up: v });
            }}
          />
          <Text style={styles.subHint}>
            {isPremium ? t.microSavings.autoRoundUpHint : t.microSavings.autoRoundUpPremium}
          </Text>
          <ChipPicker
            label={t.microSavings.defaultInvestmentWallet}
            options={walletOptions}
            value={prefs.default_investment_wallet}
            onChange={(id) => patch({ default_investment_wallet: id })}
          />
        </Surface>
      </SectionBlock>

      <SectionBlock title={t.microSavings.brokersTitle} bare>
        <ChipPicker
          label={t.microSavings.preferredBroker}
          options={brokerOptions}
          value={prefs.preferred_broker}
          onChange={(id) => patch({ preferred_broker: id })}
        />
        <BrokerLinksCard />
      </SectionBlock>

      <Text style={styles.hint} onPress={() => router.push("/(tabs)/insights")}>
        {t.microSavings.viewInsights}
      </Text>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  panel: { padding: Spacing.md },
  subHint: { color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.sm, marginTop: -Spacing.xs },
  hint: { color: Colors.accent, textAlign: "center", marginTop: Spacing.lg, fontWeight: "600" },
});
