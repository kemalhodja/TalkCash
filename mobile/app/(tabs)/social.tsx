import { ReactNode, useEffect, useRef, useState } from "react";
import { Alert, Linking, Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { InputField } from "@/components/ui/InputField";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Surface } from "@/components/ui/Surface";
import { TextLink } from "@/components/ui/TextLink";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { formatMoney } from "@/utils/format";
import { SharedWalletWS } from "@/services/websocket";

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Surface variant="elevated" style={styles.sectionCard}>{children}</Surface>
    </View>
  );
}

export default function SocialScreen() {
  const { t, locale } = useI18n();
  const [total, setTotal] = useState("");
  const [personCount, setPersonCount] = useState("3");
  const [splitResult, setSplitResult] = useState<any>(null);
  const [sharedWallets, setSharedWallets] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");
  const [debtIsLent, setDebtIsLent] = useState(true);
  const [walletName, setWalletName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [expenseWalletId, setExpenseWalletId] = useState<string | null>(null);
  const [contributionWalletId, setContributionWalletId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [memberSummaries, setMemberSummaries] = useState<Record<string, any>>({});
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [adminWalletId, setAdminWalletId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
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

  if (loading) return <LoadingScreen />;

  return (
    <ScreenShell>
      <ScreenHeader title={t.social.title} />

      <SectionBlock title={t.social.split}>
        <InputField placeholder={t.social.splitTotal} keyboardType="decimal-pad" value={total} onChangeText={setTotal} />
        <InputField placeholder={t.social.personCount} keyboardType="number-pad" value={personCount} onChangeText={setPersonCount} />
        <PrimaryButton label={t.social.splitBtn} onPress={handleSplit} />
        {splitResult && (
          <View style={styles.result}>
            <Text style={styles.resultText}>{t.social.perPerson}: {formatMoney(splitResult.per_person, locale)}</Text>
            <TouchableOpacity style={styles.whatsappBtn} onPress={shareWhatsApp}>
              <Text style={styles.whatsappText}>{t.social.whatsapp}</Text>
            </TouchableOpacity>
          </View>
        )}
      </SectionBlock>

      <SectionBlock title={t.social.debtBook}>
        {debts.map((d) => (
          <View key={d.id} style={styles.debtCard}>
            <Text style={styles.debtText}>{d.is_lent ? t.social.lent : t.social.borrowed}: {d.person} — {formatMoney(d.amount, locale)}</Text>
            <View style={styles.debtActions}>
              <TextLink label={t.social.settle} onPress={async () => { await api.settleDebt(d.id); load(); }} />
              <TextLink label={t.social.deleteDebt} onPress={() => {
                Alert.alert(t.common.delete, t.transactions.deleteConfirm, [
                  { text: t.common.cancel, style: "cancel" },
                  { text: t.common.delete, style: "destructive", onPress: async () => { await api.deleteDebt(d.id); load(); } },
                ]);
              }} danger />
            </View>
          </View>
        ))}
        <InputField placeholder={t.social.personName} value={debtPerson} onChangeText={setDebtPerson} />
        <InputField placeholder={t.social.amount} keyboardType="decimal-pad" value={debtAmount} onChangeText={setDebtAmount} />
        <SegmentedControl
          options={[
            { key: "lent", label: t.social.lent },
            { key: "borrowed", label: t.social.borrowed },
          ]}
          value={debtIsLent ? "lent" : "borrowed"}
          onChange={(k) => setDebtIsLent(k === "lent")}
        />
        <PrimaryButton label={t.social.saveDebt} onPress={async () => {
          await api.addDebt(debtPerson, parseFloat(debtAmount), debtIsLent);
          setDebtPerson(""); setDebtAmount(""); load();
        }} />
      </SectionBlock>

      <SectionBlock title={t.social.sharedWallets}>
        {sharedWallets.length === 0 && (
          <EmptyState message={t.social.noSharedWallets} icon="👥" />
        )}
        {sharedWallets.map((w) => (
          <Surface key={w.id} variant="glass" style={styles.walletCard}>
            <View style={styles.walletRow}>
              <Text style={styles.walletName}>{w.name}</Text>
              <Text style={styles.walletBalance}>{formatMoney(w.balance ?? 0, locale)}</Text>
            </View>
            <TextLink label={t.social.addExpense} onPress={() => setExpenseWalletId(expenseWalletId === w.id ? null : w.id)} />
            {expenseWalletId === w.id && (
              <View style={styles.expenseForm}>
                <InputField placeholder={t.social.expenseAmount} keyboardType="decimal-pad" value={expenseAmount} onChangeText={setExpenseAmount} />
                <InputField placeholder={t.social.expenseDesc} value={expenseDesc} onChangeText={setExpenseDesc} />
                <PrimaryButton label={t.social.expenseSubmit} onPress={() => handleSharedExpense(w.id)} compact />
              </View>
            )}
            <TextLink label={t.social.memberSpent} onPress={async () => {
              if (expandedWallet === w.id) { setExpandedWallet(null); return; }
              const summary = await api.getSharedWalletMembers(w.id);
              setMemberSummaries((prev) => ({ ...prev, [w.id]: summary }));
              setExpandedWallet(w.id);
            }} />
            {expandedWallet === w.id && memberSummaries[w.id]?.members?.map((m: any) => (
              <View key={m.user_id} style={styles.memberRow}>
                <Text style={styles.memberText}>
                  {m.name}: {t.social.memberSpent} {formatMoney(m.spent, locale)} · {t.social.memberContributed} {formatMoney(m.contributed, locale)} · {t.social.memberNet} {formatMoney(m.net, locale)}
                </Text>
                {w.is_owner && m.user_id !== w.owner_id && adminWalletId === w.id && (
                  <TextLink label={t.social.removeMember} danger onPress={() => {
                    Alert.alert(t.social.removeMember, t.social.removeMemberConfirm.replace("{name}", m.name), [
                      { text: t.common.cancel, style: "cancel" },
                      { text: t.social.removeMember, style: "destructive", onPress: async () => {
                        await api.removeSharedWalletMember(w.id, m.user_id);
                        const summary = await api.getSharedWalletMembers(w.id);
                        setMemberSummaries((prev) => ({ ...prev, [w.id]: summary }));
                        load();
                      }},
                    ]);
                  }} />
                )}
              </View>
            ))}
            <TextLink label={t.social.contribute} onPress={() => setContributionWalletId(contributionWalletId === w.id ? null : w.id)} />
            {contributionWalletId === w.id && (
              <View style={styles.expenseForm}>
                <InputField placeholder={t.social.expenseAmount} keyboardType="decimal-pad" value={contributionAmount} onChangeText={setContributionAmount} />
                <PrimaryButton label={t.social.contribute} onPress={async () => {
                  if (!contributionAmount) return;
                  await api.addSharedWalletContribution(w.id, parseFloat(contributionAmount));
                  Alert.alert(t.social.expenseAdded);
                  setContributionAmount("");
                  setContributionWalletId(null);
                  load();
                }} compact />
              </View>
            )}
            {w.is_owner && (
              <>
                <TextLink label={t.social.adminTitle} onPress={() => {
                  setAdminWalletId(adminWalletId === w.id ? null : w.id);
                  setRenameName(w.name);
                  setInviteEmail("");
                }} />
                {adminWalletId === w.id && (
                  <View style={styles.expenseForm}>
                    <InputField placeholder={t.social.renameWallet} value={renameName} onChangeText={setRenameName} />
                    <PrimaryButton label={t.social.renameWallet} onPress={async () => { await api.renameSharedWallet(w.id, renameName); load(); }} variant="secondary" compact />
                    <InputField placeholder={t.social.inviteEmail} keyboardType="email-address" autoCapitalize="none" value={inviteEmail} onChangeText={setInviteEmail} />
                    <PrimaryButton label={t.social.inviteMember} onPress={async () => {
                      if (!inviteEmail) return;
                      await api.addSharedWalletMember(w.id, inviteEmail);
                      Alert.alert(t.social.inviteMember);
                      setInviteEmail("");
                      load();
                    }} variant="secondary" compact />
                    <PrimaryButton label={t.social.deleteWallet} variant="danger" onPress={() => {
                      Alert.alert(t.common.delete, t.social.deleteWallet, [
                        { text: t.common.cancel, style: "cancel" },
                        { text: t.common.delete, style: "destructive", onPress: async () => {
                          await api.deleteSharedWallet(w.id);
                          setAdminWalletId(null);
                          load();
                        }},
                      ]);
                    }} compact />
                  </View>
                )}
              </>
            )}
          </Surface>
        ))}
        <InputField placeholder={t.social.walletName} value={walletName} onChangeText={setWalletName} />
        <InputField placeholder={t.agenda.memberEmail} keyboardType="email-address" autoCapitalize="none" value={memberEmail} onChangeText={setMemberEmail} />
        <PrimaryButton label={t.social.createWallet} onPress={async () => {
          await api.createSharedWallet(walletName, memberEmail || undefined);
          setWalletName(""); setMemberEmail(""); load();
        }} />
      </SectionBlock>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: Spacing.sm },
  sectionCard: { padding: Spacing.md },
  result: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  resultText: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  whatsappBtn: { backgroundColor: "#25D366", padding: Spacing.sm, borderRadius: Radius.sm, alignItems: "center" },
  whatsappText: { color: "#fff", fontWeight: "600" },
  debtCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  debtText: { color: Colors.text, flex: 1 },
  debtActions: { flexDirection: "row", gap: Spacing.sm },
  walletCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  walletRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xs },
  walletName: { color: Colors.text, fontWeight: "600" },
  walletBalance: { color: Colors.accent, fontWeight: "700" },
  expenseForm: { marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  memberRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 4, gap: Spacing.sm },
  memberText: { color: Colors.textMuted, fontSize: 12, flex: 1 },
});
