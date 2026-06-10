import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { Colors, Spacing } from "@/constants/theme";
import { ApiError, api } from "@/services/api";
import { auth } from "@/services/auth";
import { scheduleAgendaReminder } from "@/services/notifications";

export default function AgendaScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingBill, setPendingBill] = useState<any>(null);

  useEffect(() => { loadAgenda(); }, []);

  const loadAgenda = async () => {
    const user = await auth.getUser();
    if (!user) return;
    try {
      setItems(await api.getAgenda(user.userId));
    } catch {
      setItems([
        { id: "1", title: "Kira", amount: 15000, due_date: "2025-07-01", status: "pending" },
        { id: "2", title: "Elektrik Faturası", amount: 450, due_date: "2025-06-15", status: "pending" },
      ]);
    }
  };

  const handleAddBill = async (force = false) => {
    const user = await auth.getUser();
    if (!user || !title || !amount) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    try {
      await api.addBill(user.userId, title, parseFloat(amount), dueDate.toISOString(), force);
      await scheduleAgendaReminder(title, parseFloat(amount), dueDate);
      setTitle(""); setAmount(""); setShowAdd(false);
      loadAgenda();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicateMsg(e.message);
        setPendingBill({ title, amount, dueDate: dueDate.toISOString() });
      }
    }
  };

  const statusColor = (status: string) => {
    if (status === "paid") return Colors.success;
    if (status === "overdue") return Colors.danger;
    return Colors.warning;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajanda & Faturalar</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <Text style={styles.addBtn}>{showAdd ? "İptal" : "+ Fatura Ekle"}</Text>
        </TouchableOpacity>
      </View>

      {showAdd && (
        <View style={styles.addForm}>
          <TextInput style={styles.input} placeholder="Fatura adı" placeholderTextColor={Colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder="Tutar (TL)" placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TouchableOpacity style={styles.submitBtn} onPress={() => handleAddBill(false)}>
            <Text style={styles.submitText}>Ekle</Text>
          </TouchableOpacity>
        </View>
      )}

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

      <DuplicateBillDialog
        visible={!!duplicateMsg}
        message={duplicateMsg}
        onConfirm={async () => {
          setDuplicateMsg("");
          const user = await auth.getUser();
          if (user && pendingBill) {
            await api.addBill(user.userId, pendingBill.title, parseFloat(pendingBill.amount), pendingBill.dueDate, true);
            setPendingBill(null);
            loadAgenda();
          }
        }}
        onCancel={() => { setDuplicateMsg(""); setPendingBill(null); }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700" },
  addBtn: { color: Colors.accent, fontWeight: "600" },
  addForm: { marginBottom: Spacing.lg },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  submitBtn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  submitText: { color: Colors.bg, fontWeight: "700" },
  card: {
    backgroundColor: Colors.card, borderRadius: 12, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
