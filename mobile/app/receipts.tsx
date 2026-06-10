import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { api } from "@/services/api";

export default function ReceiptsScreen() {
  const { t } = useI18n();
  const [receipts, setReceipts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setReceipts(await api.getReceipts());
    } catch {
      setReceipts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: t.receipts.title }} />
      {receipts.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.merchant}>{r.merchant || "—"}</Text>
          <Text style={styles.amount}>
            {r.total_amount != null ? `${Number(r.total_amount).toLocaleString()} ₺` : "—"}
          </Text>
          <Text style={styles.meta}>
            {r.date ? new Date(r.date).toLocaleDateString() : "—"} ·{" "}
            {r.verified ? t.receipts.verified : t.receipts.unverified}
          </Text>
        </View>
      ))}
      {receipts.length === 0 && (
        <Text style={styles.empty}>{t.receipts.empty}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  card: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  merchant: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  amount: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginTop: 4 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
});
