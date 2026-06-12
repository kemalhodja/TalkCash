import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AgendaCalendar } from "@/components/AgendaCalendar";
import { DueDatePicker } from "@/components/DueDatePicker";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { ErrorState } from "@/components/ErrorState";
import { PayBillModal } from "@/components/PayBillModal";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";
import { formatDate, formatMoney } from "@/utils/format";

type AddMode = "bill" | "installment" | null;
type ViewMode = "list" | "calendar";

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(12, 0, 0, 0);
  return d;
}

function isPayableStatus(status: string) {
  return status === "pending" || status === "overdue";
}

export default function AgendaScreen() {
  const { t, locale } = useI18n();
  const [items, setItems] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [installmentCount, setInstallmentCount] = useState("6");
  const [duplicateMsg, setDuplicateMsg] = useState("");
  const [pendingBill, setPendingBill] = useState<any>(null);
  const [payModal, setPayModal] = useState<{ title: string; amount: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAgenda = async () => {
    setError("");
    try {
      setItems(await api.getAgenda());
    } catch (e: any) {
      setItems([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAgenda(); }, []);
  useRefreshOnFocus(loadAgenda);

  const resetForm = () => {
    setTitle(""); setAmount(""); setInstallmentCount("6");
    setIsRecurring(false); setDueDate(defaultDueDate()); setAddMode(null);
  };

  const applyPresetDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(12, 0, 0, 0);
    setDueDate(d);
  };

  const handleAddBill = async (force = false) => {
    if (!title || !amount) return;
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

  const isPresetActive = (days: number) => {
    const expected = new Date();
    expected.setDate(expected.getDate() + days);
    return dueDate.toDateString() === expected.toDateString();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={loadAgenda} />;

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
          if (isPayableStatus(item.status)) setPayModal({ title: item.title, amount: item.amount });
        }} />
      )}

      {addMode === "bill" && (
        <View style={styles.addForm}>
          <TextInput style={styles.input} placeholder={t.agenda.billName} placeholderTextColor={Colors.textMuted}
            value={title} onChangeText={setTitle} />
          <TextInput style={styles.input} placeholder={t.agenda.amount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <View style={styles.presetRow}>
            {([
              [7, t.agenda.duePresets.week],
              [14, t.agenda.duePresets.twoWeeks],
              [30, t.agenda.duePresets.month],
            ] as const).map(([days, label]) => (
              <TouchableOpacity key={days} style={[styles.presetChip, isPresetActive(days) && styles.presetActive]}
                onPress={() => applyPresetDays(days)}>
                <Text style={styles.presetText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <DueDatePicker value={dueDate} onChange={setDueDate} />

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
        <View key={item.id} style={[styles.card, item.status === "overdue" && styles.cardOverdue]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>
              {item.title}{item.is_recurring ? " 🔄" : ""}
              {item.status === "overdue" ? ` · ${t.agenda.overdue}` : ""}
            </Text>
            {isPayableStatus(item.status) && (
              <TouchableOpacity onPress={() => setPayModal({ title: item.title, amount: item.amount })}>
                <Text style={styles.payBtn}>{t.agenda.paid}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.amount}>{formatMoney(item.amount ?? 0, locale)}</Text>
          <Text style={styles.date}>
            {t.agenda.due}: {formatDate(item.due_date, locale)}
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
  cardOverdue: { borderColor: Colors.danger, backgroundColor: "rgba(239,68,68,0.06)" },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  payBtn: { color: Colors.success, fontWeight: "600" },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
