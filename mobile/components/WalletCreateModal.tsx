import { useState } from "react";
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

export function WalletCreateModal({ visible, onClose, onSuccess }: Props) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [walletType, setWalletType] = useState<string>("cash");
  const [currency, setCurrency] = useState<string>("TRY");
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
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
