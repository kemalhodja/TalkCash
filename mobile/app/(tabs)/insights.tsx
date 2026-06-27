import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { PaywallCard } from "@/components/PaywallCard";
import { CategoryBarChart } from "@/components/CategoryBarChart";
import { TrendInsightCard } from "@/components/TrendInsightCard";
import { MonthlyReportCard } from "@/components/MonthlyReportCard";
import { MicroSavingsHeroCard } from "@/components/MicroSavingsHeroCard";
import { InvestmentProjectionCard } from "@/components/InvestmentProjectionCard";
import { PortfolioCoachCard } from "@/components/PortfolioCoachCard";
import { BrokerLinksCard } from "@/components/BrokerLinksCard";
import { ErrorState } from "@/components/ErrorState";
import { InsightChip } from "@/components/ui/InsightChip";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { track } from "@/services/analytics";
import { hasAddedFirstExpense } from "@/services/firstRun";
import { getInsightsCache, patchInsightsCache } from "@/services/insightsCache";
import { getPremiumStatus, hasEntitlement, PremiumStatus, refreshPremiumStatus } from "@/services/premium";
import { formatMoney } from "@/utils/format";

export default function InsightsScreen() {
  const { t, locale } = useI18n();
  const [premium, setPremium] = useState<PremiumStatus | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [monthlySummary, setMonthlySummary] = useState<any | null>(null);
  const [microSummary, setMicroSummary] = useState<any | null>(null);
  const [aiInsights, setAiInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAdvancedInsights, setShowAdvancedInsights] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const load = useCallback(async (force = false) => {
    setError("");
    const cached = await getInsightsCache();
    if (cached?.monthlySummary && !force) {
      setMonthlySummary(cached.monthlySummary);
      setSummary(cached.insightsSummary || null);
      setFromCache(true);
      setLoading(false);
    }

    try {
      const status = force ? await refreshPremiumStatus() : await getPremiumStatus();
      setPremium(status);
      const micro = await api.getMicroSavingsSummary().catch(() => microSummary);
      setMicroSummary(micro);
      const monthly = await api.getMonthlySummary().catch(() => cached?.monthlySummary || null);
      setMonthlySummary(monthly);
      let summaryData = cached?.insightsSummary || null;
      let insightData: any[] = [];
      if (hasEntitlement(status, "advanced_reports")) {
        [summaryData, insightData] = await Promise.all([
          api.getInsightsSummary().catch(() => summaryData),
          api.getAiInsights().catch(() => []),
        ]);
        setSummary(summaryData);
        setAiInsights(insightData);
      } else {
        setSummary(null);
        setAiInsights([]);
      }
      await patchInsightsCache({ monthlySummary: monthly, insightsSummary: summaryData });
      setFromCache(false);
    } catch (e: any) {
      if (!cached?.monthlySummary) {
        setError(e.message || t.common.error);
      }
    } finally {
      setLoading(false);
    }
  }, [microSummary, t.common.error]);

  useEffect(() => {
    track("insights_screen_opened");
    load();
    hasAddedFirstExpense().then((done) => setShowAdvancedInsights(done));
  }, [load]);

  const { refreshing, onRefresh } = usePullRefresh(() => load(true));

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(true);
    try {
      const blob = type === "pdf" ? await api.exportPdf() : await api.exportExcel();
      const ext = type === "pdf" ? "pdf" : "xlsx";
      const path = `${FileSystem.cacheDirectory}talkcash-report.${ext}`;
      await FileSystem.writeAsStringAsync(path, blob, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      } else {
        Alert.alert(t.common.confirm, t.insightsScreen.exportSaved);
      }
      track("insights_export", { type });
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !monthlySummary && !summary) {
    return (
      <ScreenShell ambient="subtle">
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
  }
  if (error && !summary && !microSummary && !monthlySummary) {
    return <ErrorState message={error} onRetry={() => load(true)} />;
  }

  const locked = !hasEntitlement(premium, "advanced_reports");
  const savingsData = microSummary || summary?.micro_savings;
  const narratives = summary?.narratives || monthlySummary?.narratives || [];
  const chartCategories = summary?.top_categories || monthlySummary?.top_categories || [];

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        title={t.tabs.insights}
        subtitle={`${t.premium.currentPlan}: ${(premium?.plan || "free").toUpperCase()}${fromCache ? ` · ${t.insightsScreen.cachedHint}` : ""}`}
      />
      <MicroSavingsHeroCard summary={savingsData} compact />
      {showAdvancedInsights ? <BrokerLinksCard /> : null}
      {locked && showAdvancedInsights ? (
        <>
          {monthlySummary ? (
            <MonthlyReportCard data={monthlySummary} showDetailsLink />
          ) : null}
          {(narratives.length > 0 || chartCategories.length > 0) ? (
            <Surface variant="default" style={styles.section}>
              <Text style={styles.sectionTitle}>{t.insightsScreen.trendAnalysis}</Text>
              <TrendInsightCard items={narratives} />
              <CategoryBarChart items={chartCategories} locale={locale} />
            </Surface>
          ) : null}
          <Surface variant="default" style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
            <Text style={{ color: Colors.textSecondary, lineHeight: 20 }}>{t.insightsScreen.freeMonthlyReport}</Text>
          </Surface>
          <PaywallCard onUpgraded={() => load(true)} />
        </>
      ) : locked && !showAdvancedInsights ? (
        <Surface variant="default" style={{ padding: Spacing.md, marginBottom: Spacing.md }}>
          <Text style={{ color: Colors.textSecondary, lineHeight: 20 }}>{t.insightsScreen.unlockAfterFirstExpense}</Text>
        </Surface>
      ) : (
        <>
          {summary?.month ? (
            <Text style={styles.monthLabel}>
              {t.insightsScreen.monthSummary.replace("{month}", summary.month)}
            </Text>
          ) : null}
          <Surface variant="elevated" style={styles.hero}>
            <Text style={styles.label}>{t.insightsScreen.cashflow}</Text>
            <Text style={styles.heroValue}>{formatMoney(summary?.cashflow?.net || 0, locale)}</Text>
            <View style={styles.row}>
              <Metric label={t.insightsScreen.income} value={formatMoney(summary?.cashflow?.income || 0, locale)} />
              <Metric label={t.insightsScreen.expense} value={formatMoney(summary?.cashflow?.expense || 0, locale)} />
              <Metric label={t.insightsScreen.savings} value={summary?.cashflow?.savings_rate == null ? "—" : `%${summary.cashflow.savings_rate}`} />
            </View>
          </Surface>

          <Section title={t.insightsScreen.trendAnalysis}>
            <TrendInsightCard items={narratives} />
          </Section>

          <Section title={t.insightsScreen.topCategories}>
            <CategoryBarChart items={chartCategories} locale={locale} />
          </Section>

          <Surface variant="default" style={styles.section}>
            <Text style={styles.sectionTitle}>{t.insightsScreen.exportTitle}</Text>
            <View style={styles.exportRow}>
              <PrimaryButton
                label={t.insightsScreen.exportPdf}
                onPress={() => handleExport("pdf")}
                loading={exporting}
                style={styles.exportBtn}
              />
              <PrimaryButton
                label={t.insightsScreen.exportExcel}
                onPress={() => handleExport("excel")}
                loading={exporting}
                variant="ghost"
                style={styles.exportBtn}
              />
            </View>
          </Surface>

          <Surface variant="default" style={styles.netWorthCard}>
            <Text style={styles.metricLabel}>{t.insightsScreen.netWorth}</Text>
            <Text style={styles.netWorthValue}>{formatMoney(summary?.net_worth_total || 0, locale)}</Text>
          </Surface>

          <Section title={t.microSavings.title}>
            {savingsData ? (
              <>
                <MetricRow
                  label={t.microSavings.monthSaved}
                  value={formatMoney(savingsData.month_saved || 0, locale)}
                />
                {summary?.micro_savings?.year_projection != null ? (
                  <MetricRow
                    label={t.microSavings.yearProjection}
                    value={formatMoney(summary.micro_savings.year_projection, locale)}
                  />
                ) : null}
              </>
            ) : (
              <Text style={styles.muted}>{t.microSavings.noSavingsYet}</Text>
            )}
          </Section>

          <PortfolioCoachCard
            portfolio={summary?.micro_savings?.portfolio}
            monthlyProjection={summary?.micro_savings?.monthly_projection}
            yearProjection={summary?.micro_savings?.year_projection}
          />

          <InvestmentProjectionCard />

          <Section title={t.insightsScreen.aiInsights}>
            {aiInsights.length ? aiInsights.map((item) => (
              <InsightChip
                key={item.id}
                text={`${item.title}: ${item.summary}`}
                tone={item.severity === "danger" ? "danger" : item.severity === "warning" ? "warning" : "success"}
              />
            )) : <Text style={styles.muted}>{t.insightsScreen.noInsights}</Text>}
          </Section>

          <Section title={t.insightsScreen.budgetHealth}>
            {(summary?.budget_health || []).map((budget: any) => (
              <MetricRow key={budget.category} label={`${budget.category} · %${budget.percent}`} value={formatMoney(budget.spent, locale)} />
            ))}
          </Section>

          {(summary?.wallets?.length ?? 0) > 0 ? (
            <Section title={t.insightsScreen.wallets}>
              {(summary?.wallets || []).map((wallet: any) => (
                <MetricRow key={wallet.id} label={wallet.name} value={formatMoney(wallet.balance, locale)} />
              ))}
            </Section>
          ) : null}
        </>
      )}
    </ScreenShell>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface variant="default" style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Surface>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricRowLabel}>{label}</Text>
      <Text style={styles.metricRowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monthLabel: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.sm, fontWeight: "600" },
  hero: { padding: Spacing.lg, marginBottom: Spacing.md },
  netWorthCard: { padding: Spacing.md, marginBottom: Spacing.md },
  netWorthValue: { color: Colors.text, fontSize: 24, fontWeight: "800", marginTop: 4 },
  label: { color: Colors.accent, ...Typography.label },
  heroValue: { color: Colors.text, fontSize: 34, fontWeight: "800", marginVertical: Spacing.sm },
  row: { flexDirection: "row", gap: Spacing.sm },
  metric: { flex: 1 },
  metricLabel: { color: Colors.textMuted, fontSize: 12 },
  metricValue: { color: Colors.text, fontWeight: "700", marginTop: 4 },
  section: { padding: Spacing.md, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.sm },
  muted: { color: Colors.textMuted },
  metricRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  metricRowLabel: { color: Colors.textSecondary, flex: 1 },
  metricRowValue: { color: Colors.text, fontWeight: "700" },
  exportRow: { flexDirection: "row", gap: Spacing.sm },
  exportBtn: { flex: 1 },
});
