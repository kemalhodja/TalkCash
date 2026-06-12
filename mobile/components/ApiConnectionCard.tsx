import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { checkApiHealth, getApiBaseUrl, getHealthUrl, isMobileDevice, usesLocalhostApi } from "@/services/config";

type Props = {
  compact?: boolean;
};

export function ApiConnectionCard({ compact }: Props) {
  const { t } = useI18n();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const apiUrl = getApiBaseUrl();
  const healthUrl = getHealthUrl();
  const localhostWarning = isMobileDevice() && usesLocalhostApi();

  const runTest = async () => {
    setTesting(true);
    const health = await checkApiHealth();
    setResult({
      ok: health.ok,
      detail: health.ok ? health.status : health.error,
    });
    setTesting(false);
  };

  useEffect(() => {
    runTest();
  }, []);

  if (compact && !localhostWarning && result?.ok) {
    return null;
  }

  return (
    <View style={[styles.card, localhostWarning && styles.cardWarn, result && !result.ok && styles.cardWarn]}>
      <Text style={styles.title}>{t.settings.serverConnection}</Text>
      <Text style={styles.url} numberOfLines={2}>{apiUrl}</Text>
      {localhostWarning ? (
        <Text style={styles.warn}>{t.settings.localhostWarning}</Text>
      ) : null}
      {result ? (
        <>
          <Text style={[styles.status, result.ok ? styles.ok : styles.fail]}>
            {result.ok ? t.settings.connectionOk.replace("{status}", result.detail) : t.settings.connectionFailed.replace("{error}", result.detail)}
          </Text>
          {!result.ok && !localhostWarning ? (
            <Text style={styles.hint}>{t.settings.connectionFixHint}</Text>
          ) : null}
        </>
      ) : null}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={async () => {
            await Clipboard.setStringAsync(healthUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          <Text style={styles.actionText}>{copied ? t.settings.urlCopied : t.settings.copyHealthUrl}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => Linking.openURL(healthUrl)}>
          <Text style={styles.actionText}>{t.settings.openHealth}</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.btn} onPress={runTest} disabled={testing}>
        {testing ? <ActivityIndicator color={Colors.accent} /> : <Text style={styles.btnText}>{t.settings.testConnection}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardWarn: { borderColor: Colors.warning },
  title: { color: Colors.text, fontWeight: "600", marginBottom: Spacing.sm },
  url: { color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.sm },
  warn: { color: Colors.warning, fontSize: 13, marginBottom: Spacing.sm },
  status: { fontSize: 13, marginBottom: Spacing.sm },
  ok: { color: Colors.accent },
  fail: { color: Colors.danger },
  hint: { color: Colors.textMuted, fontSize: 12, marginBottom: Spacing.sm, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  actionBtn: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  actionText: { color: Colors.accent, fontSize: 12, fontWeight: "600" },
  btn: { alignItems: "center", paddingVertical: Spacing.sm },
  btnText: { color: Colors.accent, fontWeight: "600" },
});
