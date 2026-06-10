import { useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { WalletCard } from "@/components/WalletCard";
import { Colors, Spacing } from "@/constants/theme";
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
  const [error, setError] = useState("");

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
      setError(e.message || "Veriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); registerForPushNotifications(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={loadData} tintColor={Colors.accent} />}>
      <Text style={styles.greeting}>{t.home.greeting}, {userName || "User"}</Text>

      {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}

      <View style={styles.netWorthCard}>
        <Text style={styles.label}>{t.home.netWorth}</Text>
        <Text style={styles.netWorth}>
          {Number(netWorth).toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ₺
        </Text>
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
    alignItems: "center", marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border,
  },
  label: { color: Colors.textSecondary, fontSize: 14 },
  netWorth: { color: Colors.accent, fontSize: 36, fontWeight: "800", marginTop: 4 },
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
