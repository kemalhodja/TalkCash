import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { completeShoppingLocalFirst } from "@/services/shoppingRepository";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";
import { extractVoiceAlert, playVoiceAlert } from "@/utils/voiceAlert";
import { extractSwapNudge, type SwapNudge } from "@/utils/swapNudge";
import { parsePositiveAmount } from "@/utils/amount";

interface Props {
  visible: boolean;
  itemId: string;
  itemName: string;
  onComplete: () => void;
  onCancel: () => void;
  onSwapNudge?: (nudge: SwapNudge) => void;
  onMicroExtras?: (res: any) => void;
}

export function BuyToSpendModal({ visible, itemId, itemName, onComplete, onCancel, onSwapNudge, onMicroExtras }: Props) {
  const { t, locale } = useI18n();
  const [price, setPrice] = useState("");
  const [storeName, setStoreName] = useState("");
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      api.getWallets().then((w) => {
        setWallets(w);
        if (w.length) setSelectedWallet(w[0].id);
      }).catch((e) => setError(e.message));
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (loading) return;
    const parsedPrice = parsePositiveAmount(price);
    if (!parsedPrice) { setError(t.common.invalidAmount); return; }
    if (!storeName.trim()) { setError(t.input.confirmStoreRequired); return; }
    setLoading(true);
    try {
      const res: any = await completeShoppingLocalFirst(itemId, parsedPrice, selectedWallet || undefined, storeName.trim());
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.shopping.queuedOffline);
        setPrice("");
        setStoreName("");
        onComplete();
        return;
      }
      await speakBudgetAlertsAfterSpend(locale);
      playVoiceAlert(extractVoiceAlert(res), locale);
      const swap = extractSwapNudge(res);
      if (swap) onSwapNudge?.(swap);
      onMicroExtras?.(res);
      setPrice("");
      setStoreName("");
      onComplete();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onCancel}
      title={`${itemName} ${t.shopping.buyTitle}`}
      subtitle={t.shopping.buySubtitle}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.shopping.deduct} onPress={handleConfirm} loading={loading} disabled={loading} style={styles.btn} />
        </View>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <InputField placeholder={t.shopping.pricePlaceholder} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <InputField placeholder={t.input.confirmStorePlaceholder} value={storeName} onChangeText={setStoreName} />
      <ChipPicker
        options={wallets.map((w) => ({ id: w.id, label: w.name }))}
        value={selectedWallet}
        onChange={setSelectedWallet}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
