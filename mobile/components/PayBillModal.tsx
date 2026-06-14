import { useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { BottomSheetModal } from "@/components/ui/BottomSheetModal";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
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
    <BottomSheetModal
      visible={visible}
      onClose={onCancel}
      title={t.agenda.paid}
      subtitle={billTitle + (displayAmount > 0 ? ` — ${formatMoney(displayAmount, locale)}` : "")}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.agenda.paid} onPress={() => selectedWallet && onConfirm(selectedWallet)} disabled={!selectedWallet} style={styles.btn} />
        </View>
      }
    >
      <ChipPicker
        label={t.agenda.selectWallet}
        options={wallets.map((w) => ({ id: w.id, label: w.name }))}
        value={selectedWallet}
        onChange={setSelectedWallet}
      />
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  btn: { flex: 1 },
});
