import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
import { speakBudgetAlert } from "@/services/speech";

export default function DashboardScreen() {
  const { t, locale } = useI18n();
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
  const [trackProduct, setTrackProduct] = useState("süt");
  const trackProductRef = useRef(trackProduct);
  const lastSpokenAlert = useRef("");
  trackProductRef.current = trackProduct;

  const loadData = useCallback(async (product?: string) => {
    const user = await auth.getUser();
    if (!user) return;
    setUserName(user.fullName);
    const productQuery = product ?? trackProductRef.current;
    try {
      setError("");
      const [nw, budgetAlerts, priceReportData] = await Promise.all([
        api.getNetWorth(),
        api.getBudgetAlerts(),
        api.getPriceTracker(productQuery),
      ]);
      setNetWorth(nw.total_try);
      setWallets(nw.wallets);
      setForecast(await api.getForecast(nw.total_try));
      setAlerts(budgetAlerts);
      if (budgetAlerts.length > 0) {
        const msg = budgetAlerts[0].message;
        if (msg && msg !== lastSpokenAlert.current) {
          lastSpokenAlert.current = msg;
          speakBudgetAlert(msg, locale);
        }
      }
      setPriceReport(priceReportData);
    } catch (e: any) {
      setError(e.message || t.home.loadError);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locale, t.home.loadError]);

  useEffect(() => { loadData(); registerForPushNotifications(); }, [loadData]);
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

      <View style={styles.priceTracker}>
        <Text style={styles.sectionTitle}>{t.home.priceTracker}</Text>
        <View style={styles.priceRow}>
          <TextInput style={styles.priceInput} placeholder={t.home.pricePlaceholder}
            placeholderTextColor={Colors.textMuted} value={trackProduct} onChangeText={setTrackProduct} />
          <TouchableOpacity style={styles.priceBtn} onPress={() => { setRefreshing(true); loadData(trackProduct); }}>
            <Text style={styles.priceBtnText}>{t.home.trackPrice}</Text>
          </TouchableOpacity>
        </View>
        {priceReport?.message && !priceReport.message.includes("bulunamadı") && !priceReport.message.includes("insufficient") && (
          <View style={styles.alertCard}>
            <Text style={styles.alertText}>📊 {priceReport.message}</Text>
            {priceReport.source === "ocr" && <Text style={styles.sourceTag}>OCR</Text>}
          </View>
        )}
      </View>

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
  priceTracker: { marginBottom: Spacing.lg },
  priceRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  priceInput: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  priceBtn: { backgroundColor: Colors.accent, borderRadius: 10, paddingHorizontal: Spacing.md, justifyContent: "center" },
  priceBtnText: { color: Colors.bg, fontWeight: "700" },
  sourceTag: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
});
