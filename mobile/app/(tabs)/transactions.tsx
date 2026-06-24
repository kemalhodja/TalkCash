import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert, Linking, Modal, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { InsightChip } from "@/components/ui/InsightChip";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";
import { parsePositiveAmount } from "@/utils/amount";
import { formatDate, formatMoney } from "@/utils/format";
import { getSubscriptionCancelUrl } from "@/utils/subscriptions";

type DatePreset = "" | "month" | "30d" | "90d";

function resolveDateRange(preset: DatePreset): { fromDate?: string; toDate?: string } {
  if (!preset) return {};
  const now = new Date();
  const toDate = now.toISOString();
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { fromDate: start.toISOString(), toDate };
  }
  const start = new Date(now);
  start.setDate(start.getDate() - (preset === "30d" ? 30 : 90));
  return { fromDate: start.toISOString(), toDate };
}

export default function TransactionsScreen() {
  const { t, locale } = useI18n();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [editTx, setEditTx] = useState<any | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | "income" | "expense">("");
  const [datePreset, setDatePreset] = useState<DatePreset>("");
  const [subscriptionsOnly, setSubscriptionsOnly] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    setError("");
    let cachedCount = 0;
    try {
      const snapshot = await getCachedSnapshot();
      if (snapshot?.transactions?.length) {
        cachedCount = snapshot.transactions.length;
        setTransactions(snapshot.transactions);
      }
      setTransactions(await api.getTransactions(100, {
        search: searchDebounced || undefined,
        category: categoryFilter || undefined,
        ...resolveDateRange(datePreset),
      }));
    } catch (e: any) {
      if (!cachedCount) setTransactions([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, datePreset, searchDebounced, t.common.error]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);
  const { refreshing, onRefresh } = usePullRefresh(load);

  const openEdit = (tx: any) => {
    if (tx.type === "transfer") return;
    setEditTx(tx);
    setEditCategory(tx.category || "");
    setEditDescription(tx.description || "");
    setEditAmount(String(tx.amount || ""));
  };

  const saveEdit = async () => {
    if (!editTx) return;
    const parsedAmount = parsePositiveAmount(editAmount);
    if (!parsedAmount) {
      Alert.alert(t.common.error, t.common.invalidAmount);
      return;
    }
    try {
      await api.updateTransaction(editTx.id, {
        category: editCategory,
        description: editDescription,
        amount: parsedAmount,
      });
      setEditTx(null);
      Alert.alert(t.transactions.title, t.transactions.updated);
      load();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message);
    }
  };

  const confirmDelete = (tx: any) => {
    Alert.alert(t.common.delete, t.transactions.deleteConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteTransaction(tx.id);
            load();
          } catch (e: any) {
            Alert.alert(t.common.error, e.message);
          }
        },
      },
    ]);
  };

  const categories = Array.from(new Set(transactions.map((tx) => tx.category).filter(Boolean)));
  let visibleTransactions = typeFilter
    ? transactions.filter((tx) => tx.type === typeFilter)
    : transactions;
  if (subscriptionsOnly) {
    visibleTransactions = visibleTransactions.filter((tx) => tx.is_recurring);
  }

  if (loading) return <LoadingScreen />;
  if (error && transactions.length === 0) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <>
      <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
        <ScreenHeader title={t.transactions.title} />
        <Surface variant="default" style={styles.filters}>
          <InputField value={search} onChangeText={setSearch} placeholder={t.transactions.search} />
          <ChipPicker
            options={[
              { id: "", label: t.transactions.allTypes },
              { id: "expense", label: t.transactions.expense },
              { id: "income", label: t.transactions.income },
            ]}
            value={typeFilter}
            onChange={(value) => setTypeFilter(value as "" | "income" | "expense")}
          />
          <ChipPicker
            options={[
              { id: "", label: t.transactions.allDates },
              { id: "month", label: t.transactions.thisMonth },
              { id: "30d", label: t.transactions.last30Days },
              { id: "90d", label: t.transactions.last90Days },
            ]}
            value={datePreset}
            onChange={(value) => setDatePreset(value as DatePreset)}
          />
          <ChipPicker
            options={[{ id: "", label: t.transactions.allCategories }, ...categories.map((cat) => ({ id: cat, label: cat }))]}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          <ChipPicker
            options={[
              { id: "all", label: t.transactions.allTypes },
              { id: "subs", label: t.transactions.subscriptionsOnly },
            ]}
            value={subscriptionsOnly ? "subs" : "all"}
            onChange={(value) => setSubscriptionsOnly(value === "subs")}
          />
        </Surface>
        {error ? <InsightChip tone="warning" text={`${error} · ${t.common.staleData}`} /> : null}
        {visibleTransactions.map((tx) => (
          <TouchableOpacity
            key={tx.id}
            onPress={() => openEdit(tx)}
            onLongPress={() => confirmDelete(tx)}
            activeOpacity={0.85}
          >
            <Surface variant="elevated" style={styles.card}>
              <View style={styles.row}>
                <View style={styles.categoryRow}>
                  <Text style={styles.category}>{tx.subscription_name || tx.category}</Text>
                  {tx.is_recurring ? (
                    <InsightChip tone="neutral" text={t.transactions.recurringBadge} />
                  ) : null}
                </View>
                <Text style={[styles.amount, tx.type === "income" && styles.income]}>
                  {tx.type === "income" ? "+" : "-"}{formatMoney(tx.amount, locale)}
                </Text>
              </View>
              <Text style={styles.desc}>{tx.description || tx.place || t.common.noData}</Text>
              {tx.is_recurring && tx.next_billing_date ? (
                <Text style={styles.renewal}>
                  {t.subscription.renewsOn.replace("{date}", formatDate(tx.next_billing_date, locale))}
                </Text>
              ) : null}
              {tx.is_recurring && getSubscriptionCancelUrl(tx.subscription_name) ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(getSubscriptionCancelUrl(tx.subscription_name)!)}
                  style={styles.cancelLink}
                >
                  <Text style={styles.cancelLinkText}>{t.subscription.manageCancel}</Text>
                </TouchableOpacity>
              ) : null}
              {tx.receipt_url ? (
                <TouchableOpacity onPress={() => setPreviewUrl(tx.receipt_url)} style={styles.receiptRow}>
                  <AuthImage path={tx.receipt_url} style={styles.receiptThumb} />
                  <Text style={styles.receiptLabel}>{t.transactions.viewReceipt}</Text>
                </TouchableOpacity>
              ) : null}
              <Text style={styles.date}>{formatDate(tx.date, locale)} · {tx.input_method}</Text>
              {tx.type !== "transfer" && (
                <Text style={styles.hint}>{t.transactions.edit} · {t.common.delete}</Text>
              )}
            </Surface>
          </TouchableOpacity>
        ))}
        {visibleTransactions.length === 0 && <EmptyState message={t.transactions.empty} icon="↕" />}
      </ScreenShell>

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? <AuthImage path={previewUrl} style={styles.previewImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!editTx} transparent animationType="slide" onRequestClose={() => setEditTx(null)}>
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.transactions.edit}</Text>
            <InputField value={editCategory} onChangeText={setEditCategory} placeholder={t.transactions.category} />
            <InputField value={editDescription} onChangeText={setEditDescription} placeholder={t.transactions.description} />
            <InputField value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder={t.transactions.amount} />
            <View style={styles.modalActions}>
              <TextLink label={t.common.cancel} onPress={() => setEditTx(null)} />
              <TextLink label={t.common.save} onPress={saveEdit} />
            </View>
          </Surface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  filters: { padding: Spacing.md, marginBottom: Spacing.md },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  categoryRow: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginRight: Spacing.sm },
  category: { color: Colors.text, fontWeight: "600" },
  amount: { color: Colors.danger, fontWeight: "700" },
  income: { color: Colors.success },
  desc: { color: Colors.textSecondary, marginTop: 4 },
  renewal: { color: Colors.accent, fontSize: 12, marginTop: 4 },
  cancelLink: { marginTop: 6, alignSelf: "flex-start" },
  cancelLinkText: { color: Colors.accent, fontSize: 12, fontWeight: "600" },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  receiptThumb: { width: 48, height: 48, borderRadius: 8, backgroundColor: Colors.bg },
  receiptLabel: { color: Colors.accent, fontSize: 13 },
  previewOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.md },
  previewImage: { width: "100%", height: "80%" },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
});
