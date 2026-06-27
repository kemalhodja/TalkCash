import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SettingSwitchRow } from "@/components/ui/SettingSwitchRow";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { AgendaCalendar } from "@/components/AgendaCalendar";
import { DueDatePicker } from "@/components/DueDatePicker";
import { DuplicateBillDialog } from "@/components/DuplicateBillDialog";
import { ErrorState } from "@/components/ErrorState";
import { PayBillModal } from "@/components/PayBillModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api, ApiError } from "@/services/api";
import { scheduleAgendaReminder } from "@/services/notifications";
import { getCachedSnapshot } from "@/services/syncCache";
import { formatDate, formatMoney } from "@/utils/format";

type AddMode = "bill" | "installment" | "task" | null;
type ViewMode = "list" | "calendar";
type ListTab = "upcoming" | "history";
type ItemFilter = "all" | "bill" | "task";

function isTaskItem(item: { item_type?: string }) {
  return item.item_type === "task";
}

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
  const [itemFilter, setItemFilter] = useState<ItemFilter>("all");
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [addMode, setAddMode] = useState<AddMode>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
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
    setTitle(""); setAmount(""); setNotes(""); setInstallmentCount("6");
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

  const handleAddTask = async () => {
    if (!title) return;
    await api.addTask(title, dueDate.toISOString(), notes.trim() || undefined);
    await scheduleAgendaReminder(title, 0, dueDate, locale);
    resetForm();
    loadAgenda();
  };

  const handleCompleteTask = async (item: any) => {
    await api.completeAgendaItem(item.id);
    loadAgenda();
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
    if (!editing || !title) return;
    if (isTaskItem(editing)) {
      await api.updateAgendaItem(editing.id, {
        title,
        due_date: dueDate.toISOString(),
        notes: notes.trim() || null,
      });
    } else {
      if (!amount) return;
      await api.updateAgendaItem(editing.id, {
        title,
        amount: parseFloat(amount),
        due_date: dueDate.toISOString(),
        is_recurring: isRecurring,
      });
    }
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
    setAmount(item.amount != null ? String(item.amount) : "");
    setNotes(item.notes || "");
    setDueDate(new Date(item.due_date));
    setIsRecurring(!!item.is_recurring);
    setAddMode(isTaskItem(item) ? "task" : "bill");
  };

  const filterByType = (list: any[]) => {
    if (itemFilter === "all") return list;
    return list.filter((item) => (itemFilter === "task") === isTaskItem(item));
  };

  const displayItems = filterByType(listTab === "upcoming" ? items : historyItems);

  const isPresetActive = (days: number) => {
    const expected = new Date();
    expected.setDate(expected.getDate() + days);
    return dueDate.toDateString() === expected.toDateString();
  };

  if (loading) {
    return (
      <ScreenShell ambient="subtle">
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
  }
  if (error && items.length === 0) return <ErrorState message={error} onRetry={loadAgenda} />;

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader
        title={t.agenda.title}
        actions={
          <>
            <TextLink
              label={addMode === "task" ? t.agenda.cancel : t.agenda.addTask}
              onPress={() => setAddMode(addMode === "task" ? null : "task")}
            />
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
          { key: "upcoming", label: t.agenda.upcoming },
          { key: "history", label: t.agenda.history },
        ]}
        value={listTab}
        onChange={(k) => setListTab(k as ListTab)}
      />

      <SegmentedControl
        options={[
          { key: "all", label: t.agenda.filterAll },
          { key: "bill", label: t.agenda.filterBills },
          { key: "task", label: t.agenda.filterTasks },
        ]}
        value={itemFilter}
        onChange={(k) => setItemFilter(k as ItemFilter)}
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
          <AgendaCalendar items={filterByType(items)} onSelectItem={(item) => {
            if (!isPayableStatus(item.status)) return;
            if (isTaskItem(item)) handleCompleteTask(item);
            else setPayModal({ title: item.title, amount: item.amount ?? 0 });
          }} />
        </Surface>
      )}

      {addMode === "task" && (
        <Surface variant="glass" style={styles.addForm}>
          <Text style={styles.formTitle}>{editing ? t.agenda.editTask : t.agenda.addTask}</Text>
          <InputField placeholder={t.agenda.taskName} value={title} onChangeText={setTitle} />
          <InputField placeholder={t.agenda.taskNotes} value={notes} onChangeText={setNotes} multiline />
          <ChipPicker
            label={t.agenda.due}
            options={[
              { id: "0", label: t.agenda.duePresets.today },
              { id: "1", label: t.agenda.duePresets.tomorrow },
              { id: "7", label: t.agenda.duePresets.week },
            ]}
            value={
              ([0, 1, 7].find((days) => isPresetActive(days))?.toString()) ?? null
            }
            onChange={(id) => applyPresetDays(parseInt(id, 10))}
          />
          <DueDatePicker value={dueDate} onChange={setDueDate} />
          <PrimaryButton
            label={editing ? t.common.save : t.agenda.add}
            onPress={() => editing ? handleSaveEdit() : handleAddTask()}
          />
          {editing ? (
            <TextLink label={t.common.cancel} onPress={() => { setEditing(null); resetForm(); }} style={styles.cancelEdit} />
          ) : null}
        </Surface>
      )}

      {addMode === "bill" && (
        <Surface variant="glass" style={styles.addForm}>
          <Text style={styles.formTitle}>{editing ? t.agenda.editBill : t.agenda.addBill}</Text>
          <InputField placeholder={t.agenda.billName} value={title} onChangeText={setTitle} />
          <InputField placeholder={t.agenda.amount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />

          <ChipPicker
            label={t.agenda.due}
            options={[
              { id: "7", label: t.agenda.duePresets.week },
              { id: "14", label: t.agenda.duePresets.twoWeeks },
              { id: "30", label: t.agenda.duePresets.month },
            ]}
            value={
              ([7, 14, 30].find((days) => isPresetActive(days))?.toString()) ?? null
            }
            onChange={(id) => applyPresetDays(parseInt(id, 10))}
          />

          <DueDatePicker value={dueDate} onChange={setDueDate} />

          <SettingSwitchRow label={t.agenda.recurring} value={isRecurring} onValueChange={setIsRecurring} />
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
                {isTaskItem(item) ? "☑ " : ""}{item.title}{item.is_recurring ? " 🔄" : ""}
                {item.status === "overdue" ? ` · ${t.agenda.overdue}` : ""}
                {item.status === "paid"
                  ? ` · ${isTaskItem(item) ? t.agenda.doneStatus : t.agenda.paidStatus}`
                  : ""}
              </Text>
              {listTab === "upcoming" && isPayableStatus(item.status) && (
                <View style={styles.cardActions}>
                  {isTaskItem(item) ? (
                    <TextLink label={t.agenda.done} onPress={() => handleCompleteTask(item)} />
                  ) : (
                    <TextLink label={t.agenda.paid} onPress={() => setPayModal({ title: item.title, amount: item.amount ?? 0 })} />
                  )}
                  <TextLink label="✕" onPress={() => handleDeleteItem(item)} danger />
                </View>
              )}
            </View>
            {!isTaskItem(item) && item.amount != null ? (
              <Text style={styles.amount}>{formatMoney(item.amount ?? 0, locale)}</Text>
            ) : null}
            {isTaskItem(item) && item.notes ? (
              <Text style={styles.notes}>{item.notes}</Text>
            ) : null}
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
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  cardOverdue: { borderColor: Colors.danger },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardActions: { flexDirection: "row", gap: 12, alignItems: "center" },
  cardTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", flex: 1 },
  formTitle: { color: Colors.textSecondary, marginBottom: Spacing.sm, fontWeight: "600" },
  cancelEdit: { textAlign: "center", marginTop: Spacing.sm },
  amount: { color: Colors.accent, fontSize: 20, fontWeight: "700", marginTop: 8 },
  notes: { color: Colors.textSecondary, fontSize: 14, marginTop: 6, lineHeight: 20 },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
});
