import { StyleSheet, Text, View } from "react-native";
import { DialogModal } from "@/components/ui/DialogModal";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import type { SyncConflict } from "@/services/offlineQueue";

interface Props {
  visible: boolean;
  conflict: SyncConflict | null;
  onResolve: (choice: "local" | "server") => void;
  onSkip: () => void;
}

export function ConflictModal({ visible, conflict, onResolve, onSkip }: Props) {
  const { t } = useI18n();
  if (!conflict) return null;

  return (
    <DialogModal
      visible={visible}
      title={t.sync.conflictTitle}
      footer={
        <>
          <View style={styles.actions}>
            <PrimaryButton label={t.sync.keepLocal} onPress={() => onResolve("local")} style={styles.btn} />
            <PrimaryButton label={t.sync.keepServer} onPress={() => onResolve("server")} variant="secondary" style={styles.btn} />
          </View>
          <TextLink label={t.sync.skip} onPress={onSkip} style={styles.skip} />
        </>
      }
    >
      <Text style={styles.message}>{conflict.message}</Text>
      <Text style={styles.hint}>{t.sync.conflictHint}</Text>
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  message: { color: Colors.textSecondary, fontSize: 14, marginBottom: Spacing.sm, textAlign: "center" },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.md, textAlign: "center" },
  actions: { flexDirection: "row", gap: 8, width: "100%" },
  btn: { flex: 1 },
  skip: { marginTop: Spacing.sm, textAlign: "center" },
});
