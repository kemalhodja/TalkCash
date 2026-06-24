import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { parsePositiveAmount } from "@/utils/amount";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function IncomeModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      api.getWallets().then((w) => {
        setWallets(w);
        const bank = w.find((x: any) => x.name?.toLowerCase().includes("banka") || x.name?.toLowerCase().includes("bank"));
        setSelectedWallet(bank?.id || w[0]?.id || null);
      }).catch(() => setWallets([]));
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (loading) return;
    const parsedAmount = parsePositiveAmount(amount);
    if (!selectedWallet || !parsedAmount) {
      Alert.alert(t.common.error, t.common.invalidAmount);
      return;
    }
    setLoading(true);
    try {
      const res: any = await api.addIncome(selectedWallet, parsedAmount, description);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.common.offlineQueued);
      } else {
        Alert.alert(t.home.incomeAdded);
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

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={t.home.addIncome}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.home.incomeSubmit} onPress={handleSubmit} loading={loading} disabled={loading} style={styles.btn} />
        </View>
      }
    >
      <ChipPicker
        label={t.home.incomeWallet}
        options={wallets.map((w) => ({ id: w.id, label: w.name }))}
        value={selectedWallet}
        onChange={setSelectedWallet}
      />
      <InputField placeholder={t.home.incomeAmount} keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
      <InputField placeholder={t.home.incomeDesc} value={description} onChangeText={setDescription} />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
