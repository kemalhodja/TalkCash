import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";

type Option = { key: string; label: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (key: string) => void;
};

export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <TouchableOpacity
            key={opt.key}
            style={[styles.btn, active && styles.btnActive]}
            onPress={() => onChange(opt.key)}
          >
            <Text style={[styles.text, active && styles.textActive]}>{opt.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  btn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    backgroundColor: Colors.card,
  },
  btnActive: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  text: { color: Colors.textSecondary, fontWeight: "600", fontSize: 13 },
  textActive: { color: Colors.accent },
});
