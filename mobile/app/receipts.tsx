import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { Stack } from "expo-router";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";
import { formatDate, formatMoney } from "@/utils/format";

export default function ReceiptsScreen() {
  const { t, locale } = useI18n();
  useRequireUnlock();
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

  if (loading) return <LoadingScreen />;

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen options={{ title: t.receipts.title, headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />
      {receipts.map((r) => (
        <Surface key={r.id} variant="elevated" style={styles.card}>
          {r.image_url ? (
            <AuthImage path={r.image_url} style={styles.image} />
          ) : null}
          <Text style={styles.merchant}>{r.merchant || "—"}</Text>
          <Text style={styles.amount}>
            {r.total_amount != null ? formatMoney(Number(r.total_amount), locale) : "—"}
          </Text>
          <Text style={styles.meta}>
            {r.date ? formatDate(r.date, locale) : "—"} ·{" "}
            {r.verified ? t.receipts.verified : t.receipts.unverified}
          </Text>
          <TextLink label={t.scanner.addToList} onPress={async () => {
            try {
              const res: any = await api.importReceiptToShopping(r.id);
              Alert.alert(t.common.confirm, t.scanner.itemsImported.replace("{count}", String(res.added)));
            } catch (e: any) {
              Alert.alert(t.common.error, e.message);
            }
          }} style={styles.importLink} />
        </Surface>
      ))}
      {receipts.length === 0 && (
        <EmptyState message={t.receipts.empty} icon="🧾" />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.sm, overflow: "hidden" },
  image: { width: "100%", height: 160, borderRadius: Radius.sm, marginBottom: Spacing.sm },
  merchant: { color: Colors.text, fontWeight: "600", fontSize: 16 },
  amount: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginTop: 4 },
  meta: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  importLink: { marginTop: Spacing.sm },
});
