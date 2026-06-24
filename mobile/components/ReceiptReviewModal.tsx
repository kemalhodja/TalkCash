import { ChipPicker } from "@/components/ui/ChipPicker";
import { Modal, StyleSheet, Text, View } from "react-native";
import { AuthImage } from "@/components/AuthImage";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatDate } from "@/utils/format";
import { useEffect, useState } from "react";

export type ReceiptScanData = {
  receipt_id?: string | null;
  total_amount?: number | null;
  merchant?: string;
  date?: string | null;
  due_date?: string | null;
  verified?: boolean;
  image_url?: string;
  queued?: boolean;
  queue_id?: string;
  suggested_category?: string | null;
  category?: string;
};

import { EXPENSE_CATEGORIES } from "@/constants/expenseCategories";

type Props = {
  visible: boolean;
  data: ReceiptScanData | null;
  onClose: () => void;
  onSaveExpense: (data: ReceiptScanData) => void;
  onAddToShopping: (data: ReceiptScanData) => void;
  onAddBillReminder?: (data: ReceiptScanData) => void;
};
export function ReceiptReviewModal({ visible, data, onClose, onSaveExpense, onAddToShopping, onAddBillReminder }: Props) {
  const { t, locale } = useI18n();
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Genel");

  useEffect(() => {
    if (!data) return;
    setMerchant(data.merchant || "");
    setAmount(data.total_amount != null ? String(data.total_amount) : "");
    setCategory(data.suggested_category || data.category || "Genel");
  }, [data]);

  if (!data) return null;

  const reviewed: ReceiptScanData = {
    ...data,
    merchant: merchant.trim() || data.merchant,
    total_amount: amount.trim() ? Number(amount.replace(",", ".")) : data.total_amount,
    category,
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Surface variant="glass" style={styles.card}>
          <Text style={styles.title}>{t.scanner.reviewTitle}</Text>
          {data.queued ? (
            <Text style={styles.queued}>{t.scanner.queuedOffline}</Text>
          ) : null}
          {data.image_url ? (
            <AuthImage path={data.image_url} style={styles.image} />
          ) : null}
          <InputField
            value={merchant}
            onChangeText={setMerchant}
            placeholder={t.scanner.merchant}
            editable={!data.queued}
          />
          <InputField
            value={amount}
            onChangeText={setAmount}
            placeholder={t.scanner.amount}
            keyboardType="decimal-pad"
            editable={!data.queued}
          />
          {!data.queued && data.due_date ? (
            <Text style={styles.dueDate}>
              {t.scanner.dueDateLabel.replace("{date}", formatDate(data.due_date, locale))}
            </Text>
          ) : null}
          {!data.queued ? (
            <>
              <Text style={styles.categoryLabel}>{t.scanner.category}</Text>
              {data.suggested_category ? (
                <Text style={styles.suggested}>
                  {t.scanner.suggestedCategory.replace("{category}", data.suggested_category)}
                </Text>
              ) : null}
              <ChipPicker
                options={EXPENSE_CATEGORIES.map((id) => ({ id, label: id }))}
                value={category}
                onChange={setCategory}
              />
            </>
          ) : null}
          <View style={styles.actions}>
            <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" compact />
            {!data.queued ? (
              <>
                {data.due_date && onAddBillReminder ? (
                  <PrimaryButton
                    label={t.scanner.createBillReminder}
                    onPress={() => onAddBillReminder(reviewed)}
                    variant="secondary"
                    compact
                  />
                ) : null}
                <PrimaryButton
                  label={t.scanner.addToList}
                  onPress={() => onAddToShopping(reviewed)}
                  variant="secondary"
                  compact
                />
                <PrimaryButton
                  label={t.input.send}
                  onPress={() => onSaveExpense(reviewed)}
                  compact
                />
              </>
            ) : (
              <PrimaryButton label={t.common.confirm} onPress={onClose} compact />
            )}
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: "center", padding: Spacing.lg },
  card: { padding: Spacing.lg, maxHeight: "90%" },
  title: { color: Colors.text, fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  queued: { color: Colors.warning, fontSize: 13, marginBottom: Spacing.sm },
  categoryLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: Spacing.sm, marginBottom: Spacing.xs },
  suggested: { color: Colors.accent, fontSize: 12, marginBottom: Spacing.sm },
  dueDate: { color: Colors.warning, fontSize: 13, fontWeight: "600", marginBottom: Spacing.sm },
  image: { width: "100%", height: 140, borderRadius: Radius.sm, marginBottom: Spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: Spacing.sm, marginTop: Spacing.md },
});
