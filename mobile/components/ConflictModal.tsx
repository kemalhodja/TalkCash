import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t.sync.conflictTitle}</Text>
          <Text style={styles.message}>{conflict.message}</Text>
          <Text style={styles.hint}>{t.sync.conflictHint}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={() => onResolve("local")}>
              <Text style={styles.btnText}>{t.sync.keepLocal}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.serverBtn]} onPress={() => onResolve("server")}>
              <Text style={styles.btnText}>{t.sync.keepServer}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onSkip}>
            <Text style={styles.skip}>{t.sync.skip}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: Spacing.lg },
  card: { backgroundColor: Colors.card, borderRadius: 16, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  title: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  message: { color: Colors.textSecondary, fontSize: 14, marginBottom: Spacing.sm },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.md },
  actions: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  btn: { flex: 1, backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  serverBtn: { backgroundColor: Colors.warning },
  btnText: { color: Colors.bg, fontWeight: "700" },
  skip: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.sm },
});
