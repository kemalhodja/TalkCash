import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { WalletCard } from "@/components/WalletCard";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { registerForPushNotifications } from "@/services/notifications";

export default function DashboardScreen() {
  const [netWorth, setNetWorth] = useState(0);
  const [wallets, setWallets] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    loadData();
    registerForPushNotifications();
  }, []);

  const loadData = async () => {
    const user = await auth.getUser();
    if (!user) return;
    setUserName(user.fullName);
    try {
      const nw = await api.getNetWorth(user.userId);
      setNetWorth(nw.total_try);
      setWallets(nw.wallets);
      setForecast(await api.getForecast(user.userId, nw.total_try));
      setAlerts(await api.getBudgetAlerts(user.userId));
    } catch {
      setWallets([
        { name: "Nakit", balance: 2500, wallet_type: "cash" },
        { name: "Banka", balance: 45000, wallet_type: "bank" },
      ]);
      setNetWorth(47500);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.greeting}>Merhaba, {userName || "Kullanıcı"}</Text>

      <View style={styles.netWorthCard}>
        <Text style={styles.label}>Net Varlık</Text>
        <Text style={styles.netWorth}>
          {Number(netWorth).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
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
        <WalletCard key={i} name={w.name} balance={Number(w.balance)} type={w.wallet_type} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  greeting: { color: Colors.textSecondary, fontSize: 16, marginBottom: Spacing.sm },
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
  alertDanger: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
  alertText: { color: Colors.warning, fontSize: 14 },
});
