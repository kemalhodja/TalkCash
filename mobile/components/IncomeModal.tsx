import { useEffect, useState } from "react";
import { Alert, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

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
    if (!selectedWallet || !amount) return;
    setLoading(true);
    try {
      const res: any = await api.addIncome(selectedWallet, parseFloat(amount), description);
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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.home.addIncome}</Text>
          <Text style={styles.label}>{t.home.incomeWallet}</Text>
          <View style={styles.chips}>
            {wallets.map((w) => (
              <TouchableOpacity key={w.id}
                style={[styles.chip, selectedWallet === w.id && styles.chipActive]}
                onPress={() => setSelectedWallet(w.id)}>
                <Text style={styles.chipText}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={styles.input} placeholder={t.home.incomeAmount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder={t.home.incomeDesc} placeholderTextColor={Colors.textMuted}
            value={description} onChangeText={setDescription} />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
              <Text style={styles.submitText}>{loading ? "..." : t.home.incomeSubmit}</Text>
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
  label: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  chipActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  chipText: { color: Colors.textSecondary, fontSize: 13 },
  input: {
    backgroundColor: Colors.bg, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelText: { color: Colors.textSecondary },
  submitBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, backgroundColor: Colors.success, alignItems: "center" },
  submitText: { color: Colors.bg, fontWeight: "700" },
});
