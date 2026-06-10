import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

export default function TransactionsScreen() {
  const { t } = useI18n();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const load = async () => {
    try {
      setTransactions(await api.getTransactions());
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.transactions.title}</Text>
      {transactions.map((tx) => (
        <View key={tx.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.category}>{tx.category}</Text>
            <Text style={[styles.amount, tx.type === "income" && styles.income]}>
              {tx.type === "income" ? "+" : "-"}{tx.amount.toLocaleString("tr-TR")} ₺
            </Text>
          </View>
          <Text style={styles.desc}>{tx.description || tx.place || "—"}</Text>
          {tx.receipt_url ? (
            <TouchableOpacity onPress={() => setPreviewUrl(tx.receipt_url)} style={styles.receiptRow}>
              <Image source={{ uri: tx.receipt_url }} style={styles.receiptThumb} />
              <Text style={styles.receiptLabel}>{t.transactions.viewReceipt}</Text>
            </TouchableOpacity>
          ) : null}
          <Text style={styles.date}>{new Date(tx.date).toLocaleDateString("tr-TR")} · {tx.input_method}</Text>
        </View>
      ))}
      {transactions.length === 0 && <Text style={styles.empty}>{t.transactions.empty}</Text>}

      <Modal visible={!!previewUrl} transparent animationType="fade" onRequestClose={() => setPreviewUrl(null)}>
        <TouchableOpacity style={styles.previewOverlay} activeOpacity={1} onPress={() => setPreviewUrl(null)}>
          {previewUrl ? <Image source={{ uri: previewUrl }} style={styles.previewImage} resizeMode="contain" /> : null}
        </TouchableOpacity>
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
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
  receiptRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  receiptThumb: { width: 48, height: 48, borderRadius: 6, backgroundColor: Colors.bg },
  receiptLabel: { color: Colors.accent, fontSize: 13 },
  previewOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", padding: Spacing.md },
  previewImage: { width: "100%", height: "80%" },
});
