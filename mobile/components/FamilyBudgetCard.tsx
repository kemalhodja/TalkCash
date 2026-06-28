import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";

type Props = {
  name: string;
  balance: number;
  currency: string;
  monthlyTotal: number;
  membersCount: number;
  sharedWalletId?: string | null;
  recentExpenses?: { amount: number; description: string; by: string }[];
};

export function FamilyBudgetCard({
  name,
  balance,
  currency,
  monthlyTotal,
  membersCount,
  sharedWalletId,
  recentExpenses = [],
}: Props) {
  const { t, locale } = useI18n();
  const { colors } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { padding: Spacing.md, gap: Spacing.sm, marginBottom: Spacing.md },
        title: { color: colors.text, ...Typography.title, fontSize: 17 },
        meta: { color: colors.textMuted, fontSize: 13 },
        row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
        balance: { color: colors.accent, fontSize: 24, fontWeight: "800" },
        monthly: { color: colors.textSecondary, fontSize: 14 },
        expenseRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
        expenseDesc: { color: colors.textSecondary, fontSize: 13, flex: 1, marginRight: 8 },
        expenseAmt: { color: colors.text, fontSize: 13, fontWeight: "600" },
      }),
    [colors],
  );

  return (
    <Surface variant="glass" glow style={styles.wrap} testID="family-budget-card">
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.meta}>{t.workspaces.membersCount.replace("{count}", String(membersCount))}</Text>
      <View style={styles.row}>
        <Text style={styles.balance}>{formatMoney(balance, locale, currency)}</Text>
      </View>
      <Text style={styles.monthly}>
        {t.workspaces.monthlySpend.replace("{amount}", formatMoney(monthlyTotal, locale, currency))}
      </Text>
      {recentExpenses.slice(0, 3).map((e, i) => (
        <View key={i} style={styles.expenseRow}>
          <Text style={styles.expenseDesc} numberOfLines={1}>{e.description || e.by}</Text>
          <Text style={styles.expenseAmt}>{formatMoney(e.amount, locale, currency)}</Text>
        </View>
      ))}
      {sharedWalletId ? (
        <PrimaryButton
          label={t.workspaces.openSharedWallet}
          onPress={() => router.push("/(tabs)/social")}
          variant="secondary"
          compact
        />
      ) : null}
    </Surface>
  );
}
