import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AgendaCalendar } from "@/components/AgendaCalendar";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { PayBillModal } from "@/components/PayBillModal";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { ApiError, api } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";

type AddMode = "bill" | "installment" | null;
type ViewMode = "list" | "calendar";

export default function AgendaScreen() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [dueDays, setDueDays] = useState("7");
  const [installmentCount, setInstallmentCount] = useState("6");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingBill, setPendingBill] = useState<any>(null);
  const [payModal, setPayModal] = useState<{ title: string; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === "en" ? "en-US" : "tr-TR";

  const loadAgenda = async () => {
    try { setItems(await api.getAgenda()); } catch { setItems([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAgenda(); }, []);
  useRefreshOnFocus(loadAgenda);

  const resetForm = () => {
    setTitle(""); setAmount(""); setInstallmentCount("6"); setIsRecurring(false); setDueDays("7"); setAddMode(null);
  };

  const buildDueDate = () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (parseInt(dueDays) || 7));
    return dueDate;
  };

  const handleAddBill = async (force = false) => {
    if (!title || !amount) return;
    const dueDate = buildDueDate();
    try {
      await api.addBill(title, parseFloat(amount), dueDate.toISOString(), force, isRecurring);
      await scheduleAgendaReminder(title, parseFloat(amount), dueDate, locale);
      resetForm();
      loadAgenda();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicateMsg(e.message);
        setPendingBill({ title, amount, dueDate: dueDate.toISOString(), isRecurring });
      }
    }
  };

  const handleAddInstallment = async () => {
    if (!title || !amount || !installmentCount) return;
    await api.createInstallments(title, parseFloat(amount), parseInt(installmentCount) || 6);
    resetForm();
    loadAgenda();
  };

  const handleMarkPaid = async (walletId: string) => {
    if (!payModal) return;
    await api.markPaid(payModal.title, walletId);
    setPayModal(null);
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

      <View style={styles.viewToggle}>
        <TouchableOpacity style={[styles.viewBtn, viewMode === "calendar" && styles.viewBtnActive]}
          onPress={() => setViewMode("calendar")}>
          <Text style={styles.viewBtnText}>{t.agenda.calendar}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.viewBtn, viewMode === "list" && styles.viewBtnActive]}
          onPress={() => setViewMode("list")}>
          <Text style={styles.viewBtnText}>{t.agenda.list}</Text>
        </TouchableOpacity>
      </View>

      {viewMode === "calendar" && (
        <AgendaCalendar items={items} onSelectItem={(item) => {
          if (item.status === "pending") setPayModal({ title: item.title, amount: item.amount });
        }} />
      )}

      {addMode === "bill" && (
        <View style={styles.addForm}>
          <TextInput style={styles.input} placeholder={t.agenda.billName} placeholderTextColor={Colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder={t.agenda.amount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <Text style={styles.dueLabel}>{t.agenda.dueIn}</Text>
          <View style={styles.presetRow}>
            {([["7", t.agenda.duePresets.week], ["14", t.agenda.duePresets.twoWeeks], ["30", t.agenda.duePresets.month]] as const).map(([days, label]) => (
              <TouchableOpacity key={days} style={[styles.presetChip, dueDays === days && styles.presetActive]}
                onPress={() => setDueDays(days)}>
                <Text style={styles.presetText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder={t.agenda.dueIn} placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad" value={dueDays} onChangeText={setDueDays} />
          <View style={styles.recurringRow}>
            <Text style={styles.recurringLabel}>{t.agenda.recurring}</Text>
            <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: Colors.accent }} />
          </View>
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

      {viewMode === "list" && items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {item.title}{item.is_recurring ? " 🔄" : ""}
            </Text>
            {item.status === "pending" && (
              <TouchableOpacity onPress={() => setPayModal({ title: item.title, amount: item.amount })}>
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

      <PayBillModal
        visible={!!payModal}
        billTitle={payModal?.title || ""}
        amount={payModal?.amount || 0}
        onConfirm={handleMarkPaid}
        onCancel={() => setPayModal(null)}
      />

      <DuplicateBillDialog visible={!!duplicateMsg} message={duplicateMsg}
        onConfirm={async () => {
          setDuplicateMsg("");
          if (pendingBill) {
            await api.addBill(
              pendingBill.title, parseFloat(pendingBill.amount), pendingBill.dueDate, true, pendingBill.isRecurring,
            );
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  headerActions: { flexDirection: "row", gap: 12 },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", flex: 1 },
  addBtn: { color: Colors.accent, fontWeight: "600", fontSize: 13 },
  viewToggle: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  viewBtn: { flex: 1, padding: Spacing.sm, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  viewBtnActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  viewBtnText: { color: Colors.textSecondary, fontWeight: "600" },
  addForm: { marginBottom: Spacing.lg },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  recurringRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  recurringLabel: { color: Colors.textSecondary },
  dueLabel: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm, flexWrap: "wrap" },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  presetActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  presetText: { color: Colors.textSecondary, fontSize: 13 },
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
