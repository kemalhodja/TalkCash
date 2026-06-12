import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { formatMoney } from "@/utils/format";
import { SharedWalletWS } from "@/services/websocket";

export default function SocialScreen() {
  const { t, locale } = useI18n();
  const [total, setTotal] = useState("");
  const [personCount, setPersonCount] = useState("3");
  const [splitResult, setSplitResult] = useState<any>(null);
  const [sharedWallets, setSharedWallets] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [walletName, setWalletName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [expenseWalletId, setExpenseWalletId] = useState<string | null>(null);
  const [contributionWalletId, setContributionWalletId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [memberSummaries, setMemberSummaries] = useState<Record<string, any>>({});
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const wsMap = useRef<Map<string, SharedWalletWS>>(new Map());

  const load = async () => {
    try {
      const [wallets, debtList] = await Promise.all([api.getSharedWallets(), api.getDebts()]);
      setSharedWallets(wallets);
      setDebts(debtList);

      wsMap.current.forEach((ws) => ws.disconnect());
      wsMap.current.clear();

      for (const w of wallets) {
        const ws = new SharedWalletWS(w.id, (data) => {
          if (data.type === "expense" || data.type === "expense_confirmed") {
            setSharedWallets((prev) =>
              prev.map((sw) => sw.id === w.id ? { ...sw, balance: data.balance } : sw),
            );
          }
        });
        wsMap.current.set(w.id, ws);
        ws.connect();
      }
    } catch {
      setSharedWallets([]);
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => { wsMap.current.forEach((ws) => ws.disconnect()); };
  }, []);
  useRefreshOnFocus(load);

  const handleSplit = async () => {
    if (!total) return;
    const result = await api.splitBill(parseFloat(total), parseInt(personCount) || 2);
    setSplitResult(result);
  };

  const handleSharedExpense = async (walletId: string) => {
    if (!expenseAmount) return;
    const user = await auth.getUser();
    const amount = parseFloat(expenseAmount);
    const desc = expenseDesc;
    const ws = wsMap.current.get(walletId);
    if (ws) {
      ws.sendExpense(amount, desc, user?.fullName || t.common.user);
    } else {
      await api.addSharedWalletExpense(walletId, amount, desc);
    }
    Alert.alert(t.social.expenseAdded);
    setExpenseAmount("");
    setExpenseDesc("");
    setExpenseWalletId(null);
    load();
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
            <Text style={styles.resultText}>{t.social.perPerson}: {formatMoney(splitResult.per_person, locale)}</Text>
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
            <Text style={styles.debtText}>{d.is_lent ? t.social.lent : t.social.borrowed}: {d.person} — {formatMoney(d.amount, locale)}</Text>
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
            <View style={styles.walletRow}>
              <Text style={styles.walletName}>{w.name}</Text>
              <Text style={styles.walletBalance}>{formatMoney(w.balance ?? 0, locale)}</Text>
            </View>
            <TouchableOpacity onPress={() => setExpenseWalletId(expenseWalletId === w.id ? null : w.id)}>
              <Text style={styles.expenseLink}>{t.social.addExpense}</Text>
            </TouchableOpacity>
            {expenseWalletId === w.id && (
              <View style={styles.expenseForm}>
                <TextInput style={styles.input} placeholder={t.social.expenseAmount} placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad" value={expenseAmount} onChangeText={setExpenseAmount} />
                <TextInput style={styles.input} placeholder={t.social.expenseDesc} placeholderTextColor={Colors.textMuted}
                  value={expenseDesc} onChangeText={setExpenseDesc} />
                <TouchableOpacity style={styles.btn} onPress={() => handleSharedExpense(w.id)}>
                  <Text style={styles.btnText}>{t.social.expenseSubmit}</Text>
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={async () => {
              if (expandedWallet === w.id) { setExpandedWallet(null); return; }
              const summary = await api.getSharedWalletMembers(w.id);
              setMemberSummaries((prev) => ({ ...prev, [w.id]: summary }));
              setExpandedWallet(w.id);
            }}>
              <Text style={styles.expenseLink}>{t.social.memberSpent}</Text>
            </TouchableOpacity>
            {expandedWallet === w.id && memberSummaries[w.id]?.members?.map((m: any) => (
              <Text key={m.user_id} style={styles.memberRow}>
                {m.name}: {t.social.memberSpent} {formatMoney(m.spent, locale)} · {t.social.memberContributed} {formatMoney(m.contributed, locale)} · {t.social.memberNet} {formatMoney(m.net, locale)}
              </Text>
            ))}
            <TouchableOpacity onPress={() => setContributionWalletId(contributionWalletId === w.id ? null : w.id)}>
              <Text style={styles.expenseLink}>{t.social.contribute}</Text>
            </TouchableOpacity>
            {contributionWalletId === w.id && (
              <View style={styles.expenseForm}>
                <TextInput style={styles.input} placeholder={t.social.expenseAmount} placeholderTextColor={Colors.textMuted}
                  keyboardType="decimal-pad" value={contributionAmount} onChangeText={setContributionAmount} />
                <TouchableOpacity style={styles.btn} onPress={async () => {
                  if (!contributionAmount) return;
                  await api.addSharedWalletContribution(w.id, parseFloat(contributionAmount));
                  Alert.alert(t.social.expenseAdded);
                  setContributionAmount("");
                  setContributionWalletId(null);
                  load();
                }}>
                  <Text style={styles.btnText}>{t.social.contribute}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <TextInput style={styles.input} placeholder={t.social.walletName} placeholderTextColor={Colors.textMuted}
          value={walletName} onChangeText={setWalletName} />
        <TextInput style={styles.input} placeholder={t.agenda.memberEmail} placeholderTextColor={Colors.textMuted}
          keyboardType="email-address" autoCapitalize="none" value={memberEmail} onChangeText={setMemberEmail} />
        <TouchableOpacity style={styles.btn} onPress={async () => {
          await api.createSharedWallet(walletName, memberEmail || undefined);
          setWalletName(""); setMemberEmail(""); load();
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
  walletCard: { backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  walletRow: { flexDirection: "row", justifyContent: "space-between" },
  walletName: { color: Colors.text },
  walletBalance: { color: Colors.accent, fontWeight: "700" },
  expenseLink: { color: Colors.accent, marginTop: Spacing.sm, fontWeight: "600" },
  expenseForm: { marginTop: Spacing.sm },
  emptyHint: { color: Colors.textMuted, marginBottom: Spacing.sm },
  memberRow: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
});
