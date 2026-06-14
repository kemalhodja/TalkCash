import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function TransferModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [wallets, setWallets] = useState<any[]>([]);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      api.getWallets().then((w) => {
        setWallets(w);
        if (w.length >= 2) { setFromId(w[0].id); setToId(w[1].id); }
        else if (w.length === 1) setFromId(w[0].id);
      }).catch(() => setWallets([]));
    }
  }, [visible]);

  const handleTransfer = async () => {
    if (!fromId || !toId || !amount) return;
    setLoading(true);
    try {
      const res: any = await api.transfer(fromId, toId, parseFloat(amount), description);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.common.offlineQueued);
      } else {
        Alert.alert(t.transfer.success);
      }
      setAmount("");
      setDescription("");
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message);
    } finally {
      setLoading(false);
    }
  };

  const walletOptions = wallets.map((w) => ({ id: w.id, label: w.name }));

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={t.transfer.title}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.transfer.submit} onPress={handleTransfer} loading={loading} disabled={loading} style={styles.btn} />
        </View>
      }
    >
      <ChipPicker label={t.transfer.from} options={walletOptions} value={fromId} onChange={setFromId} />
      <ChipPicker label={t.transfer.to} options={walletOptions} value={toId} onChange={setToId} />
      <InputField placeholder={t.transfer.amount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <InputField placeholder={t.transfer.description} value={description} onChangeText={setDescription} />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
