import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { formatMoney } from "@/utils/format";

export default function BudgetsScreen() {
  const { t, locale } = useI18n();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editLimit, setEditLimit] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      setBudgets(await api.getBudgets());
    } catch (e: any) {
      setBudgets([]);
      setError(e.message || t.common.error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  const handleAdd = async () => {
    if (!category || !limit) return;
    await api.createBudget(category, parseFloat(limit));
    setCategory(""); setLimit("");
    load();
  };

  const handleUpdate = async () => {
    if (!editing || !editLimit) return;
    await api.updateBudget(editing.id, parseFloat(editLimit));
    setEditing(null); setEditLimit("");
    load();
  };

  const barColor = (percent: number) => {
    if (percent >= 100) return Colors.danger;
    if (percent >= 80) return Colors.warning;
    return Colors.accent;
  };

  if (loading) return <LoadingScreen />;
  if (error && budgets.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <ScreenShell>
        <ScreenHeader title={t.budget.title} />

        <Surface variant="glass" style={styles.form}>
          <InputField placeholder={t.budget.category} value={category} onChangeText={setCategory} />
          <InputField placeholder={t.budget.limit} keyboardType="decimal-pad" value={limit} onChangeText={setLimit} />
          <PrimaryButton label={t.budget.add} onPress={handleAdd} />
        </Surface>

        {budgets.map((b) => {
          const percent = b.percent ?? 0;
          const spent = b.spent ?? 0;
          return (
            <TouchableOpacity key={b.id} activeOpacity={0.85}
              onLongPress={() => { setEditing(b); setEditLimit(String(b.monthly_limit)); }}>
              <Surface variant="elevated" style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.catName}>{b.category}</Text>
                    <Text style={styles.limit}>
                      {formatMoney(Number(spent), locale)} / {formatMoney(Number(b.monthly_limit), locale)} {t.budget.perMonth}
                    </Text>
                    <Text style={styles.percentText}>{percent}% {t.budget.used}</Text>
                  </View>
                  <TextLink label={t.common.delete} onPress={async () => { await api.deleteBudget(b.id); load(); }} danger />
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor(percent) }]} />
                </View>
              </Surface>
            </TouchableOpacity>
          );
        })}

        {budgets.length === 0 && <EmptyState message={t.budget.empty} icon="◎" />}
      </ScreenShell>

      <Modal visible={!!editing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Surface variant="glass" style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.budget.edit}: {editing?.category}</Text>
            <InputField placeholder={t.budget.newLimit} keyboardType="decimal-pad" value={editLimit} onChangeText={setEditLimit} />
            <View style={styles.modalActions}>
              <PrimaryButton label={t.common.cancel} onPress={() => setEditing(null)} variant="ghost" style={styles.modalBtn} />
              <PrimaryButton label={t.common.save} onPress={handleUpdate} style={styles.modalBtn} />
            </View>
          </Surface>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  form: { padding: Spacing.md, marginBottom: Spacing.lg },
  card: { padding: Spacing.md, marginBottom: Spacing.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  catName: { color: Colors.text, fontWeight: "600" },
  limit: { color: Colors.textSecondary, marginTop: 4, fontSize: 13 },
  percentText: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: Radius.pill, marginTop: Spacing.sm, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: Radius.pill },
  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  modalCard: { padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontWeight: "700", marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  modalBtn: { flex: 1 },
});
