import { ReactNode } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing, Typography } from "@/constants/theme";

type Props = {
  visible: boolean;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  icon?: string;
  accent?: boolean;
};

export function DialogModal({ visible, title, children, footer, icon, accent }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Surface variant={accent ? "accent" : "glass"} style={styles.card}>
          {icon ? <Text style={styles.icon}>{icon}</Text> : null}
          {title ? <Text style={[styles.title, accent && styles.titleAccent]}>{title}</Text> : null}
          {children}
          {footer}
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  card: { padding: Spacing.lg, alignItems: "center" },
  icon: { fontSize: 36, marginBottom: Spacing.sm },
  title: { color: Colors.text, ...Typography.subtitle, fontWeight: "700", marginBottom: Spacing.sm, textAlign: "center" },
  titleAccent: { color: Colors.warning },
});
