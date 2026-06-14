import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";

type Props = {
  hint?: string;
};

export function LoadingScreen({ hint }: Props) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={Colors.accent} size="large" />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  hint: { color: Colors.textSecondary, marginTop: Spacing.md, fontSize: 14 },
});
