import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";

const DEMO_USER = "00000000-0000-0000-0000-000000000001";

export default function AgendaScreen() {
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => { loadAgenda(); }, []);

  const loadAgenda = async () => {
    try {
      const data = await api.getAgenda(DEMO_USER);
      setItems(data);
    } catch {
      setItems([
        { id: "1", title: "Kira", amount: 15000, due_date: "2025-07-01", status: "pending" },
        { id: "2", title: "Elektrik Faturası", amount: 450, due_date: "2025-06-15", status: "pending" },
        { id: "3", title: "Buzdolabı (2/6)", amount: 2000, due_date: "2025-06-20", status: "pending", installment: "2/6" },
      ]);
    }
  };

  const statusColor = (status: string) => {
    if (status === "paid") return Colors.success;
    if (status === "overdue") return Colors.danger;
    return Colors.warning;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ajanda & Faturalar</Text>
      <Text style={styles.subtitle}>Yaklaşan ödemeler ve taksitler</Text>

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <View style={[styles.badge, { backgroundColor: statusColor(item.status) + "22" }]}>
              <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
                {item.status === "pending" ? "Bekliyor" : item.status === "paid" ? "Ödendi" : "Gecikmiş"}
              </Text>
            </View>
          </View>
          <Text style={styles.amount}>{item.amount?.toLocaleString("tr-TR")} ₺</Text>
          <Text style={styles.date}>
            Son ödeme: {new Date(item.due_date).toLocaleDateString("tr-TR")}
            {item.installment && ` · Taksit ${item.installment}`}
          </Text>
        </View>
      ))}

      {items.length === 0 && (
        <Text style={styles.empty}>Yaklaşan ödeme yok.</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.lg },
  card: {
    backgroundColor: Colors.card, borderRadius: 12,
    padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
});
