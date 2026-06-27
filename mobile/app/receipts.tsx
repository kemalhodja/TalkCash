import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { Stack } from "expo-router";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { InputField } from "@/components/ui/InputField";
import { InsightChip } from "@/components/ui/InsightChip";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";
import { parsePositiveAmount } from "@/utils/amount";
import { formatDate, formatMoney } from "@/utils/format";

export default function ReceiptsScreen() {
  const { t, locale } = useI18n();
  useRequireUnlock();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"" | "true" | "false">("");
  const [editReceipt, setEditReceipt] = useState<any | null>(null);
  const [editMerchant, setEditMerchant] = useState("");
  const [editAmount, setEditAmount] = useState("");
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
      if (snapshot?.receipts?.length) {
        cachedCount = snapshot.receipts.length;
        setReceipts(snapshot.receipts);
      }
      setReceipts(await api.getReceipts({
        merchant: searchDebounced || undefined,
        verified: verifiedFilter === "" ? undefined : verifiedFilter === "true",
      }));
    } catch (e: any) {
      if (!cachedCount) setReceipts([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [searchDebounced, verifiedFilter, t.common.error]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnFocus(load);
  const { refreshing, onRefresh } = usePullRefresh(load);

  const openEdit = (receipt: any) => {
    setEditReceipt(receipt);
    setEditMerchant(receipt.merchant || "");
    setEditAmount(receipt.total_amount != null ? String(receipt.total_amount) : "");
  };

  const saveEdit = async () => {
    if (!editReceipt) return;
    const amount = editAmount.trim() ? parsePositiveAmount(editAmount) : undefined;
    if (editAmount.trim() && amount == null) {
      Alert.alert(t.common.error, t.common.invalidAmount);
      return;
    }
    try {
      await api.updateReceipt(editReceipt.id, {
        merchant: editMerchant.trim() || undefined,
        total_amount: amount ?? undefined,
      });
      setEditReceipt(null);
      load();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message);
    }
  };

  const confirmDelete = (receipt: any) => {
    Alert.alert(t.common.delete, t.receipts.deleteConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteReceipt(receipt.id);
            load();
          } catch (e: any) {
            Alert.alert(t.common.error, e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenShell bottomInset={false} ambient="subtle">
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
  }
  if (error && receipts.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScreenShell bottomInset={false} ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title: t.receipts.title, headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />
      {error ? <InsightChip tone="warning" text={`${error} · ${t.common.staleData}`} /> : null}
      <Surface variant="default" style={styles.filters}>
        <InputField value={search} onChangeText={setSearch} placeholder={t.receipts.search} />
        <ChipPicker
          options={[
            { id: "", label: t.receipts.allStatuses },
            { id: "true", label: t.receipts.verified },
            { id: "false", label: t.receipts.unverified },
          ]}
          value={verifiedFilter}
          onChange={(v) => setVerifiedFilter(v as "" | "true" | "false")}
        />
      </Surface>
      <SectionBlock title={t.receipts.title} bare>
        {receipts.map((r) => (
          <TouchableOpacity key={r.id} onPress={() => openEdit(r)} onLongPress={() => confirmDelete(r)} activeOpacity={0.85}>
            <Surface variant="elevated" style={styles.card}>
              {r.image_url ? (
                <AuthImage path={r.image_url} style={styles.image} />
              ) : null}
              <Text style={styles.merchant}>{r.merchant || t.common.noData}</Text>
              <Text style={styles.amount}>
                {r.total_amount != null ? formatMoney(Number(r.total_amount), locale) : t.common.noData}
              </Text>
              <Text style={styles.meta}>
                {r.date ? formatDate(r.date, locale) : t.common.noData} ·{" "}
                {r.verified ? t.receipts.verified : t.receipts.unverified}
              </Text>
              <Text style={styles.hint}>{t.receipts.edit} · {t.common.delete}</Text>
              <TextLink label={t.scanner.addToList} onPress={async () => {
                try {
                  const res: any = await api.importReceiptToShopping(r.id);
                  Alert.alert(t.common.confirm, t.scanner.itemsImported.replace("{count}", String(res.added)));
                } catch (e: any) {
                  Alert.alert(t.common.error, e.message);
                }
              }} style={styles.importLink} />
            </Surface>
          </TouchableOpacity>
        ))}
        {receipts.length === 0 && (
          <EmptyState message={t.receipts.empty} icon="🧾" />
        )}
      </SectionBlock>

      <Modal visible={!!editReceipt} transparent animationType="slide" onRequestClose={() => setEditReceipt(null)}>
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.receipts.edit}</Text>
            <InputField value={editMerchant} onChangeText={setEditMerchant} placeholder={t.receipts.merchant} />
            <InputField value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder={t.receipts.amount} />
            <View style={styles.modalActions}>
              <PrimaryButton label={t.common.cancel} onPress={() => setEditReceipt(null)} variant="ghost" compact />
              <PrimaryButton label={t.common.save} onPress={saveEdit} compact />
            </View>
          </Surface>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  filters: { padding: Spacing.md, marginBottom: Spacing.md },
  card: { padding: Spacing.md, marginBottom: Spacing.sm, overflow: "hidden" },
  image: { width: "100%", height: 160, borderRadius: Radius.sm, marginBottom: Spacing.sm },
  merchant: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  amount: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginTop: 4 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  importLink: { marginTop: Spacing.sm },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md, gap: Spacing.sm },
});
