import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { AgendaCalendar } from "@/components/AgendaCalendar";
import { DueDatePicker } from "@/components/DueDatePicker";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { ErrorState } from "@/components/ErrorState";
import { PayBillModal } from "@/components/PayBillModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";
import { getCachedSnapshot } from "@/services/syncCache";
import { formatDate, formatMoney } from "@/utils/format";

type AddMode = "bill" | "installment" | null;
type ViewMode = "list" | "calendar";
type ListTab = "upcoming" | "history";

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
  const [listTab, setListTab] = useState<ListTab>("upcoming");
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
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

  const loadAgenda = useCallback(async () => {
    setError("");
    let cachedCount = 0;
    try {
      const snapshot = await getCachedSnapshot();
      if (snapshot?.agenda?.length) {
        cachedCount = snapshot.agenda.length;
        setItems(snapshot.agenda);
      }
      setItems(await api.getAgenda());
      setHistoryItems(await api.getAgendaHistory());
    } catch (e: any) {
      if (!cachedCount) setItems([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  }, [t.common.error]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);
  useRefreshOnFocus(loadAgenda);
  const { refreshing, onRefresh } = usePullRefresh(loadAgenda);

  const resetForm = () => {
    setTitle(""); setAmount(""); setInstallmentCount("6");
    setIsRecurring(false); setDueDate(defaultDueDate()); setAddMode(null); setEditing(null);
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

  const handleSaveEdit = async () => {
    if (!editing || !title || !amount) return;
    await api.updateAgendaItem(editing.id, {
      title,
      amount: parseFloat(amount),
      due_date: dueDate.toISOString(),
      is_recurring: isRecurring,
    });
    setEditing(null);
    resetForm();
    loadAgenda();
  };

  const handleDeleteItem = (item: any) => {
    Alert.alert(t.agenda.deleteBill, item.title, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          await api.deleteAgendaItem(item.id);
          loadAgenda();
        },
      },
    ]);
  };

  const startEdit = (item: any) => {
    setEditing(item);
    setTitle(item.title);
    setAmount(String(item.amount));
    setDueDate(new Date(item.due_date));
    setIsRecurring(!!item.is_recurring);
    setAddMode("bill");
  };

  const displayItems = listTab === "upcoming" ? items : historyItems;

  const isPresetActive = (days: number) => {
    const expected = new Date();
    expected.setDate(expected.getDate() + days);
    return dueDate.toDateString() === expected.toDateString();
  };

  if (loading) return <LoadingScreen />;
  if (error && items.length === 0) return <ErrorState message={error} onRetry={loadAgenda} />;

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        title={t.agenda.title}
        actions={
          <>
            <TextLink
              label={addMode === "installment" ? t.agenda.cancel : t.agenda.addInstallment}
              onPress={() => setAddMode(addMode === "installment" ? null : "installment")}
            />
            <TextLink
              label={addMode === "bill" ? t.agenda.cancel : t.agenda.addBill}
              onPress={() => setAddMode(addMode === "bill" ? null : "bill")}
            />
          </>
        }
      />

      <SegmentedControl
        options={[
          { key: "upcoming", label: t.agenda.list },
          { key: "history", label: t.agenda.history },
        ]}
        value={listTab}
        onChange={(k) => setListTab(k as ListTab)}
      />

      <SegmentedControl
        options={[
          { key: "calendar", label: t.agenda.calendar },
          { key: "list", label: t.agenda.list },
        ]}
        value={viewMode}
        onChange={(k) => setViewMode(k as ViewMode)}
      />

      {viewMode === "calendar" && (
        <Surface variant="elevated" style={styles.calendarWrap}>
          <AgendaCalendar items={items} onSelectItem={(item) => {
            if (isPayableStatus(item.status)) setPayModal({ title: item.title, amount: item.amount });
          }} />
        </Surface>
      )}

      {addMode === "bill" && (
        <Surface variant="glass" style={styles.addForm}>
          <Text style={styles.formTitle}>{editing ? t.agenda.editBill : t.agenda.addBill}</Text>
          <InputField placeholder={t.agenda.billName} value={title} onChangeText={setTitle} />
          <InputField placeholder={t.agenda.amount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <View style={styles.presetRow}>
            {([
              [7, t.agenda.duePresets.week],
              [14, t.agenda.duePresets.twoWeeks],
              [30, t.agenda.duePresets.month],
            ] as const).map(([days, label]) => (
              <TouchableOpacity key={days} style={[styles.presetChip, isPresetActive(days) && styles.presetActive]}
                onPress={() => applyPresetDays(days)}>
                <Text style={[styles.presetText, isPresetActive(days) && styles.presetTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <DueDatePicker value={dueDate} onChange={setDueDate} />

          <View style={styles.recurringRow}>
            <Text style={styles.recurringLabel}>{t.agenda.recurring}</Text>
            <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: Colors.accent }} />
          </View>
          <PrimaryButton
            label={editing ? t.common.save : t.agenda.add}
            onPress={() => editing ? handleSaveEdit() : handleAddBill(false)}
          />
          {editing ? (
            <TextLink label={t.common.cancel} onPress={() => { setEditing(null); resetForm(); }} style={styles.cancelEdit} />
          ) : null}
        </Surface>
      )}

      {addMode === "installment" && (
        <Surface variant="glass" style={styles.addForm}>
          <InputField placeholder={t.agenda.billName} value={title} onChangeText={setTitle} />
          <InputField placeholder={t.agenda.totalAmount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <InputField placeholder={t.agenda.installmentCount} keyboardType="number-pad" value={installmentCount} onChangeText={setInstallmentCount} />
          <PrimaryButton label={t.agenda.add} onPress={handleAddInstallment} />
        </Surface>
      )}

      {viewMode === "list" && displayItems.length === 0 && (
        <EmptyState
          message={listTab === "upcoming" ? t.agenda.emptyUpcoming : t.agenda.emptyHistory}
          icon="📅"
        />
      )}

      {viewMode === "list" && displayItems.map((item) => (
        <TouchableOpacity key={item.id} activeOpacity={0.85}
          onLongPress={() => listTab === "upcoming" && isPayableStatus(item.status) && startEdit(item)}>
          <Surface
            variant={item.status === "overdue" ? "accent" : "elevated"}
            style={[styles.card, item.status === "overdue" && styles.cardOverdue]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {item.title}{item.is_recurring ? " 🔄" : ""}
                {item.status === "overdue" ? ` · ${t.agenda.overdue}` : ""}
                {item.status === "paid" ? ` · ${t.agenda.paidStatus}` : ""}
              </Text>
              {listTab === "upcoming" && isPayableStatus(item.status) && (
                <View style={styles.cardActions}>
                  <TextLink label={t.agenda.paid} onPress={() => setPayModal({ title: item.title, amount: item.amount })} />
                  <TextLink label="✕" onPress={() => handleDeleteItem(item)} danger />
                </View>
              )}
            </View>
            <Text style={styles.amount}>{formatMoney(item.amount ?? 0, locale)}</Text>
            <Text style={styles.date}>
              {t.agenda.due}: {formatDate(item.due_date, locale)}
              {item.paid_at ? ` · ${formatDate(item.paid_at, locale)}` : ""}
              {item.installment && ` · ${t.agenda.installment} ${item.installment}`}
            </Text>
          </Surface>
        </TouchableOpacity>
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
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  calendarWrap: { padding: Spacing.sm, marginBottom: Spacing.md },
  addForm: { padding: Spacing.md, marginBottom: Spacing.lg },
  recurringRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  recurringLabel: { color: Colors.textSecondary },
  presetRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm, flexWrap: "wrap" },
  presetChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border },
  presetActive: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  presetText: { color: Colors.textSecondary, fontSize: 13 },
  presetTextActive: { color: Colors.accent },
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  cardOverdue: { borderColor: Colors.danger },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  formTitle: { color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: "600" },
  cancelEdit: { textAlign: "center", marginTop: Spacing.sm },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
