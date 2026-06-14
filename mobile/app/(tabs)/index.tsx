import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IncomeModal } from "@/components/IncomeModal";
import { ErrorState } from "@/components/ErrorState";
import { TransferModal } from "@/components/TransferModal";
import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletEditModal } from "@/components/WalletEditModal";
import { WalletCard } from "@/components/WalletCard";
import { AppBrandHeader } from "@/components/ui/AppBrandHeader";
import { HeroNetWorth } from "@/components/ui/HeroNetWorth";
import { InsightChip } from "@/components/ui/InsightChip";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import { registerForPushNotifications } from "@/services/notifications";
import { formatMoney } from "@/utils/format";
import { speakBudgetAlert } from "@/services/speech";
import { getCachedSnapshot } from "@/services/syncCache";

export default function DashboardScreen() {
  const { t, locale } = useI18n();
  const insets = useSafeAreaInsets();
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
  const [walletEdit, setWalletEdit] = useState<any | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watchProduct, setWatchProduct] = useState("");
  const [trackProduct, setTrackProduct] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
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
      const snapshot = await getCachedSnapshot();
      if (snapshot?.wallets?.length) {
        setNetWorth(Number(snapshot.net_worth_total || 0));
        setWallets(snapshot.wallets);
      }
      const [nw, budgetAlerts, priceReportData, watchItems] = await Promise.all([
        api.getNetWorth(),
        api.getBudgetAlerts(),
        api.getPriceTracker(productQuery),
        api.getWatchlist().catch(() => []),
      ]);
      setNetWorth(nw.total_try);
      setWallets(nw.wallets);
      setWatchlist(watchItems);
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
      if (e instanceof ApiError && e.status === 0) {
        setError(t.errors.network);
      } else {
        setError(e.message || t.home.loadError);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [locale, t.home.loadError, t.errors.network]);

  useEffect(() => { loadData(); registerForPushNotifications(); }, [loadData]);
  useEffect(() => {
    setTrackProduct((prev) => prev || t.home.defaultProduct);
  }, [t.home.defaultProduct]);
  useRefreshOnFocus(loadData);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  if (error && wallets.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.md }]}>
        <ErrorState message={error} onRetry={() => { setLoading(true); setError(""); loadData(); }} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.sm, paddingBottom: insets.bottom + 100 }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.accent} />
      }
    >
      <AppBrandHeader greeting={t.home.greeting} name={userName || t.common.user} />

      {error ? <InsightChip text={error} tone="danger" /> : null}

      <HeroNetWorth label={t.home.netWorth} amount={formatMoney(Number(netWorth), locale)} />

      <QuickActionGrid
        actions={[
          { key: "income", label: t.home.addIncome, icon: "add-circle-outline", onPress: () => setIncomeVisible(true), primary: true },
          { key: "transfer", label: t.home.transfer, icon: "swap-horizontal-outline", onPress: () => setTransferVisible(true) },
          { key: "wallet", label: t.home.createWallet, icon: "wallet-outline", onPress: () => setWalletCreateVisible(true) },
          { key: "voice", label: t.tabs.input, icon: "mic-outline", onPress: () => router.push("/input") },
        ]}
      />

      <Text style={styles.sectionTitle}>{t.home.wallets}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.walletScroll}>
        {wallets.map((w) => (
          <TouchableOpacity key={w.id} onLongPress={() => setWalletEdit(w)} activeOpacity={0.9}>
            <WalletCard
              compact
              name={w.name}
              balance={Number(w.balance)}
              balanceTry={w.balance_try != null ? Number(w.balance_try) : undefined}
              currency={w.currency}
              type={w.wallet_type}
            />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {forecast && Number(forecast.burn_rate_daily) > 0 && (
        <InsightChip
          tone="success"
          text={t.home.burnRateDaily.replace("{amount}", formatMoney(Number(forecast.burn_rate_daily), locale))}
        />
      )}
      {forecast && Number(forecast.burn_rate_daily) > 0 && (
        <InsightChip
          tone={forecast.warning ? "warning" : "neutral"}
          text={t.home.projectedBalance.replace("{amount}", formatMoney(Number(forecast.projected_balance), locale))}
        />
      )}
      {forecast?.warning && <InsightChip tone="warning" text={forecast.message} />}
      {alerts.map((a, i) => (
        <InsightChip key={i} tone={a.type === "budget_exceeded" ? "danger" : "warning"} text={a.message} />
      ))}

      <TouchableOpacity onPress={() => setToolsOpen(!toolsOpen)} style={styles.toolsToggle}>
        <Text style={styles.toolsToggleText}>{toolsOpen ? "▾" : "▸"} {t.home.moreTools}</Text>
      </TouchableOpacity>

      {toolsOpen && (
        <Surface variant="elevated" style={styles.toolsPanel}>
          <View style={styles.toolLinks}>
            {[
              { label: t.tabs.budget, route: "/budget" },
              { label: t.tabs.mentor, route: "/mentor" },
              { label: t.tabs.social, route: "/social" },
            ].map((item) => (
              <TouchableOpacity key={item.route} style={styles.toolLink} onPress={() => router.push(item.route as any)}>
                <Text style={styles.toolLinkText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.miniTitle}>{t.home.watchlist}</Text>
          {watchlist.map((w) => (
            <View key={w.id} style={styles.watchRow}>
              <Text style={styles.watchName}>{w.product_name}</Text>
              <TouchableOpacity onPress={async () => { await api.removeWatchlistItem(w.id); loadData(); }}>
                <Text style={styles.watchRemove}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={styles.priceRow}>
            <TextInput style={styles.priceInput} placeholder={t.home.pricePlaceholder}
              placeholderTextColor={Colors.textMuted} value={watchProduct} onChangeText={setWatchProduct} />
            <TouchableOpacity style={styles.priceBtn} onPress={async () => {
              if (!watchProduct.trim()) return;
              await api.addWatchlistItem(watchProduct.trim());
              setWatchProduct("");
              loadData();
            }}>
              <Text style={styles.priceBtnText}>{t.home.addWatch}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.miniTitle}>{t.home.priceTracker}</Text>
          <View style={styles.priceRow}>
            <TextInput style={styles.priceInput} placeholder={t.home.pricePlaceholder}
              placeholderTextColor={Colors.textMuted} value={trackProduct} onChangeText={setTrackProduct} />
            <TouchableOpacity style={styles.priceBtn} onPress={() => { setRefreshing(true); loadData(trackProduct); }}>
              <Text style={styles.priceBtnText}>{t.home.trackPrice}</Text>
            </TouchableOpacity>
          </View>
          {priceReport?.has_data && priceReport?.message && (
            <InsightChip tone="neutral" text={priceReport.message} />
          )}
        </Surface>
      )}

      <Text style={[styles.sectionTitle, { marginTop: Spacing.lg }]}>{t.home.allWallets}</Text>
      {wallets.map((w) => (
        <TouchableOpacity key={`full-${w.id}`} onLongPress={() => setWalletEdit(w)} activeOpacity={0.9}>
          <WalletCard
            name={w.name}
            balance={Number(w.balance)}
            balanceTry={w.balance_try != null ? Number(w.balance_try) : undefined}
            currency={w.currency}
            type={w.wallet_type}
          />
        </TouchableOpacity>
      ))}

      <IncomeModal visible={incomeVisible} onClose={() => setIncomeVisible(false)} onSuccess={loadData} />
      <TransferModal visible={transferVisible} onClose={() => setTransferVisible(false)} onSuccess={loadData} />
      <WalletCreateModal visible={walletCreateVisible} onClose={() => setWalletCreateVisible(false)} onSuccess={loadData} />
      <WalletEditModal visible={!!walletEdit} wallet={walletEdit} onClose={() => setWalletEdit(null)} onSuccess={loadData} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  sectionTitle: { color: Colors.text, ...Typography.title, fontSize: 18, marginBottom: Spacing.sm },
  walletScroll: { marginBottom: Spacing.lg, marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  toolsToggle: { marginBottom: Spacing.sm },
  toolsToggleText: { color: Colors.textMuted, fontSize: 13, fontWeight: "600" },
  toolsPanel: { padding: Spacing.md, marginBottom: Spacing.lg },
  toolLinks: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  toolLink: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accentSoft,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  toolLinkText: { color: Colors.accent, fontWeight: "700", fontSize: 12 },
  miniTitle: { color: Colors.textSecondary, ...Typography.label, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  priceRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  priceInput: {
    flex: 1, backgroundColor: Colors.bgElevated, borderRadius: Radius.sm, padding: Spacing.md,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  priceBtn: { backgroundColor: Colors.accent, borderRadius: Radius.sm, paddingHorizontal: Spacing.md, justifyContent: "center" },
  priceBtnText: { color: Colors.bg, fontWeight: "700" },
  watchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  watchName: { color: Colors.textSecondary, fontSize: 14 },
  watchRemove: { color: Colors.danger, fontSize: 16, padding: 4 },
});
