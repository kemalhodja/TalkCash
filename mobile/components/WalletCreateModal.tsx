import { useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

const WALLET_TYPE_OPTIONS = [
  { id: "cash", label: "cash" },
  { id: "bank", label: "bank" },
  { id: "credit_card", label: "credit_card" },
  { id: "investment_gold", label: "investment_gold" },
  { id: "investment_forex", label: "investment_forex" },
];

const CURRENCY_OPTIONS = [
  { id: "TRY", label: "TRY" },
  { id: "USD", label: "USD" },
  { id: "EUR", label: "EUR" },
  { id: "GBP", label: "GBP" },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function WalletCreateModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState("cash");
  const [currency, setCurrency] = useState("TRY");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res: any = await api.createWallet(name.trim(), walletType, currency);
      if (res?.status === "queued") {
        Alert.alert(t.common.confirm, t.common.offlineQueued);
      } else {
        Alert.alert(t.home.walletCreated);
      }
      setName("");
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
      title={t.home.createWallet}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.common.save} onPress={handleCreate} loading={loading} disabled={loading} style={styles.btn} />
        </View>
      }
    >
      <InputField placeholder={t.home.walletName} value={name} onChangeText={setName} />
      <ChipPicker options={WALLET_TYPE_OPTIONS} value={walletType} onChange={setWalletType} />
      <ChipPicker label={t.home.walletCurrency} options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
