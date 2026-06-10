import { useEffect, useState } from "react";
import { Linking, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import { SharedWalletWS } from "@/services/websocket";

export default function SocialScreen() {
  const [total, setTotal] = useState("");
  const [personCount, setPersonCount] = useState("3");
  const [splitResult, setSplitResult] = useState<any>(null);
  const [sharedWallets, setSharedWallets] = useState<any[]>([]);
  const [debtPerson, setDebtPerson] = useState("");
  const [debtAmount, setDebtAmount] = useState("");

  useEffect(() => {
    loadSharedWallets();
  }, []);

  const loadSharedWallets = async () => {
    try {
      const wallets = await api.getSharedWallets();
      setSharedWallets(wallets);
      if (wallets.length) {
        const ws = new SharedWalletWS(wallets[0].id, (msg) => {
          if (msg.type === "expense") loadSharedWallets();
        });
        ws.connect();
      }
    } catch { /* demo */ }
  };

  const handleSplit = async () => {
    if (!total) return;
    try {
      const result = await api.splitBill(parseFloat(total), parseInt(personCount) || 2);
      setSplitResult(result);
    } catch {
      const perPerson = (parseFloat(total) / (parseInt(personCount) || 2)).toFixed(2);
      setSplitResult({
        per_person: perPerson,
        share_message: `Hesap toplamı ${total} TL, ${personCount} kişi arasında bölündü.\nKişi başı: ${perPerson} TL`,
      });
    }
  };

  const shareWhatsApp = () => {
    if (!splitResult) return;
    const url = `whatsapp://send?text=${encodeURIComponent(splitResult.share_message)}`;
    Linking.openURL(url).catch(() => {
      Share.share({ message: splitResult.share_message });
    });
  };

  const handleAddDebt = async () => {
    if (!debtPerson || !debtAmount) return;
    try {
      await api.addDebt(debtPerson, parseFloat(debtAmount));
      setDebtPerson("");
      setDebtAmount("");
    } catch { /* demo */ }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Sosyal</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Hesap Bölüştür</Text>
        <TextInput style={styles.input} placeholder="Toplam tutar (TL)" placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad" value={total} onChangeText={setTotal} />
        <TextInput style={styles.input} placeholder="Kişi sayısı" placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad" value={personCount} onChangeText={setPersonCount} />
        <TouchableOpacity style={styles.btn} onPress={handleSplit}>
          <Text style={styles.btnText}>Böl</Text>
        </TouchableOpacity>
        {splitResult && (
          <View style={styles.result}>
            <Text style={styles.resultText}>Kişi başı: {splitResult.per_person} TL</Text>
            <TouchableOpacity style={styles.whatsappBtn} onPress={shareWhatsApp}>
              <Text style={styles.whatsappText}>WhatsApp ile Paylaş</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Borç/Alacak Defteri</Text>
        <TextInput style={styles.input} placeholder="Kişi adı" placeholderTextColor={Colors.textMuted}
          value={debtPerson} onChangeText={setDebtPerson} />
        <TextInput style={styles.input} placeholder="Tutar (TL)" placeholderTextColor={Colors.textMuted}
          keyboardType="decimal-pad" value={debtAmount} onChangeText={setDebtAmount} />
        <TouchableOpacity style={styles.btn} onPress={handleAddDebt}>
          <Text style={styles.btnText}>Borç Kaydet</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ortak Kasalar</Text>
        {sharedWallets.map((w) => (
          <View key={w.id} style={styles.walletCard}>
            <Text style={styles.walletName}>{w.name}</Text>
            <Text style={styles.walletBalance}>{w.balance?.toLocaleString("tr-TR")} ₺</Text>
          </View>
        ))}
        {sharedWallets.length === 0 && (
          <Text style={styles.empty}>Henüz ortak kasa yok</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    color: Colors.text, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border,
  },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, alignItems: "center" },
  btnText: { color: Colors.bg, fontWeight: "700" },
  result: { marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.card, borderRadius: 10 },
  resultText: { color: Colors.accent, fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  whatsappBtn: { backgroundColor: "#25D366", padding: Spacing.sm, borderRadius: 8, alignItems: "center" },
  whatsappText: { color: "#fff", fontWeight: "600" },
  walletCard: {
    backgroundColor: Colors.card, borderRadius: 10, padding: Spacing.md,
    flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  walletName: { color: Colors.text },
  walletBalance: { color: Colors.accent, fontWeight: "700" },
  empty: { color: Colors.textMuted },
});
