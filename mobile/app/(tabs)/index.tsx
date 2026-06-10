import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WalletCard } from "@/components/WalletCard";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";

const DEMO_USER = "00000000-0000-0000-0000-000000000001";

export default function DashboardScreen() {
  const [netWorth, setNetWorth] = useState(0);
  const [wallets, setWallets] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const nw = await api.getNetWorth(DEMO_USER);
      setNetWorth(nw.total_try);
      setWallets(nw.wallets);
      const fc = await api.getForecast(DEMO_USER, nw.total_try);
      setForecast(fc);
      const al = await api.getBudgetAlerts(DEMO_USER);
      setAlerts(al);
    } catch {
      setWallets([
        { name: "Nakit", balance: 2500, wallet_type: "cash" },
        { name: "Banka", balance: 45000, wallet_type: "bank" },
        { name: "Kredi Kartı", balance: -3200, wallet_type: "credit_card" },
      ]);
      setNetWorth(44300);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.netWorthCard}>
        <Text style={styles.label}>Net Varlık</Text>
        <Text style={styles.netWorth}>
          {netWorth.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </Text>
      </View>

      {forecast?.warning && (
        <View style={styles.alertCard}>
          <Text style={styles.alertText}>⚠️ {forecast.message}</Text>
        </View>
      )}

      {alerts.map((a, i) => (
        <View key={i} style={[styles.alertCard, a.type === "budget_exceeded" && styles.alertDanger]}>
          <Text style={styles.alertText}>{a.message}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Kasalarım</Text>
      {wallets.map((w, i) => (
        <WalletCard
          key={i}
          name={w.name}
          balance={Number(w.balance)}
          type={w.wallet_type}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  netWorthCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.lg,
    alignItems: "center", marginBottom: Spacing.lg,
    borderWidth: 1, borderColor: Colors.border,
  },
  label: { color: Colors.textSecondary, fontSize: 14 },
  netWorth: { color: Colors.accent, fontSize: 36, fontWeight: "800", marginTop: 4 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  alertCard: {
    backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 10,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
  },
  alertDanger: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderColor: "rgba(239,68,68,0.3)",
  },
  alertText: { color: Colors.warning, fontSize: 14 },
});
