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
      await api.transfer(fromId, toId, parseFloat(amount), description);
      Alert.alert(t.transfer.success);
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

  const renderWalletPicker = (label: string, selected: string | null, onSelect: (id: string) => void) => (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chips}>
        {wallets.map((w) => (
          <TouchableOpacity key={w.id}
            style={[styles.chip, selected === w.id && styles.chipActive]}
            onPress={() => onSelect(w.id)}>
            <Text style={styles.chipText}>{w.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.transfer.title}</Text>
          {renderWalletPicker(t.transfer.from, fromId, setFromId)}
          {renderWalletPicker(t.transfer.to, toId, setToId)}
          <TextInput style={styles.input} placeholder={t.transfer.amount} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={amount} onChangeText={setAmount} />
          <TextInput style={styles.input} placeholder={t.transfer.description} placeholderTextColor={Colors.textMuted}
            value={description} onChangeText={setDescription} />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.submitBtn} onPress={handleTransfer} disabled={loading}>
              <Text style={styles.submitText}>{loading ? "..." : t.transfer.submit}</Text>
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
  section: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  submitBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, backgroundColor: Colors.accent, alignItems: "center" },
  submitText: { color: Colors.bg, fontWeight: "700" },
});
