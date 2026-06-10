import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getTransactions().then(setTransactions).catch(() => setTransactions([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>İşlem Geçmişi</Text>
      {transactions.map((t) => (
        <View key={t.id} style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.category}>{t.category}</Text>
            <Text style={[styles.amount, t.type === "income" && styles.income]}>
              {t.type === "income" ? "+" : "-"}{t.amount.toLocaleString("tr-TR")} ₺
            </Text>
          </View>
          <Text style={styles.desc}>{t.description || t.place || "—"}</Text>
          <Text style={styles.date}>{new Date(t.date).toLocaleDateString("tr-TR")} · {t.input_method}</Text>
        </View>
      ))}
      {transactions.length === 0 && <Text style={styles.empty}>Henüz işlem yok</Text>}
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
});
