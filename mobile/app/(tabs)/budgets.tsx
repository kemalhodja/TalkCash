import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

export default function BudgetsScreen() {
  const { t } = useI18n();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [loading, setLoading] = useState(true);

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

      {budgets.map((b) => (
        <View key={b.id} style={styles.card}>
          <View>
            <Text style={styles.catName}>{b.category}</Text>
            <Text style={styles.limit}>{Number(b.monthly_limit).toLocaleString("tr-TR")} {t.budget.perMonth}</Text>
          </View>
          <TouchableOpacity onPress={async () => { await api.deleteBudget(b.id); load(); }}>
            <Text style={styles.delete}>{t.common.delete}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {budgets.length === 0 && <Text style={styles.empty}>{t.budget.empty}</Text>}
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
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  catName: { color: Colors.text, fontWeight: "600" },
  limit: { color: Colors.accent, marginTop: 4 },
  delete: { color: Colors.danger },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
});
