import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { BuyToSpendModal } from "@/components/BuyToSpendModal";
import { VoiceInput } from "@/components/VoiceInput";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";

export default function ShoppingScreen() {
  const { t } = useI18n();
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [buyModal, setBuyModal] = useState<{ id: string; name: string } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = async () => {
    try {
      setError("");
      const snapshot = await getCachedSnapshot();
      if (snapshot?.shopping?.length) {
        const grouped: Record<string, any[]> = {};
        for (const item of snapshot.shopping) {
          const cat = item.category || "OTHER";
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(item);
        }
        setGrouped(grouped);
      }
      setGrouped(await api.getShoppingList());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);
  useRefreshOnFocus(loadList);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    const res: any = await api.addShoppingItems([newItem.trim()]);
    if (res?.status === "queued") {
      Alert.alert(t.common.confirm, t.common.offlineQueued);
    }
    setNewItem("");
    loadList();
  };

  const categoryLabel = (key: string) =>
    (t.shopping.categories as Record<string, string>)[key] || key;

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.shopping.title}</Text>

      <View style={styles.addRow}>
        <TextInput style={styles.input} placeholder={t.shopping.addPlaceholder} placeholderTextColor={Colors.textMuted}
          value={newItem} onChangeText={setNewItem} onSubmitEditing={handleAdd} />
        <View style={styles.voiceWrap}>
          <VoiceInput compact whisperMode={false} onResult={async (_text, result) => {
            let res: any;
            if (result?.parsed?.intent === "add_shopping" && result.parsed.items?.length) {
              res = await api.addShoppingItems(result.parsed.items);
            } else if (result?.parsed?.description) {
              res = await api.addShoppingItems([result.parsed.description]);
            }
            if (res?.status === "queued") {
              Alert.alert(t.common.confirm, t.common.offlineQueued);
            }
            loadList();
          }} />
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAdd}>
          <Text style={styles.addBtnText}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.voiceHint}>{t.shopping.voiceHint}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.category}>
          <Text style={styles.categoryTitle}>{categoryLabel(category)}</Text>
          {items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.item}
              onPress={() => setBuyModal({ id: item.id, name: item.name })}
              onLongPress={() => {
                if (item.is_routine) {
                  Alert.alert(t.shopping.title, t.agenda.cancel, [
                    { text: t.common.cancel, style: "cancel" },
                    { text: t.common.delete, onPress: async () => { await api.setRoutine(item.id, false); loadList(); } },
                  ]);
                } else {
                  Alert.alert(t.shopping.title, "", [
                    { text: t.agenda.routineDaily, onPress: async () => { await api.setRoutine(item.id, true, "daily"); loadList(); } },
                    { text: t.agenda.routineWeekly, onPress: async () => { await api.setRoutine(item.id, true, "weekly"); loadList(); } },
                    { text: t.common.delete, style: "destructive", onPress: async () => { await api.deleteShoppingItem(item.id); loadList(); } },
                    { text: t.common.cancel, style: "cancel" },
                  ]);
                }
              }}>
              <View style={styles.checkbox} />
              <Text style={styles.itemName}>
                {item.name}{item.is_routine && (
                  <Text style={styles.routine}>
                    {item.routine_type === "weekly" ? " 📅" : " 🔄"}
                  </Text>
                )}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {Object.keys(grouped).length === 0 && !error && (
        <Text style={styles.empty}>{t.shopping.empty}</Text>
      )}

      {buyModal && (
        <BuyToSpendModal visible={!!buyModal} itemId={buyModal.id} itemName={buyModal.name}
          onComplete={() => { setBuyModal(null); loadList(); }} onCancel={() => setBuyModal(null)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.md },
  addRow: { flexDirection: "row", gap: 8, marginBottom: Spacing.md },
  input: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, borderWidth: 1, borderColor: Colors.border,
  },
  voiceWrap: { justifyContent: "center" },
  voiceHint: { color: Colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: Spacing.sm },
  addBtn: { backgroundColor: Colors.accent, width: 48, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  addBtnText: { color: Colors.bg, fontSize: 24, fontWeight: "700" },
  category: { marginBottom: Spacing.lg },
  categoryTitle: { color: Colors.textSecondary, fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  item: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 10, padding: Spacing.md, marginBottom: 6, borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.accent, marginRight: Spacing.md },
  itemName: { color: Colors.text, fontSize: 16 },
  routine: { fontSize: 12 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
  error: { color: Colors.danger, marginBottom: Spacing.md },
});
