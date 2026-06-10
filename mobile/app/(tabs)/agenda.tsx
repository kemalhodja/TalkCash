import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { ApiError, api } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";

type AddMode = "bill" | "installment" | null;

export default function AgendaScreen() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [installmentCount, setInstallmentCount] = useState("6");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingBill, setPendingBill] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === "en" ? "en-US" : "tr-TR";

  const loadAgenda = async () => {
    try { setItems(await api.getAgenda()); } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAgenda(); }, []);
  useRefreshOnFocus(loadAgenda);

  const resetForm = () => {
    setTitle(""); setAmount(""); setInstallmentCount("6"); setAddMode(null);
  };

  const handleAddBill = async (force = false) => {
    if (!title || !amount) return;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    try {
      await api.addBill(title, parseFloat(amount), dueDate.toISOString(), force);
      await scheduleAgendaReminder(title, parseFloat(amount), dueDate, locale);
      resetForm();
      loadAgenda();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicateMsg(e.message);
        setPendingBill({ title, amount, dueDate: dueDate.toISOString() });
      }
    }
  };

  const handleAddInstallment = async () => {
    if (!title || !amount || !installmentCount) return;
    await api.createInstallments(title, parseFloat(amount), parseInt(installmentCount) || 6);
    resetForm();
    loadAgenda();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.agenda.title}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setAddMode(addMode === "installment" ? null : "installment")}>
            <Text style={styles.addBtn}>{addMode === "installment" ? t.agenda.cancel : t.agenda.addInstallment}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddMode(addMode === "bill" ? null : "bill")}>
            <Text style={styles.addBtn}>{addMode === "bill" ? t.agenda.cancel : t.agenda.addBill}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {addMode === "bill" && (
        <View style={styles.addForm}>
          <TextInput style={styles.input} placeholder={t.agenda.billName} placeholderTextColor={Colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder={t.agenda.amount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TouchableOpacity style={styles.submitBtn} onPress={() => handleAddBill(false)}>
            <Text style={styles.submitText}>{t.agenda.add}</Text>
          </TouchableOpacity>
        </View>
      )}

      {addMode === "installment" && (
        <View style={styles.addForm}>
          <TextInput style={styles.input} placeholder={t.agenda.billName} placeholderTextColor={Colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder={t.agenda.totalAmount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder={t.agenda.installmentCount} placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad" value={installmentCount} onChangeText={setInstallmentCount} />
          <TouchableOpacity style={styles.submitBtn} onPress={handleAddInstallment}>
            <Text style={styles.submitText}>{t.agenda.add}</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.status === "pending" && (
              <TouchableOpacity onPress={async () => { await api.markPaid(item.title); loadAgenda(); }}>
                <Text style={styles.payBtn}>{t.agenda.paid}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.amount}>{item.amount?.toLocaleString(dateLocale)} ₺</Text>
          <Text style={styles.date}>
            {t.agenda.due}: {new Date(item.due_date).toLocaleDateString(dateLocale)}
            {item.installment && ` · ${t.agenda.installment} ${item.installment}`}
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
  headerActions: { flexDirection: "row", gap: 12 },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", flex: 1 },
  addBtn: { color: Colors.accent, fontWeight: "600", fontSize: 13 },
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
