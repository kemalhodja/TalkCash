import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function NumericKeypad({ value, onChange, onSubmit }: Props) {
  const { t } = useI18n();

  const handleKey = (key: string) => {
    if (key === "⌫") onChange(value.slice(0, -1));
    else onChange(value + key);
  };

  return (
    <Surface variant="glass" style={styles.container}>
      <Text style={styles.display}>{value || "0"}</Text>
      <View style={styles.grid}>
        {KEYS.map((key) => (
          <TouchableOpacity key={key} style={styles.key} onPress={() => handleKey(key)} activeOpacity={0.85}>
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <PrimaryButton label={t.common.save} onPress={onSubmit} style={styles.submitBtn} />
    </Surface>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md, marginTop: Spacing.sm },
  display: {
    color: Colors.text, fontSize: 32, fontWeight: "700",
    textAlign: "center", marginBottom: Spacing.md,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  key: {
    width: "30%", aspectRatio: 2, backgroundColor: Colors.cardElevated,
    borderRadius: Radius.md, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  keyText: { color: Colors.text, fontSize: 20, fontWeight: "600" },
  submitBtn: { marginTop: Spacing.md },
});
