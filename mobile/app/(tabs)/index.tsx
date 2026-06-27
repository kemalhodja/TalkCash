import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { MonthlyReportCard } from "@/components/MonthlyReportCard";
import { router } from "expo-router";
import { IncomeModal } from "@/components/IncomeModal";
import { ErrorState } from "@/components/ErrorState";
import { TransferModal } from "@/components/TransferModal";
import { WalletCreateModal } from "@/components/WalletCreateModal";
import { WalletEditModal } from "@/components/WalletEditModal";
import { FirstRunCoach } from "@/components/FirstRunCoach";
import { FirstRunHeroCard } from "@/components/FirstRunHeroCard";
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
import { MicroSavingsIntroBanner } from "@/components/MicroSavingsIntroBanner";
import {
  consumePendingDemoOffer,
  hasAddedFirstExpense,
  isSimpleHomeMode,
  markDemoOfferShown,
  markFirstExpenseAdded,
  wasDemoOfferShown,
} from "@/services/firstRun";
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
  const [showFirstRunHero, setShowFirstRunHero] = useState(false);
  const [simpleHome, setSimpleHome] = useState(true);
  const [demoLoading, setDemoLoading] = useState(false);
  const [monthlySummary, setMonthlySummary] = useState<any | null>(null);
  const demoOfferShownRef = useRef(false);
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
      const [nw, budgetAlerts, priceReportData, watchItems, savingsSummary, subsData, monthly] = await Promise.all([
        api.getNetWorth(),
        api.getBudgetAlerts(),
        api.getPriceTracker(productQuery),
        api.getWatchlist().catch(() => []),
        api.getMicroSavingsSummary().catch(() => null),
        api.getUpcomingSubscriptions().catch(() => ({ subscriptions: [] })),
        api.getMonthlySummary().catch(() => null),
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
      setMonthlySummary(monthly);
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
    (async () => {
      const [firstDone, simple] = await Promise.all([hasAddedFirstExpense(), isSimpleHomeMode()]);
      setShowFirstRunHero(!firstDone);
      setSimpleHome(simple);
    })();
  }, [loadData]);
  useEffect(() => {
    setTrackProduct((prev) => prev || t.home.defaultProduct);
  }, [t.home.defaultProduct]);
  useRefreshOnFocus(async () => {
    loadData();
    const firstDone = await hasAddedFirstExpense();
    setShowFirstRunHero(!firstDone);
    setSimpleHome(await isSimpleHomeMode());
  });

  const handleDemoLoad = async () => {
    setDemoLoading(true);
    try {
      const res = await api.seedDemoData();
      if (res.status === "seeded") {
        await markFirstExpenseAdded();
      }
      setShowFirstRunHero(false);
      setSimpleHome(await isSimpleHomeMode());
      loadData();
    } catch {
      Alert.alert(t.onboarding.demoTitle, t.onboarding.demoFailed);
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    if (loading || demoOfferShownRef.current) return;
    (async () => {
      const pending = await consumePendingDemoOffer();
      if (!pending || await wasDemoOfferShown()) return;
      demoOfferShownRef.current = true;
      await markDemoOfferShown();
      Alert.alert(
        t.firstRun.demoOfferTitle,
        t.firstRun.demoOfferBody,
        [
          { text: t.firstRun.demoOfferSkip, style: "cancel" },
          { text: t.firstRun.demoOfferAccept, onPress: () => { void handleDemoLoad(); } },
        ],
      );
    })();
  }, [loading, t.firstRun.demoOfferAccept, t.firstRun.demoOfferBody, t.firstRun.demoOfferSkip, t.firstRun.demoOfferTitle]);

  const microHasActivity = Boolean(
    microSavings?.week_saved || microSavings?.month_saved || microSavings?.investment_total,
  );

  if (loading) {
    return (
      <ScreenShell ambient>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
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

      {showFirstRunHero ? (
        <FirstRunHeroCard onTryDemo={handleDemoLoad} loadingDemo={demoLoading} />
      ) : null}

      <HeroNetWorth label={t.home.netWorth} amount={formatMoney(Number(netWorth), locale)} />

      {monthlySummary ? (
        <MonthlyReportCard data={monthlySummary} compact showDetailsLink />
      ) : null}

      {!simpleHome && microHasActivity ? (
        <MicroSavingsHeroCard summary={microSavings} />
      ) : null}

      {showFirstRunHero || (!simpleHome && !microHasActivity) ? (
        <MicroSavingsIntroBanner />
      ) : null}

      {!simpleHome ? <WeeklyPodcastCard /> : null}

      {!simpleHome ? <UpcomingSubscriptionsCard items={upcomingSubs} /> : null}

      <QuickActionGrid
        actions={[
          { key: "expense", label: t.tabs.input, icon: "mic-outline", onPress: () => router.push("/(tabs)/input"), primary: true },
          { key: "income", label: t.home.addIncome, icon: "add-circle-outline", onPress: () => setIncomeVisible(true) },
          { key: "transfer", label: t.home.transfer, icon: "swap-horizontal-outline", onPress: () => setTransferVisible(true) },
          { key: "wallet", label: t.home.createWallet, icon: "wallet-outline", onPress: () => setWalletCreateVisible(true) },
          ...(simpleHome ? [
            { key: "shopping", label: t.firstRun.quickShopping, icon: "cart-outline" as const, onPress: () => router.push("/(tabs)/shopping") },
            { key: "agenda", label: t.firstRun.quickAgenda, icon: "calendar-outline" as const, onPress: () => router.push("/(tabs)/agenda") },
            { key: "budget", label: t.firstRun.quickBudget, icon: "pie-chart-outline" as const, onPress: () => router.push("/(tabs)/budgets") },
            { key: "mentor", label: t.firstRun.quickMentor, icon: "chatbubble-ellipses-outline" as const, onPress: () => router.push("/(tabs)/mentor") },
          ] : [
            { key: "whisper", label: t.quickVoice.title, icon: "ear-outline" as const, onPress: () => router.push("/quick-voice?hold=1") },
          ]),
        ]}
      />

      {simpleHome ? (
        <Text style={styles.simpleHint}>{t.firstRun.simpleHomeHint}</Text>
      ) : null}

      <SectionBlock title={t.home.wallets} bare>
        {wallets.length === 0 ? (
          <EmptyState
            message={t.home.createWallet}
            icon="💰"
            actionLabel={t.home.createWallet}
            onAction={() => setWalletCreateVisible(true)}
          />
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

      {!simpleHome ? (
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
      ) : null}

      {!simpleHome ? (
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
      ) : null}

      <FirstRunCoach active={!showFirstRunHero} />
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
  simpleHint: { color: Colors.textMuted, fontSize: 12, textAlign: "center", marginBottom: Spacing.md },
});
