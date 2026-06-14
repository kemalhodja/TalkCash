import { StyleSheet, Text, View } from "react-native";
import { DialogModal } from "@/components/ui/DialogModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

interface Props {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationCard({ visible, message, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <DialogModal
      visible={visible}
      title={t.common.confirm}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.common.confirm} onPress={onConfirm} style={styles.btn} />
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  message: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.lg, textAlign: "center" },
  actions: { flexDirection: "row", gap: Spacing.sm, width: "100%" },
  btn: { flex: 1 },
});
