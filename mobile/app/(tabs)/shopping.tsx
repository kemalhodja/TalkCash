import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { BuyToSpendModal } from "@/components/BuyToSpendModal";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import { auth } from "@/services/auth";

const CATEGORY_LABELS: Record<string, string> = {
  sarkuteri: "🥩 Şarküteri", manav: "🥬 Manav", sut_urunleri: "🥛 Süt Ürünleri",
  temizlik: "🧹 Temizlik", firin: "🍞 Fırın", icecek: "🥤 İçecek", diger: "📦 Diğer",
};

export default function ShoppingScreen() {
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [buyModal, setBuyModal] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => { loadList(); }, []);

  const loadList = async () => {
    const user = await auth.getUser();
    if (!user) return;
    try {
      setGrouped(await api.getShoppingList(user.userId));
    } catch {
      setGrouped({
        firin: [{ id: "1", name: "Ekmek", is_routine: true }],
        sut_urunleri: [{ id: "2", name: "Süt" }, { id: "3", name: "Yumurta" }],
      });
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Alışveriş Listesi</Text>
      <Text style={styles.subtitle}>Gece yarısı tamamlananlar temizlenir, rutinler kalır</Text>

      {Object.entries(grouped).map(([category, items]) => (
        <View key={category} style={styles.category}>
          <Text style={styles.categoryTitle}>{CATEGORY_LABELS[category] || category}</Text>
          {items.map((item) => (
            <TouchableOpacity key={item.id} style={styles.item}
              onPress={() => setBuyModal({ id: item.id, name: item.name })}>
              <View style={styles.checkbox} />
              <Text style={styles.itemName}>
                {item.name}{item.is_routine && <Text style={styles.routine}> 🔄</Text>}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}

      {Object.keys(grouped).length === 0 && (
        <Text style={styles.empty}>Liste boş. Sesle veya yazarak ürün ekleyin.</Text>
      )}

      {buyModal && (
        <BuyToSpendModal
          visible={!!buyModal}
          itemId={buyModal.id}
          itemName={buyModal.name}
          onComplete={() => { setBuyModal(null); loadList(); }}
          onCancel={() => setBuyModal(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700" },
  subtitle: { color: Colors.textMuted, fontSize: 13, marginBottom: Spacing.lg },
  category: { marginBottom: Spacing.lg },
  categoryTitle: { color: Colors.textSecondary, fontSize: 15, fontWeight: "600", marginBottom: Spacing.sm },
  item: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colors.card,
    borderRadius: 10, padding: Spacing.md, marginBottom: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: Colors.accent, marginRight: Spacing.md },
  itemName: { color: Colors.text, fontSize: 16 },
  routine: { fontSize: 12 },
  empty: { color: Colors.textMuted, textAlign: "center", marginTop: Spacing.xl },
});
