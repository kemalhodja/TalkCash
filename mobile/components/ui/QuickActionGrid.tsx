import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
};

export function QuickActionGrid({ actions }: { actions: Action[] }) {
  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.key}
          style={[styles.btn, a.primary && styles.btnPrimary]}
          onPress={a.onPress}
          activeOpacity={0.82}
        >
          <View style={[styles.iconWrap, a.primary && styles.iconWrapPrimary]}>
            <Ionicons name={a.icon} size={18} color={a.primary ? Colors.bg : Colors.accent} />
          </View>
          <Text style={[styles.label, a.primary && styles.labelPrimary]} numberOfLines={2}>
            {a.label}
          </Text>
          {a.primary ? <View style={styles.primaryGlow} /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  btn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
    ...Shadow.card,
  },
  btnPrimary: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.borderStrong,
    ...Shadow.glow,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconWrapPrimary: { backgroundColor: Colors.accent },
  label: { color: Colors.textSecondary, fontSize: 11, fontWeight: "600", textAlign: "center" },
  labelPrimary: { color: Colors.accent },
  primaryGlow: {
    position: "absolute",
    top: -20,
    right: -20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.accentGlow,
    opacity: 0.35,
  },
});
