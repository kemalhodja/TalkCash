import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";
import { api } from "@/services/api";

interface Props {
  visible: boolean;
  billTitle: string;
  amount: number;
  onConfirm: (walletId: string) => void;
  onCancel: () => void;
}

export function PayBillModal({ visible, billTitle, amount, onConfirm, onCancel }: Props) {
  const { t, locale } = useI18n();
  const [wallets, setWallets] = useState<any[]>([]);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [displayAmount, setDisplayAmount] = useState(amount);

  useEffect(() => {
    if (visible) {
      setDisplayAmount(amount);
      api.getWallets().then((w) => {
        setWallets(w);
        const bank = w.find((x: any) => x.name?.toLowerCase().includes("banka") || x.name?.toLowerCase().includes("bank"));
        setSelectedWallet(bank?.id || w[0]?.id || null);
      }).catch(() => setWallets([]));

      if (!amount) {
        api.getAgenda(365).then((items) => {
          const match = items.find((i: any) =>
            i.title?.toLowerCase().includes(billTitle.toLowerCase())
            || billTitle.toLowerCase().includes(i.title?.toLowerCase()),
          );
          if (match?.amount) setDisplayAmount(Number(match.amount));
        }).catch(() => {});
      }
    }
  }, [visible, amount, billTitle]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.agenda.paid}</Text>
          <Text style={styles.subtitle}>
            {billTitle}{displayAmount > 0 ? ` — ${formatMoney(displayAmount, locale)}` : ""}
          </Text>
          <Text style={styles.label}>{t.agenda.selectWallet}</Text>
          <View style={styles.chips}>
            {wallets.map((w) => (
              <TouchableOpacity key={w.id}
                style={[styles.chip, selectedWallet === w.id && styles.chipActive]}
                onPress={() => setSelectedWallet(w.id)}>
                <Text style={styles.chipText}>{w.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>{t.common.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn}
              onPress={() => selectedWallet && onConfirm(selectedWallet)} disabled={!selectedWallet}>
              <Text style={styles.confirmText}>{t.agenda.paid}</Text>
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
  label: { color: Colors.textSecondary, marginBottom: Spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: Spacing.md },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  chipActive: { borderColor: Colors.accent, backgroundColor: "rgba(0,212,170,0.1)" },
  chipText: { color: Colors.textSecondary, fontSize: 13 },
  actions: { flexDirection: "row", gap: Spacing.sm },
  cancelBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, alignItems: "center" },
  cancelText: { color: Colors.textSecondary },
  confirmBtn: { flex: 1, padding: Spacing.md, borderRadius: 10, backgroundColor: Colors.success, alignItems: "center" },
  confirmText: { color: Colors.bg, fontWeight: "700" },
});
