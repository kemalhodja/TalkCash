import { ReactNode } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing, Typography } from "@/constants/theme";

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
};

export function ModalSheet({ visible, title, onClose, children, actions }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Surface variant="glass" style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {children}
          {actions ?? (
            <View style={styles.defaultActions}>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancel}>{/* filled by parent via actions */}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: "center",
    padding: Spacing.lg,
  },
  card: { padding: Spacing.lg },
  title: { color: Colors.text, ...Typography.subtitle, fontWeight: "700", marginBottom: Spacing.md },
  defaultActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: Spacing.md },
  cancel: { color: Colors.textMuted },
});
