import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { ErrorState } from "@/components/ErrorState";
import { BudgetProgressCard } from "@/components/ui/BudgetProgressCard";
import { DialogModal } from "@/components/ui/DialogModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightChip } from "@/components/ui/InsightChip";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";
import { isQueuedResult, showQueuedAlert } from "@/utils/apiWriteResult";

export default function BudgetsScreen() {
  const { t, locale } = useI18n();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editLimit, setEditLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    let cachedCount = 0;
    try {
      const snapshot = await getCachedSnapshot();
      if (snapshot?.budgets?.length) {
        cachedCount = snapshot.budgets.length;
        setBudgets(snapshot.budgets);
      }
      setBudgets(await api.getBudgets());
    } catch (e: any) {
      if (!cachedCount) setBudgets([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);
  const { refreshing, onRefresh } = usePullRefresh(load);

  const handleAdd = async () => {
    if (!category || !limit) return;
    try {
      const res = await api.createBudget(category, parseFloat(limit));
      if (isQueuedResult(res)) showQueuedAlert(t.common.confirm, t.common.offlineQueued);
      setCategory(""); setLimit("");
      load();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    }
  };

  const handleUpdate = async () => {
    if (!editing || !editLimit) return;
    try {
      const res = await api.updateBudget(editing.id, parseFloat(editLimit));
      if (isQueuedResult(res)) showQueuedAlert(t.common.confirm, t.common.offlineQueued);
      setEditing(null); setEditLimit("");
      load();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await api.deleteBudget(id);
      if (isQueuedResult(res)) showQueuedAlert(t.common.confirm, t.common.offlineQueued);
      load();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.common.error);
    }
  };

  if (loading) return <LoadingScreen />;
  if (error && budgets.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
        <ScreenHeader title={t.budget.title} />
        {error ? <InsightChip tone="warning" text={`${error} · ${t.common.staleData}`} /> : null}

        <SectionBlock title={t.budget.add} bare>
          <Surface variant="glass" style={styles.form}>
            <InputField placeholder={t.budget.category} value={category} onChangeText={setCategory} />
            <InputField placeholder={t.budget.limit} keyboardType="decimal-pad" value={limit} onChangeText={setLimit} />
            <PrimaryButton label={t.budget.add} onPress={handleAdd} />
          </Surface>
        </SectionBlock>

        <SectionBlock title={t.budget.title} bare>
          {budgets.map((b) => {
            const percent = b.percent ?? 0;
            const spent = b.spent ?? 0;
            return (
              <BudgetProgressCard
                key={b.id}
                category={b.category}
                spent={Number(spent)}
                limit={Number(b.monthly_limit)}
                percent={percent}
                locale={locale}
                usedLabel={t.budget.used}
                perMonthLabel={t.budget.perMonth}
                deleteLabel={t.common.delete}
                onLongPress={() => { setEditing(b); setEditLimit(String(b.monthly_limit)); }}
                onDelete={() => handleDelete(b.id)}
              />
            );
          })}
          {budgets.length === 0 && <EmptyState message={t.budget.empty} icon="◎" />}
        </SectionBlock>
      </ScreenShell>

      <DialogModal
        visible={!!editing}
        title={`${t.budget.edit}: ${editing?.category ?? ""}`}
        footer={
          <View style={styles.modalActions}>
            <PrimaryButton label={t.common.cancel} onPress={() => setEditing(null)} variant="ghost" style={styles.modalBtn} />
            <PrimaryButton label={t.common.save} onPress={handleUpdate} style={styles.modalBtn} />
          </View>
        }
      >
        <InputField placeholder={t.budget.newLimit} keyboardType="decimal-pad" value={editLimit} onChangeText={setEditLimit} />
      </DialogModal>
    </>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.md },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md, width: "100%" },
  modalBtn: { flex: 1 },
});
