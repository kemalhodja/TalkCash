import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

interface Props {
  name: string;
  balance: number;
  currency?: string;
  type?: string;
}

const TYPE_ICONS: Record<string, string> = {
  cash: "💵", bank: "🏦", credit_card: "💳",
  investment_gold: "🥇", investment_forex: "💱",
};

export function WalletCard({ name, balance, currency = "TRY", type = "cash" }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{TYPE_ICONS[type] || "💰"}</Text>
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.balance}>
          {balance.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} {currency}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 12,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  icon: { fontSize: 28, marginRight: Spacing.md },
  info: { flex: 1 },
  name: { color: Colors.textSecondary, fontSize: 14 },
  balance: { color: Colors.text, fontSize: 18, fontWeight: "700", marginTop: 2 },
});
