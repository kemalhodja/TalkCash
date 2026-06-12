import { useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

const WALLET_TYPES = ["cash", "bank", "credit_card", "investment_gold", "investment_forex"] as const;
const CURRENCIES = ["TRY", "USD", "EUR", "GBP"] as const;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
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
      await api.createWallet(name.trim(), walletType, currency);
      Alert.alert(t.home.walletCreated);
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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.home.createWallet}</Text>
          <TextInput style={styles.input} placeholder={t.home.walletName} placeholderTextColor={Colors.textMuted}
            value={name} onChangeText={setName} />
          <View style={styles.chips}>
            {WALLET_TYPES.map((type) => (
              <TouchableOpacity key={type}
                style={[styles.chip, walletType === type && styles.chipActive]}
                onPress={() => setWalletType(type)}>
                <Text style={styles.chipText}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionLabel}>{t.home.walletCurrency}</Text>
          <View style={styles.chips}>
            {CURRENCIES.map((c) => (
              <TouchableOpacity key={c}
                style={[styles.chip, currency === c && styles.chipActive]}
                onPress={() => setCurrency(c)}>
                <Text style={styles.chipText}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleCreate} disabled={loading}>
              <Text style={styles.submitText}>{loading ? "..." : t.common.save}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  card: { backgroundColor: Colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg },
  title: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  sectionLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  chipActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  chipText: { color: Colors.textSecondary, fontSize: 12 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelText: { color: Colors.textSecondary },
  submitBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, backgroundColor: Colors.accent, alignItems: "center" },
  submitText: { color: Colors.bg, fontWeight: "700" },
});
