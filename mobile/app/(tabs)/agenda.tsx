import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { Colors, Spacing } from "@/constants/theme";
import { ApiError, api } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";

export default function AgendaScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingBill, setPendingBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadAgenda = async () => {
    try { setItems(await api.getAgenda()); } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAgenda(); }, []);

  const handleAddBill = async (force = false) => {
    if (!title || !amount) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    try {
      await api.addBill(title, parseFloat(amount), dueDate.toISOString(), force);
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Ajanda & Faturalar</Text>
        <TouchableOpacity onPress={() => setShowAdd(!showAdd)}>
          <Text style={styles.addBtn}>{showAdd ? "İptal" : "+ Fatura"}</Text>
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
            {item.status === "pending" && (
              <TouchableOpacity onPress={async () => { await api.markPaid(item.title); loadAgenda(); }}>
                <Text style={styles.payBtn}>Ödedim</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.amount}>{item.amount?.toLocaleString("tr-TR")} ₺</Text>
          <Text style={styles.date}>
            Son: {new Date(item.due_date).toLocaleDateString("tr-TR")}
            {item.installment && ` · Taksit ${item.installment}`}
          </Text>
        </View>
      ))}

      <DuplicateBillDialog visible={!!duplicateMsg} message={duplicateMsg}
        onConfirm={async () => {
          setDuplicateMsg("");
          if (pendingBill) {
            await api.addBill(pendingBill.title, parseFloat(pendingBill.amount), pendingBill.dueDate, true);
            setPendingBill(null); loadAgenda();
          }
        }}
        onCancel={() => { setDuplicateMsg(""); setPendingBill(null); }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
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
  payBtn: { color: Colors.success, fontWeight: "600" },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
