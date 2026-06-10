import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { IncomeModal } from "@/components/IncomeModal";
import { TransferModal } from "@/components/TransferModal";
import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletCard } from "@/components/WalletCard";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { registerForPushNotifications } from "@/services/notifications";

export default function DashboardScreen() {
  const { t } = useI18n();
  const [netWorth, setNetWorth] = useState(0);
  const [wallets, setWallets] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [priceReport, setPriceReport] = useState<any>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [transferVisible, setTransferVisible] = useState(false);
  const [incomeVisible, setIncomeVisible] = useState(false);
  const [walletCreateVisible, setWalletCreateVisible] = useState(false);

  const loadData = async () => {
    const user = await auth.getUser();
    if (!user) return;
    setUserName(user.fullName);
    try {
      setError("");
      const nw = await api.getNetWorth();
      setNetWorth(nw.total_try);
      setWallets(nw.wallets);
      setForecast(await api.getForecast(nw.total_try));
      setAlerts(await api.getBudgetAlerts());
      setPriceReport(await api.getPriceTracker("süt"));
    } catch (e: any) {
      setError(e.message || t.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadData(); registerForPushNotifications(); }, []);
  useRefreshOnFocus(loadData);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }}
          tintColor={Colors.accent} />
      }>
      <Text style={styles.greeting}>{t.home.greeting}, {userName || "User"}</Text>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.netWorthCard}>
        <Text style={styles.label}>{t.home.netWorth}</Text>
        <Text style={styles.netWorth}>
          {Number(netWorth).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setIncomeVisible(true)}>
          <Text style={styles.actionText}>{t.home.addIncome}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setTransferVisible(true)}>
          <Text style={styles.actionText}>{t.home.transfer}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setWalletCreateVisible(true)}>
          <Text style={styles.actionText}>{t.home.createWallet}</Text>
        </TouchableOpacity>
      </View>

      {forecast?.warning && (
        <View style={styles.alertCard}><Text style={styles.alertText}>⚠️ {forecast.message}</Text></View>
      )}

      {alerts.map((a, i) => (
        <View key={i} style={[styles.alertCard, a.type === "budget_exceeded" && styles.alertDanger]}>
          <Text style={styles.alertText}>{a.message}</Text>
        </View>
      ))}

      {priceReport?.message && !priceReport.message.includes("bulunamadı") && (
        <View style={styles.alertCard}><Text style={styles.alertText}>📊 {priceReport.message}</Text></View>
      )}

      <Text style={styles.sectionTitle}>{t.home.wallets}</Text>
      {wallets.map((w) => (
        <WalletCard key={w.id} name={w.name} balance={Number(w.balance)} type={w.wallet_type} />
      ))}

      <IncomeModal visible={incomeVisible} onClose={() => setIncomeVisible(false)} onSuccess={loadData} />
      <TransferModal visible={transferVisible} onClose={() => setTransferVisible(false)} onSuccess={loadData} />
      <WalletCreateModal visible={walletCreateVisible} onClose={() => setWalletCreateVisible(false)} onSuccess={loadData} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  greeting: { color: Colors.textSecondary, fontSize: 16, marginBottom: Spacing.sm },
  netWorthCard: {
    backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.lg,
    alignItems: "center", marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  label: { color: Colors.textSecondary, fontSize: 14 },
  netWorth: { color: Colors.accent, fontSize: 36, fontWeight: "800", marginTop: 4 },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  actionBtn: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    alignItems: "center", borderWidth: 1, borderColor: Colors.accent,
  },
  actionText: { color: Colors.accent, fontWeight: "700", fontSize: 13 },
  sectionTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  alertCard: {
    backgroundColor: "rgba(245,158,11,0.1)", borderRadius: 10, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: "rgba(245,158,11,0.3)",
  },
  alertDanger: { backgroundColor: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)" },
  alertText: { color: Colors.warning, fontSize: 14 },
  errorCard: { backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.md },
  errorText: { color: Colors.danger, textAlign: "center" },
});
