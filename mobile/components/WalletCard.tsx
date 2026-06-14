import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";
import { Surface } from "./ui/Surface";

interface Props {
  name: string;
  balance: number;
  balanceTry?: number;
  currency?: string;
  type?: string;
  compact?: boolean;
  style?: ViewStyle;
}

const TYPE_ICONS: Record<string, string> = {
  cash: "💵", bank: "🏦", credit_card: "💳",
  investment_gold: "🥇", investment_forex: "💱",
};

export function WalletCard({
  name, balance, balanceTry, currency = "TRY", type = "cash", compact = false, style,
}: Props) {
  const { t, locale } = useI18n();
  const isDebt = type === "credit_card";
  const showTryEquivalent = currency !== "TRY" && balanceTry != null;

  if (compact) {
    return (
      <Surface variant="interactive" glow style={[styles.compact, style]}>
        <View style={styles.compactAccent} />
        <Text style={styles.compactIcon}>{TYPE_ICONS[type] || "💰"}</Text>
        <Text style={styles.compactName} numberOfLines={1}>{name}</Text>
        <Text style={[styles.compactBalance, isDebt && styles.debt]} numberOfLines={1}>
          {formatMoney(balance, locale, currency)}
        </Text>
        {showTryEquivalent ? (
          <Text style={styles.tryHint}>≈ {formatMoney(balanceTry, locale)}</Text>
        ) : null}
      </Surface>
    );
  }

  return (
    <Surface variant="default" style={[styles.card, style]}>
      <View style={styles.iconRing}>
        <Text style={styles.icon}>{TYPE_ICONS[type] || "💰"}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={[styles.balance, isDebt && styles.debt]}>
          {isDebt ? `${t.home.debt}: ` : ""}
          {formatMoney(balance, locale, currency)}
        </Text>
        {showTryEquivalent ? (
          <Text style={styles.tryHint}>≈ {formatMoney(balanceTry, locale)}</Text>
        ) : null}
      </View>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{type.replace(/_/g, " ")}</Text>
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  compact: {
    width: 140,
    minHeight: 124,
    padding: Spacing.md,
    marginRight: Spacing.sm,
  },
  compactAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: Colors.accent,
    opacity: 0.7,
  },
  compactIcon: { fontSize: 22, marginBottom: 8 },
  compactName: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 4 },
  compactBalance: { color: Colors.text, fontSize: 16, fontWeight: "800" },
  iconRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  name: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  balance: { color: Colors.text, fontSize: 18, fontWeight: "700", marginTop: 2 },
  tryHint: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  debt: { color: Colors.danger },
  typeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    backgroundColor: Colors.bgElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  typeBadgeText: { color: Colors.textMuted, fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
});
