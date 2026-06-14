import { useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { ErrorState } from "@/components/ErrorState";
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.transactions.title}</Text>
      {transactions.map((tx) => (
        <TouchableOpacity
          key={tx.id}
          style={styles.card}
          onPress={() => openEdit(tx)}
          onLongPress={() => confirmDelete(tx)}
        >
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
        </TouchableOpacity>
      ))}
      {transactions.length === 0 && <Text style={styles.empty}>{t.transactions.empty}</Text>}

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? <AuthImage path={previewUrl} style={styles.previewImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!editTx} transparent animationType="slide" onRequestClose={() => setEditTx(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.transactions.edit}</Text>
            <TextInput style={styles.input} value={editCategory} onChangeText={setEditCategory} placeholder="Category" placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} value={editDescription} onChangeText={setEditDescription} placeholder="Description" placeholderTextColor={Colors.textMuted} />
            <TextInput style={styles.input} value={editAmount} onChangeText={setEditAmount} keyboardType="decimal-pad" placeholder="Amount" placeholderTextColor={Colors.textMuted} />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setEditTx(null)}><Text style={styles.modalCancel}>{t.common.cancel}</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveEdit}><Text style={styles.modalSave}>{t.common.save}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  category: { color: Colors.text, fontWeight: "600" },
  amount: { color: Colors.danger, fontWeight: "700" },
  income: { color: Colors.success },
  desc: { color: Colors.textSecondary, marginTop: 4 },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  hint: { color: Colors.textMuted, fontSize: 11, marginTop: 6 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  receiptThumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: Colors.bg },
  receiptLabel: { color: Colors.accent, fontSize: 13 },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: Spacing.md },
  previewImage: { width: "100%", height: "80%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  input: { backgroundColor: Colors.bg, borderRadius: 10, padding: Spacing.md, color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  modalActions: { flexDirection: "row", justifyContent: "space-between", marginTop: Spacing.md },
  modalCancel: { color: Colors.textMuted },
  modalSave: { color: Colors.accent, fontWeight: "700" },
});
