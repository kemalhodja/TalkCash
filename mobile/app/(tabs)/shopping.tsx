import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BuyToSpendModal } from "@/components/BuyToSpendModal";
import { VoiceInput } from "@/components/VoiceInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { InsightChip } from "@/components/ui/InsightChip";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot, groupShoppingFromSnapshot } from "@/services/syncCache";

export default function ShoppingScreen() {
  const { t } = useI18n();
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [buyModal, setBuyModal] = useState<{ id: string; name: string } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadList = useCallback(async () => {
    try {
      setError("");
      const snapshot = await getCachedSnapshot();
      if (snapshot?.shopping?.length) {
        setGrouped(groupShoppingFromSnapshot(snapshot.shopping));
      }
      setGrouped(await api.getShoppingList());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);
  useRefreshOnFocus(loadList);
  const { refreshing, onRefresh } = usePullRefresh(loadList);

  const handleAdd = async () => {
    if (!newItem.trim()) return;
    const res: any = await api.addShoppingItems([newItem.trim()]);
    if (res?.status === "queued") {
      setGrouped(groupShoppingFromSnapshot((await getCachedSnapshot())?.shopping));
      Alert.alert(t.common.confirm, t.common.offlineQueued);
    }
    setNewItem("");
    loadList();
  };

  const categoryLabel = (key: string) =>
    (t.shopping.categories as Record<string, string>)[key] || key;

  if (loading) return <LoadingScreen />;

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t.shopping.title} />

      <Surface variant="glass" style={styles.addPanel}>
        <View style={styles.addRow}>
          <InputField
            containerStyle={styles.inputWrap}
            style={styles.input}
            placeholder={t.shopping.addPlaceholder}
            value={newItem}
            onChangeText={setNewItem}
            onSubmitEditing={handleAdd}
          />
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
          <PrimaryButton label="+" onPress={handleAdd} compact style={styles.addBtn} />
        </View>
        <Text style={styles.voiceHint}>{t.shopping.voiceHint}</Text>
      </Surface>

      {error ? <InsightChip tone="warning" text={error} /> : null}

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.category}>
          <Text style={styles.categoryTitle}>{categoryLabel(category)}</Text>
          {items.map((item) => (
            <TouchableOpacity key={item.id} activeOpacity={0.85}
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
              <Surface variant="elevated" style={styles.item}>
                <View style={styles.checkbox} />
                <Text style={styles.itemName}>
                  {item.name}{item.is_routine && (
                    <Text style={styles.routine}>
                      {item.routine_type === "weekly" ? " 📅" : " 🔄"}
                    </Text>
                  )}
                </Text>
              </Surface>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {Object.keys(grouped).length === 0 && !error && (
        <EmptyState message={t.shopping.empty} icon="🛒" />
      )}

      {buyModal && (
        <BuyToSpendModal visible={!!buyModal} itemId={buyModal.id} itemName={buyModal.name}
          onComplete={() => { setBuyModal(null); loadList(); }} onCancel={() => setBuyModal(null)} />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  addPanel: { padding: Spacing.md, marginBottom: Spacing.lg },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  inputWrap: { flex: 1, marginBottom: 0 },
  input: { marginBottom: 0 },
  voiceWrap: { justifyContent: "center" },
  voiceHint: { color: Colors.textMuted, fontSize: 12, marginTop: Spacing.sm },
  addBtn: {
    backgroundColor: Colors.accent,
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: Colors.bg, fontSize: 24, fontWeight: "700" },
  category: { marginBottom: Spacing.lg },
  categoryTitle: { color: Colors.textSecondary, fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm, letterSpacing: 0.5, textTransform: "uppercase" },
  item: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.accent, marginRight: Spacing.md },
  itemName: { color: Colors.text, fontSize: 16, flex: 1 },
  routine: { fontSize: 12 },
  error: { color: Colors.danger, marginBottom: Spacing.md },
});
