import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { formatMoney } from "@/utils/format";

export function InvestmentProjectionCard() {
  const { t, locale } = useI18n();
  const [projection, setProjection] = useState<any | null>(null);

  useEffect(() => {
    api.simulateMicroSavings({ monthly_contribution: 0, months: 12 })
      .then(setProjection)
      .catch(() => setProjection(null));
  }, []);

  if (!projection?.final_balance) return null;

  return (
    <Surface variant="glass" style={styles.card} testID="investment-projection">
      <Text style={styles.title}>{t.portfolio.yearProjection.replace(
        "{amount}",
        formatMoney(projection.final_balance, locale),
      )}</Text>
      <Text style={styles.disclaimer}>{t.microSavings.simulationDisclaimer}</Text>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.text, fontSize: 15, fontWeight: "700", lineHeight: 22 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, marginTop: Spacing.sm, fontStyle: "italic" },
});
