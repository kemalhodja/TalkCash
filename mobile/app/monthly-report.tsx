import { useCallback, useEffect, useState } from "react";
import { Stack } from "expo-router";
import { ErrorState } from "@/components/ErrorState";
import { MonthlyReportCard } from "@/components/MonthlyReportCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Colors } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useI18n } from "@/i18n";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";

export default function MonthlyReportScreen() {
  const { t } = useI18n();
  useRequireUnlock();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await api.getMonthlySummary());
    } catch (e: any) {
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => { load(); }, [load]);
  const { refreshing, onRefresh } = usePullRefresh(load);

  if (loading) {
    return (
      <ScreenShell ambient="subtle">
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
  }
  if (error || !data) return <ErrorState message={error || t.common.error} onRetry={load} />;

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen
        options={{
          title: t.monthlyReport.screenTitle,
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
        }}
      />
      <MonthlyReportCard data={data} />
    </ScreenShell>
  );
}
