import { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BuyToSpendModal } from "@/components/BuyToSpendModal";
import { SmartBasketScanner } from "@/components/SmartBasketScanner";
import { ShoppingSuggestionLoop } from "@/components/ShoppingSuggestionLoop";
import { MicroSavingsNudges } from "@/components/MicroSavingsNudges";
import { VoiceInput } from "@/components/VoiceInput";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { InsightChip } from "@/components/ui/InsightChip";
import { InputField } from "@/components/ui/InputField";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { usePullRefresh } from "@/hooks/usePullRefresh";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getCachedSnapshot } from "@/services/syncCache";
import { addShoppingLocalFirst, deleteShoppingLocalFirst, loadShoppingLocalFirst, refreshShoppingWithSync, setRoutineLocalFirst } from "@/services/shoppingRepository";
import { hasActiveSuggestion, type ShoppingSuggestion } from "@/utils/shoppingSuggestionVoice";
import { extractSwapNudge, type SwapNudge } from "@/utils/swapNudge";
import { extractRoundUp, type RoundUpNudge } from "@/utils/roundUp";
import { buildShoppingDepletionHints } from "@/utils/shoppingSuggestions";

export default function ShoppingScreen() {
  const { t } = useI18n();
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [buyModal, setBuyModal] = useState<{ id: string; name: string } | null>(null);
  const [newItem, setNewItem] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [depletionHints, setDepletionHints] = useState<{ item: string; daysSince: number }[]>([]);
  const [smartBasketOpen, setSmartBasketOpen] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<ShoppingSuggestion | null>(null);
  const [pendingSwap, setPendingSwap] = useState<SwapNudge | null>(null);
  const [pendingRoundUp, setPendingRoundUp] = useState<RoundUpNudge | null>(null);

  const handleMicroExtras = (res: any) => {
    const swap = extractSwapNudge(res);
    if (swap) setPendingSwap(swap);
    const roundUp = extractRoundUp(res);
    if (roundUp) setPendingRoundUp(roundUp);
  };

  const handleAddResponse = (res: any) => {
    if (hasActiveSuggestion(res)) {
      setPendingSuggestion(res.suggestion);
    }
  };

  const loadList = useCallback(async () => {
    try {
      setError("");
      const cached = await loadShoppingLocalFirst();
      if (Object.keys(cached).length) setGrouped(cached);
      const list = await refreshShoppingWithSync();
      setGrouped(list);
      const snapshot = await getCachedSnapshot();
      const activeNames = Object.values(list).flat().map((item: any) => item.name);
      setDepletionHints(buildShoppingDepletionHints(snapshot?.transactions, activeNames));
    } catch (e: any) {
      const fallback = await loadShoppingLocalFirst();
      setGrouped(fallback);
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
    const res: any = await addShoppingLocalFirst([newItem.trim()]);
    if (res?.status === "queued") {
      Alert.alert(t.common.confirm, t.common.offlineQueued);
    } else {
      handleAddResponse(res);
    }
    setNewItem("");
    loadList();
  };

  const categoryLabel = (key: string) =>
    (t.shopping.categories as Record<string, string>)[key] || key;

  if (loading) {
    return (
      <ScreenShell ambient="subtle">
        <SkeletonCard />
        <SkeletonCard />
      </ScreenShell>
    );
  }
  const isEmpty = Object.keys(grouped).length === 0;
  if (error && isEmpty) return <ErrorState message={error} onRetry={loadList} />;

  return (
    <ScreenShell ambient="subtle" refreshing={refreshing} onRefresh={onRefresh}>
      <ScreenHeader title={t.shopping.title} />
      {error ? <InsightChip tone="warning" text={`${error} · ${t.common.staleData}`} /> : null}

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
                res = await addShoppingLocalFirst(result.parsed.items);
              } else if (result?.parsed?.description) {
                res = await addShoppingLocalFirst([result.parsed.description]);
              }
              if (res?.status === "queued") {
                Alert.alert(t.common.confirm, t.common.offlineQueued);
              } else if (res) {
                handleAddResponse(res);
              }
              loadList();
            }} />
          </View>
          <PrimaryButton label="+" onPress={handleAdd} compact style={styles.addBtn} />
        </View>
        <Text style={styles.voiceHint}>{t.shopping.voiceHint}</Text>
        <PrimaryButton
          label={`📷 ${t.shopping.smartBasket}`}
          onPress={() => setSmartBasketOpen(true)}
          variant="secondary"
          compact
          style={styles.smartBasketBtn}
        />
      </Surface>

      {error ? <InsightChip tone="warning" text={error} /> : null}

      <ShoppingSuggestionLoop
        suggestion={pendingSuggestion}
        onAccepted={async (item) => {
          setPendingSuggestion(null);
          await addShoppingLocalFirst([item], true);
          loadList();
        }}
        onDismiss={() => setPendingSuggestion(null)}
      />

      {Object.entries(grouped).map(([category, items]) => (
        <SectionBlock key={category} title={categoryLabel(category)} bare>
          {items.map((item) => (
            <TouchableOpacity key={item.id} activeOpacity={0.85}
              onPress={() => setBuyModal({ id: item.id, name: item.name })}
              onLongPress={() => {
                const run = async (fn: () => Promise<any>) => {
                  const res = await fn();
                  if (res?.status === "queued") Alert.alert(t.common.confirm, t.common.offlineQueued);
                  loadList();
                };
                if (item.is_routine) {
                  Alert.alert(t.shopping.title, t.agenda.cancel, [
                    { text: t.common.cancel, style: "cancel" },
                    { text: t.common.delete, onPress: () => run(() => setRoutineLocalFirst(item.id, false)) },
                  ]);
                } else {
                  Alert.alert(t.shopping.title, "", [
                    { text: t.agenda.routineDaily, onPress: () => run(() => setRoutineLocalFirst(item.id, true, "daily")) },
                    { text: t.agenda.routineWeekly, onPress: () => run(() => setRoutineLocalFirst(item.id, true, "weekly")) },
                    { text: t.common.delete, style: "destructive", onPress: () => run(() => deleteShoppingLocalFirst(item.id)) },
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
        </SectionBlock>
      ))}

      {Object.keys(grouped).length === 0 && !error && (
        <EmptyState message={t.shopping.empty} icon="🛒" />
      )}

      {depletionHints.length > 0 ? (
        <View style={styles.hintsSection}>
          <Text style={styles.hintsTitle}>{t.shopping.depletionTitle}</Text>
          {depletionHints.map((hint) => (
            <TouchableOpacity
              key={hint.item}
              activeOpacity={0.85}
              onPress={async () => {
                await api.addShoppingItems([hint.item]);
                loadList();
              }}
            >
              <Text style={styles.hintText}>
                {t.shopping.depletionHint
                  .replace("{item}", hint.item)
                  .replace("{days}", String(hint.daysSince))}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {pendingSwap || pendingRoundUp ? (
        <MicroSavingsNudges
          swap={pendingSwap}
          roundUp={pendingRoundUp}
          onDismiss={() => {
            setPendingSwap(null);
            setPendingRoundUp(null);
          }}
          onRefresh={loadList}
        />
      ) : null}

      {buyModal && (
        <BuyToSpendModal visible={!!buyModal} itemId={buyModal.id} itemName={buyModal.name}
          onComplete={() => { setBuyModal(null); loadList(); }}
          onMicroExtras={handleMicroExtras}
          onCancel={() => setBuyModal(null)} />
      )}

      <SmartBasketScanner
        visible={smartBasketOpen}
        onClose={() => setSmartBasketOpen(false)}
        onItems={async (items) => {
          const res: any = await addShoppingLocalFirst(items);
          if (res?.status === "queued") Alert.alert(t.common.confirm, t.common.offlineQueued);
          else {
            if (hasActiveSuggestion(res)) handleAddResponse(res);
            else Alert.alert(t.common.confirm, t.shopping.smartBasketAdded.replace("{count}", String(items.length)));
          }
          loadList();
        }}
      />
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
  smartBasketBtn: { marginTop: Spacing.sm, alignSelf: "flex-start" },
  hintsSection: { marginTop: Spacing.lg, paddingHorizontal: Spacing.xs, gap: Spacing.sm },
  hintsTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: Spacing.xs },
  hintText: { color: Colors.textMuted, fontSize: 14, lineHeight: 22, opacity: 0.85 },
  addBtn: {
    backgroundColor: Colors.accent,
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  addBtnText: { color: Colors.bg, fontSize: 24, fontWeight: "700" },
  item: { flexDirection: "row", alignItems: "center", padding: Spacing.md, marginBottom: 6 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.accent, marginRight: Spacing.md },
  itemName: { color: Colors.text, fontSize: 16, flex: 1 },
  routine: { fontSize: 12 },
  error: { color: Colors.danger, marginBottom: Spacing.md },
});
