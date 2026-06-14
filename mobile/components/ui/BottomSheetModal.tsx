import { ReactNode } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function BottomSheetModal({ visible, onClose, title, subtitle, children, footer }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Surface variant="glass" style={styles.sheet}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
          {footer}
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: Colors.overlay },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  title: { color: Colors.text, ...Typography.subtitle, fontWeight: "700" },
  subtitle: { color: Colors.textSecondary, marginTop: 4, marginBottom: Spacing.md },
});
