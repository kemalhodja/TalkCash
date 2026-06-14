import { useEffect, useState } from "react";
import {
  Alert, Modal, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";
import { formatDate, formatMoney } from "@/utils/format";

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

  const load = async () => {
    setError("");
    try {
      const snapshot = await getCachedSnapshot();
      if (snapshot?.transactions?.length) setTransactions(snapshot.transactions);
      setTransactions(await api.getTransactions());
    } catch (e: any) {
      if (!transactions.length) setTransactions([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  const openEdit = (tx: any) => {
    if (tx.type === "transfer") return;
    setEditTx(tx);
    setEditCategory(tx.category || "");
    setEditDescription(tx.description || "");
    setEditAmount(String(tx.amount || ""));
  };

  const saveEdit = async () => {
    if (!editTx) return;
    try {
      await api.updateTransaction(editTx.id, {
        category: editCategory,
        description: editDescription,
        amount: parseFloat(editAmount),
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

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <ScreenShell ambient="subtle">
        <ScreenHeader title={t.transactions.title} />
        {transactions.map((tx) => (
          <TouchableOpacity
            key={tx.id}
            onPress={() => openEdit(tx)}
            onLongPress={() => confirmDelete(tx)}
            activeOpacity={0.85}
          >
            <Surface variant="elevated" style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.category}>{tx.category}</Text>
                <Text style={[styles.amount, tx.type === "income" && styles.income]}>
                  {tx.type === "income" ? "+" : "-"}{formatMoney(tx.amount, locale)}
                </Text>
              </View>
              <Text style={styles.desc}>{tx.description || tx.place || "—"}</Text>
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
        {transactions.length === 0 && <EmptyState message={t.transactions.empty} icon="↕" />}
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
            <InputField value={editCategory} onChangeText={setEditCategory} placeholder="Category" />
            <InputField value={editDescription} onChangeText={setEditDescription} placeholder="Description" />
            <InputField value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder="Amount" />
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
  row: { flexDirection: "row", justifyContent: "space-between" },
  category: { color: Colors.text, fontWeight: "600" },
  amount: { color: Colors.danger, fontWeight: "700" },
  income: { color: Colors.success },
  desc: { color: Colors.textSecondary, marginTop: 4 },
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
