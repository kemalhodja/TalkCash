import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

interface Props {
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

export function NumericKeypad({ value, onChange, onSubmit }: Props) {
  const handleKey = (key: string) => {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
    } else {
      onChange(value + key);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.display}>{value || "0"}</Text>
      <View style={styles.grid}>
        {KEYS.map((key) => (
          <TouchableOpacity key={key} style={styles.key} onPress={() => handleKey(key)}>
            <Text style={styles.keyText}>{key}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.submitBtn} onPress={onSubmit}>
        <Text style={styles.submitText}>Kaydet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md },
  display: {
    color: Colors.text, fontSize: 32, fontWeight: "700",
    textAlign: "center", marginBottom: Spacing.md,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  key: {
    width: "30%", aspectRatio: 2, backgroundColor: Colors.card,
    borderRadius: 10, justifyContent: "center", alignItems: "center",
    borderWidth: 1, borderColor: Colors.border,
  },
  keyText: { color: Colors.text, fontSize: 20, fontWeight: "600" },
  submitBtn: {
    marginTop: Spacing.md, backgroundColor: Colors.accent,
    padding: Spacing.md, borderRadius: 10, alignItems: "center",
  },
  submitText: { color: Colors.bg, fontWeight: "700", fontSize: 16 },
});
