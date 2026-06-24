import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { router } from "expo-router";
import { IncomeModal } from "@/components/IncomeModal";
import { ErrorState } from "@/components/ErrorState";
import { TransferModal } from "@/components/TransferModal";
import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletEditModal } from "@/components/WalletEditModal";
import { MicroSavingsIntroBanner } from "@/components/MicroSavingsIntroBanner";
import { MicroSavingsHeroCard } from "@/components/MicroSavingsHeroCard";
import { WeeklyPodcastCard } from "@/components/WeeklyPodcastCard";
import { UpcomingSubscriptionsCard } from "@/components/UpcomingSubscriptionsCard";
import { WalletCard } from "@/components/WalletCard";
import { AppBrandHeader } from "@/components/ui/AppBrandHeader";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { HeroNetWorth } from "@/components/ui/HeroNetWorth";
import { InputField } from "@/components/ui/InputField";
import { InsightChip } from "@/components/ui/InsightChip";
import { ListRow } from "@/components/ui/ListRow";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { QuickActionGrid } from "@/components/ui/QuickActionGrid";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { auth } from "@/services/auth";
import { registerForPushNotifications } from "@/services/notifications";
import { formatMoney } from "@/utils/format";
import { speakBudgetAlert } from "@/services/speech";
import { getCachedSnapshot } from "@/services/syncCache";
import { extractUpcomingSubscriptions } from "@/utils/subscriptions";

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
  const [walletEdit, setWalletEdit] = useState<any | null>(null);
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watchProduct, setWatchProduct] = useState("");
  const [trackProduct, setTrackProduct] = useState("");
  const [toolsOpen, setToolsOpen] = useState(false);
  const [microSavings, setMicroSavings] = useState<any | null>(null);
  const [upcomingSubs, setUpcomingSubs] = useState<any[]>([]);
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
      setUpcomingSubs(extractUpcomingSubscriptions(snapshot?.transactions));
      const [nw, budgetAlerts, priceReportData, watchItems, savingsSummary, subsData] = await Promise.all([
        api.getNetWorth(),
        api.getBudgetAlerts(),
        api.getPriceTracker(productQuery),
        api.getWatchlist().catch(() => []),
        api.getMicroSavingsSummary().catch(() => null),
        api.getUpcomingSubscriptions().catch(() => ({ subscriptions: [] })),
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
      setMicroSavings(savingsSummary);
      if (subsData?.subscriptions?.length) {
        setUpcomingSubs(subsData.subscriptions.map((s) => ({
          subscription_name: s.subscription_name,
          amount: s.amount,
          next_billing_date: s.next_billing_date,
          cancel_url: s.cancel_url,
        })));
      }
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

  useEffect(() => {
    loadData();
    registerForPushNotifications().catch(() => {});
  }, [loadData]);
  useEffect(() => {
    setTrackProduct((prev) => prev || t.home.defaultProduct);
  }, [t.home.defaultProduct]);
  useRefreshOnFocus(loadData);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} size="large" /></View>;
  }

  if (error && wallets.length === 0) {
    return (
      <ScreenShell ambient="subtle">
        <ErrorState message={error} onRetry={() => { setLoading(true); setError(""); loadData(); }} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell
      ambient
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); loadData(); }}
    >
      <AppBrandHeader greeting={t.home.greeting} name={userName || t.common.user} />

      {error ? <InsightChip text={error} tone="danger" /> : null}

      <HeroNetWorth label={t.home.netWorth} amount={formatMoney(Number(netWorth), locale)} />

      <MicroSavingsHeroCard summary={microSavings} />

      {!(microSavings?.week_saved || microSavings?.investment_total) ? (
        <MicroSavingsIntroBanner />
      ) : null}

      <WeeklyPodcastCard />

      <UpcomingSubscriptionsCard items={upcomingSubs} />

      <QuickActionGrid
        actions={[
          { key: "income", label: t.home.addIncome, icon: "add-circle-outline", onPress: () => setIncomeVisible(true), primary: true },
          { key: "whisper", label: t.quickVoice.title, icon: "ear-outline", onPress: () => router.push("/quick-voice?hold=1") },
          { key: "transfer", label: t.home.transfer, icon: "swap-horizontal-outline", onPress: () => setTransferVisible(true) },
          { key: "wallet", label: t.home.createWallet, icon: "wallet-outline", onPress: () => setWalletCreateVisible(true) },
          { key: "voice", label: t.tabs.input, icon: "mic-outline", onPress: () => router.push("/(tabs)/input") },
        ]}
      />

      <SectionBlock title={t.home.wallets} bare>
        {wallets.length === 0 ? (
          <EmptyState message={t.home.createWallet} icon="💰" />
        ) : (
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
        )}
      </SectionBlock>

      {(forecast || alerts.length > 0) && (
        <SectionBlock title={t.home.insights} bare contentStyle={styles.insights}>
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
        </SectionBlock>
      )}

      <SectionBlock
        title={t.home.moreTools}
        actionLabel={toolsOpen ? "▾" : "▸"}
        onAction={() => setToolsOpen(!toolsOpen)}
        bare
      >
        {toolsOpen ? (
          <Surface variant="elevated" style={styles.toolsPanel}>
            <ChipPicker
              options={[
                { id: "/budgets", label: t.tabs.budget },
                { id: "/mentor", label: t.tabs.mentor },
                { id: "/social", label: t.tabs.social },
              ]}
              value={null}
              onChange={(route) => router.push(route as any)}
            />

            <Text style={styles.miniTitle}>{t.home.watchlist}</Text>
            {watchlist.map((w) => (
              <ListRow
                key={w.id}
                title={w.product_name}
                trailing={
                  <TouchableOpacity onPress={async () => { await api.removeWatchlistItem(w.id); loadData(); }} hitSlop={8}>
                    <Text style={styles.watchRemove}>✕</Text>
                  </TouchableOpacity>
                }
              />
            ))}
            <View style={styles.priceRow}>
              <InputField
                placeholder={t.home.pricePlaceholder}
                value={watchProduct}
                onChangeText={setWatchProduct}
                containerStyle={styles.flexInput}
              />
              <PrimaryButton
                label={t.home.addWatch}
                compact
                onPress={async () => {
                  if (!watchProduct.trim()) return;
                  await api.addWatchlistItem(watchProduct.trim());
                  setWatchProduct("");
                  loadData();
                }}
              />
            </View>

            <Text style={styles.miniTitle}>{t.home.priceTracker}</Text>
            <View style={styles.priceRow}>
              <InputField
                placeholder={t.home.pricePlaceholder}
                value={trackProduct}
                onChangeText={setTrackProduct}
                containerStyle={styles.flexInput}
              />
              <PrimaryButton
                label={t.home.trackPrice}
                compact
                onPress={() => { setRefreshing(true); loadData(trackProduct); }}
              />
            </View>
            {priceReport?.has_data && priceReport?.message && (
              <InsightChip tone="neutral" text={priceReport.message} />
            )}
          </Surface>
        ) : null}
      </SectionBlock>

      <SectionBlock title={t.home.allWallets} bare>
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
      </SectionBlock>

      <IncomeModal visible={incomeVisible} onClose={() => setIncomeVisible(false)} onSuccess={loadData} />
      <TransferModal visible={transferVisible} onClose={() => setTransferVisible(false)} onSuccess={loadData} />
      <WalletCreateModal visible={walletCreateVisible} onClose={() => setWalletCreateVisible(false)} onSuccess={loadData} />
      <WalletEditModal visible={!!walletEdit} wallet={walletEdit} onClose={() => setWalletEdit(null)} onSuccess={loadData} />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  walletScroll: { marginHorizontal: -Spacing.md, paddingHorizontal: Spacing.md },
  insights: { gap: Spacing.sm },
  toolsPanel: { padding: Spacing.md },
  miniTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: Spacing.sm, marginTop: Spacing.sm },
  priceRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm, alignItems: "center" },
  flexInput: { flex: 1, marginBottom: 0 },
  watchRemove: { color: Colors.danger, fontSize: 16, padding: 4 },
});
