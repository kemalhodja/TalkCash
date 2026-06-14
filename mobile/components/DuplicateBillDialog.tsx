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

export function DuplicateBillDialog({ visible, message, onConfirm, onCancel }: Props) {
  const { t } = useI18n();

  return (
    <DialogModal
      visible={visible}
      icon="⚠️"
      title={t.duplicate.title}
      accent
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.duplicate.confirmAnyway} onPress={onConfirm} variant="secondary" style={styles.btn} />
        </View>
      }
    >
      <Text style={styles.message}>{message}</Text>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  message: { color: Colors.textSecondary, textAlign: "center", lineHeight: 22, marginBottom: Spacing.lg },
  actions: { flexDirection: "row", gap: Spacing.sm, width: "100%" },
  btn: { flex: 1 },
});
