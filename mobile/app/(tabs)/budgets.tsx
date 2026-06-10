import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

export default function BudgetsScreen() {
  const { t, locale } = useI18n();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editLimit, setEditLimit] = useState("");
  const [loading, setLoading] = useState(true);

  const dateLocale = locale === "en" ? "en-US" : "tr-TR";

  const load = async () => {
    try {
      setBudgets(await api.getBudgets());
    } catch {
      setBudgets([]);
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

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.budget.title}</Text>

      <View style={styles.form}>
        <TextInput style={styles.input} placeholder={t.budget.category} placeholderTextColor={Colors.textMuted}
          value={category} onChangeText={setCategory} />
        <TextInput style={styles.input} placeholder={t.budget.limit} placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad" value={limit} onChangeText={setLimit} />
        <TouchableOpacity style={styles.btn} onPress={handleAdd}>
          <Text style={styles.btnText}>{t.budget.add}</Text>
        </TouchableOpacity>
      </View>

      {budgets.map((b) => {
        const percent = b.percent ?? 0;
        const spent = b.spent ?? 0;
        return (
          <TouchableOpacity key={b.id} style={styles.card}
            onLongPress={() => { setEditing(b); setEditLimit(String(b.monthly_limit)); }}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.catName}>{b.category}</Text>
                <Text style={styles.limit}>
                  {Number(spent).toLocaleString(dateLocale)} / {Number(b.monthly_limit).toLocaleString(dateLocale)} {t.budget.perMonth}
                </Text>
                <Text style={styles.percentText}>{percent}% {t.budget.used}</Text>
              </View>
              <TouchableOpacity onPress={async () => { await api.deleteBudget(b.id); load(); }}>
                <Text style={styles.delete}>{t.common.delete}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.progressBg}>
              <View style={[styles.progressFill, { width: `${Math.min(percent, 100)}%`, backgroundColor: barColor(percent) }]} />
            </View>
          </TouchableOpacity>
        );
      })}

      {budgets.length === 0 && <Text style={styles.empty}>{t.budget.empty}</Text>}

      <Modal visible={!!editing} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.budget.edit}: {editing?.category}</Text>
            <TextInput style={styles.input} placeholder={t.budget.newLimit} placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad" value={editLimit} onChangeText={setEditLimit} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditing(null)}>
                <Text style={styles.cancelText}>{t.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={handleUpdate}>
                <Text style={styles.btnText}>{t.common.save}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  form: { marginBottom: Spacing.lg },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  btnText: { color: Colors.bg, fontWeight: "700" },
  card: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  catName: { color: Colors.text, fontWeight: "600" },
  limit: { color: Colors.textSecondary, marginTop: 4, fontSize: 13 },
  percentText: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  progressBg: { height: 6, backgroundColor: Colors.border, borderRadius: 3, marginTop: Spacing.sm, overflow: "hidden" },
  progressFill: { height: 6, borderRadius: 3 },
  delete: { color: Colors.danger },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontWeight: "700", marginBottom: Spacing.md },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelText: { color: Colors.textSecondary },
});
