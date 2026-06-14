import { useEffect, useState } from "react";
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
  wallet: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function WalletEditModal({ visible, wallet, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState("cash");
  const [currency, setCurrency] = useState("TRY");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && wallet) {
      setName(wallet.name || "");
      setWalletType(wallet.wallet_type || "cash");
      setCurrency(wallet.currency || "TRY");
    }
  }, [visible, wallet]);

  const handleSave = async () => {
    if (!wallet || !name.trim()) return;
    setLoading(true);
    try {
      await api.updateWallet(wallet.id, { name: name.trim(), wallet_type: walletType, currency });
      onSuccess();
      onClose();
    } catch (e: any) {
      Alert.alert(t.common.error, e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!wallet) return;
    Alert.alert(t.home.deleteWallet, t.home.deleteWalletConfirm, [
      { text: t.common.cancel, style: "cancel" },
      {
        text: t.common.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteWallet(wallet.id);
            onSuccess();
            onClose();
          } catch (e: any) {
            Alert.alert(t.common.error, e.message);
          }
        },
      },
    ]);
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={t.home.editWallet}
      footer={
        <View style={styles.footer}>
          <PrimaryButton label={t.common.delete} onPress={handleDelete} variant="danger" compact />
          <View style={styles.actions}>
            <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" style={styles.btn} />
            <PrimaryButton label={t.common.save} onPress={handleSave} loading={loading} disabled={loading} style={styles.btn} />
          </View>
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
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.sm },
  btn: { flex: 1 },
});
