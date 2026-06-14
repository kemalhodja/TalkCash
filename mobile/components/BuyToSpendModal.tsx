import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { speakBudgetAlertsAfterSpend } from "@/services/speech";

interface Props {
  visible: boolean;
  itemId: string;
  itemName: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function BuyToSpendModal({ visible, itemId, itemName, onComplete, onCancel }: Props) {
  const { t, locale } = useI18n();
  const [price, setPrice] = useState("");
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (visible) {
      api.getWallets().then((w) => {
        setWallets(w);
        if (w.length) setSelectedWallet(w[0].id);
      }).catch((e) => setError(e.message));
    }
  }, [visible]);

  const handleConfirm = async () => {
    if (!price) { setError(t.shopping.priceRequired); return; }
    try {
      const res: any = await api.completeShoppingItem(itemId, parseFloat(price), selectedWallet || undefined);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.shopping.queuedOffline);
        setPrice("");
        onComplete();
        return;
      }
      await speakBudgetAlertsAfterSpend(locale);
      setPrice("");
      onComplete();
    } catch (e: any) {
      setError(e.message);
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
          <PrimaryButton label={t.shopping.deduct} onPress={handleConfirm} style={styles.btn} />
        </View>
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <InputField placeholder={t.shopping.pricePlaceholder} keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
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
