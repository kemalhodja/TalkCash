import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatDate, formatMoney } from "@/utils/format";
import { getSubscriptionCancelUrl, type UpcomingSubscription } from "@/utils/subscriptions";

type Props = {
  items: UpcomingSubscription[];
};

export function UpcomingSubscriptionsCard({ items }: Props) {
  const { t, locale } = useI18n();
  if (!items.length) return null;

  return (
    <Surface variant="elevated" style={styles.card}>
      <Text style={styles.title}>{t.subscription.upcomingTitle}</Text>
      {items.map((item) => {
        const cancelUrl = item.cancel_url || getSubscriptionCancelUrl(item.subscription_name);
        return (
          <View key={`${item.subscription_name}-${item.next_billing_date}`} style={styles.row}>
            <View style={styles.meta}>
              <Text style={styles.name}>{item.subscription_name}</Text>
              <Text style={styles.date}>
                {t.subscription.renewsOn.replace("{date}", formatDate(item.next_billing_date, locale))}
              </Text>
              <Text style={styles.amount}>{formatMoney(item.amount, locale)}</Text>
            </View>
            {cancelUrl ? (
              <TouchableOpacity onPress={() => Linking.openURL(cancelUrl)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t.subscription.manageCancel}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  title: { color: Colors.text, fontWeight: "700", fontSize: 16, marginBottom: Spacing.xs },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.sm, paddingVertical: Spacing.xs },
  meta: { flex: 1 },
  name: { color: Colors.text, fontWeight: "600" },
  date: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  amount: { color: Colors.accent, fontSize: 13, marginTop: 2, fontWeight: "600" },
  cancelBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 6, borderRadius: 8, backgroundColor: Colors.cardElevated },
  cancelText: { color: Colors.accent, fontSize: 12, fontWeight: "600" },
});
