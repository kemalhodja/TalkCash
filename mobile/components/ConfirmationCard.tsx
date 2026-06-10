import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

interface Props {
  visible: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmationCard({ visible, message, onConfirm, onCancel }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Onay</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>Onayla</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
    padding: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  message: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.lg },
  actions: { flexDirection: "row", gap: Spacing.sm },
  cancelBtn: {
    flex: 1, padding: Spacing.md, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, alignItems: "center",
  },
  cancelText: { color: Colors.textSecondary, fontWeight: "600" },
  confirmBtn: {
    flex: 1, padding: Spacing.md, borderRadius: 10,
    backgroundColor: Colors.accent, alignItems: "center",
  },
  confirmText: { color: Colors.bg, fontWeight: "700" },
});
