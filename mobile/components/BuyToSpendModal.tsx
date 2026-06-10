import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
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
      await api.completeShoppingItem(itemId, parseFloat(price), selectedWallet || undefined);
      await speakBudgetAlertsAfterSpend(locale);
      setPrice("");
      onComplete();
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{itemName} {t.shopping.buyTitle}</Text>
          <Text style={styles.subtitle}>{t.shopping.buySubtitle}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TextInput style={styles.input} placeholder={t.shopping.pricePlaceholder} placeholderTextColor={Colors.textMuted}
            keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
          <View style={styles.walletList}>
            {wallets.map((w) => (
              <TouchableOpacity key={w.id}
                style={[styles.walletChip, selectedWallet === w.id && styles.walletActive]}
                onPress={() => setSelectedWallet(w.id)}>
                <Text style={styles.walletText}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmText}>{t.shopping.deduct}</Text>
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
  title: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  subtitle: { color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
  error: { color: Colors.danger, marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.bg, borderRadius: 10, padding: Spacing.md, color: Colors.text, fontSize: 18, borderWidth: 1, borderColor: Colors.border },
  walletList: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: Spacing.md },
  walletChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  walletActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  walletText: { color: Colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelText: { color: Colors.textSecondary },
  confirmBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, backgroundColor: Colors.accent, alignItems: "center" },
  confirmText: { color: Colors.bg, fontWeight: "700" },
});
