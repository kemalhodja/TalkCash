import { useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

type Broker = {
  id: string;
  name: string;
  description: string;
  web_url: string;
  open_url?: string;
  android_package?: string;
  ios_scheme?: string;
};

export function BrokerLinksCard() {
  const { t } = useI18n();
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [preferredId, setPreferredId] = useState<string | null>(null);

  useEffect(() => {
    api.getMicroSavingsBrokers()
      .then((res) => {
        setBrokers(res.brokers || []);
        setPreferredId(res.preferred?.id || null);
      })
      .catch(() => setBrokers([]));
  }, []);

  const openBroker = async (broker: Broker) => {
    try {
      if (Platform.OS === "android" && broker.android_package) {
        const intent = `intent://#Intent;package=${broker.android_package};scheme=https;end`;
        const can = await Linking.canOpenURL(intent);
        if (can) {
          await Linking.openURL(intent);
          return;
        }
      }
      if (Platform.OS === "ios" && broker.ios_scheme) {
        const can = await Linking.canOpenURL(broker.ios_scheme);
        if (can) {
          await Linking.openURL(broker.ios_scheme);
          return;
        }
      }
      await Linking.openURL(broker.open_url || broker.web_url);
    } catch {
      Alert.alert(t.common.error, broker.web_url);
    }
  };

  if (!brokers.length) return null;

  return (
    <Surface variant="default" style={styles.card}>
      <Text style={styles.title}>{t.microSavings.brokersTitle}</Text>
      <Text style={styles.disclaimer}>{t.microSavings.brokerDisclaimer}</Text>
      {brokers.map((broker) => (
        <View key={broker.id} style={styles.row}>
          <View style={styles.meta}>
            <Text style={styles.name}>
              {broker.name}
              {preferredId === broker.id ? ` · ${t.microSavings.preferredBroker}` : ""}
            </Text>
            <Text style={styles.desc}>{broker.description}</Text>
          </View>
          <PrimaryButton
            label={t.microSavings.openBroker}
            onPress={() => openBroker(broker)}
            compact
            variant="ghost"
          />
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.text, fontWeight: "800", fontSize: 16, marginBottom: Spacing.xs },
  disclaimer: { color: Colors.textMuted, fontSize: 11, marginBottom: Spacing.sm, fontStyle: "italic" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  meta: { flex: 1 },
  name: { color: Colors.text, fontWeight: "600" },
  desc: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
});
