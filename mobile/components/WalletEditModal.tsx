import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

const WALLET_TYPES = ["cash", "bank", "credit_card", "investment_gold", "investment_forex"] as const;
const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

interface Props {
  visible: boolean;
  wallet: any | null;
  onClose: () => void;
  onSuccess: () => void;
}

function TypeChips({ values, selected, onSelect }: { values: readonly string[]; selected: string; onSelect: (v: string) => void }) {
  return (
    <View style={styles.chips}>
      {values.map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, selected === v && styles.chipActive]} onPress={() => onSelect(v)}>
          <Text style={[styles.chipText, selected === v && styles.chipTextActive]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
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
      <TypeChips values={WALLET_TYPES} selected={walletType} onSelect={setWalletType} />
      <Text style={styles.sectionLabel}>{t.home.walletCurrency}</Text>
      <TypeChips values={CURRENCIES} selected={currency} onSelect={setCurrency} />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  sectionLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 12 },
  chipTextActive: { color: Colors.accent, fontWeight: "600" },
  footer: { marginTop: Spacing.md, gap: Spacing.sm },
  actions: { flexDirection: "row", gap: Spacing.sm },
  btn: { flex: 1 },
});
