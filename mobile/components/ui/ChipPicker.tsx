import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { hapticSelection } from "@/utils/haptics";

type Option = { id: string; label: string };

type Props = {
  label?: string;
  options: readonly Option[];
  value: string | null;
  onChange: (id: string) => void;
};

export function ChipPicker({ label, options, value, onChange }: Props) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? <Text style={styles.label} accessibilityRole="text">{label}</Text> : null}
      <View style={styles.chips}>
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => {
                if (opt.id !== value) {
                  hapticSelection();
                  onChange(opt.id);
                }
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, marginBottom: Spacing.sm, fontSize: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.pill, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card },
  chipActive: { borderColor: Colors.borderStrong, backgroundColor: Colors.accentSoft },
  chipText: { color: Colors.textSecondary, fontSize: 13 },
  chipTextActive: { color: Colors.accent, fontWeight: "600" },
});
