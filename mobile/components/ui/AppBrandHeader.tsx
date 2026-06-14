import { StyleSheet, Text, View } from "react-native";
import { Colors, Spacing, Typography } from "@/constants/theme";

export function AppBrandHeader({ greeting, name }: { greeting: string; name: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.logoDot} />
        <Text style={styles.brand}>TalkCash</Text>
      </View>
      <Text style={styles.greeting}>{greeting}, {name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.lg },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  logoDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
  brand: { color: Colors.textMuted, ...Typography.label },
  greeting: { color: Colors.text, fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
});
