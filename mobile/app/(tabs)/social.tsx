import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { SharedWalletWS } from "@/services/websocket";

export default function SocialScreen() {
  const { t } = useI18n();
  const [total, setTotal] = useState("");
  const [personCount, setPersonCount] = useState("3");
  const [splitResult, setSplitResult] = useState<any>(null);
  const [sharedWallets, setSharedWallets] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [walletName, setWalletName] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [wallets, debtList] = await Promise.all([api.getSharedWallets(), api.getDebts()]);
      setSharedWallets(wallets);
      setDebts(debtList);
      if (wallets.length) {
        const ws = new SharedWalletWS(wallets[0].id, () => load());
        ws.connect();
      }
    } catch {
      setSharedWallets([]);
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);
  useRefreshOnFocus(load);

  const handleSplit = async () => {
    if (!total) return;
    const result = await api.splitBill(parseFloat(total), parseInt(personCount) || 2);
    setSplitResult(result);
  };

  const shareWhatsApp = () => {
    if (!splitResult) return;
    const url = splitResult.whatsapp_url || `whatsapp://send?text=${encodeURIComponent(splitResult.share_message)}`;
    Linking.openURL(url).catch(() => Share.share({ message: splitResult.share_message }));
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.accent} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{t.social.title}</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.social.split}</Text>
        <TextInput style={styles.input} placeholder={t.social.splitTotal} placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad" value={total} onChangeText={setTotal} />
        <TextInput style={styles.input} placeholder={t.social.personCount} placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad" value={personCount} onChangeText={setPersonCount} />
        <TouchableOpacity style={styles.btn} onPress={handleSplit}><Text style={styles.btnText}>{t.social.splitBtn}</Text></TouchableOpacity>
        {splitResult && (
          <View style={styles.result}>
            <Text style={styles.resultText}>{t.social.perPerson}: {splitResult.per_person} TL</Text>
            <TouchableOpacity style={styles.whatsappBtn} onPress={shareWhatsApp}>
              <Text style={styles.whatsappText}>{t.social.whatsapp}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.social.debtBook}</Text>
        {debts.map((d) => (
          <View key={d.id} style={styles.debtCard}>
            <Text style={styles.debtText}>{d.is_lent ? t.social.lent : t.social.borrowed}: {d.person} — {d.amount} ₺</Text>
            <TouchableOpacity onPress={async () => { await api.settleDebt(d.id); load(); }}>
              <Text style={styles.settle}>{t.social.settle}</Text>
            </TouchableOpacity>
          </View>
        ))}
        <TextInput style={styles.input} placeholder={t.social.personName} placeholderTextColor={Colors.textMuted}
          value={debtPerson} onChangeText={setDebtPerson} />
        <TextInput style={styles.input} placeholder={t.social.amount} placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad" value={debtAmount} onChangeText={setDebtAmount} />
        <TouchableOpacity style={styles.btn} onPress={async () => {
          await api.addDebt(debtPerson, parseFloat(debtAmount));
          setDebtPerson(""); setDebtAmount(""); load();
        }}><Text style={styles.btnText}>{t.social.saveDebt}</Text></TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t.social.sharedWallets}</Text>
        {sharedWallets.length === 0 && (
          <Text style={styles.emptyHint}>{t.social.noSharedWallets}</Text>
        )}
        {sharedWallets.map((w) => (
          <View key={w.id} style={styles.walletCard}>
            <Text style={styles.walletName}>{w.name}</Text>
            <Text style={styles.walletBalance}>{w.balance?.toLocaleString("tr-TR")} ₺</Text>
          </View>
        ))}
        <TextInput style={styles.input} placeholder={t.social.walletName} placeholderTextColor={Colors.textMuted}
          value={walletName} onChangeText={setWalletName} />
        <TouchableOpacity style={styles.btn} onPress={async () => {
          await api.createSharedWallet(walletName);
          setWalletName(""); load();
        }}><Text style={styles.btnText}>{t.social.createWallet}</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.bg },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  input: { backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  btnText: { color: Colors.bg, fontWeight: "700" },
  result: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.card, borderRadius: 10 },
  resultText: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  whatsappBtn: { backgroundColor: "#25D366", padding: Spacing.sm, borderRadius: 8, alignItems: "center" },
  whatsappText: { color: "#fff", fontWeight: "600" },
  debtCard: { flexDirection: "row", justifyContent: "space-between", padding: Spacing.sm, marginBottom: 4 },
  debtText: { color: Colors.text },
  settle: { color: Colors.success },
  walletCard: { flexDirection: "row", justifyContent: "space-between", backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  walletName: { color: Colors.text },
  walletBalance: { color: Colors.accent, fontWeight: "700" },
  emptyHint: { color: Colors.textMuted, marginBottom: Spacing.sm },
});
