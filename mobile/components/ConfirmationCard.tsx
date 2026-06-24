import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { DialogModal } from "@/components/ui/DialogModal";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/constants/expenseCategories";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { parsePositiveAmount } from "@/utils/amount";

export type ParsedConfirmation = {
  intent?: string;
  amount?: number;
  category?: string;
  description?: string;
  raw_text?: string;
  [key: string]: unknown;
};

interface Props {
  visible: boolean;
  message: string;
  parsed?: ParsedConfirmation | null;
  onConfirm: (parsed: ParsedConfirmation | null) => void;
  onCancel: () => void;
}

const EDITABLE_INTENTS = new Set(["add_expense", "add_income", "add_bill", "manual_edit"]);

function categoriesForIntent(intent?: string): string[] {
  if (intent === "add_income") return INCOME_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function ConfirmationCard({ visible, message, parsed, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Genel");
  const [description, setDescription] = useState("");
  const [storeName, setStoreName] = useState("");
  const [fieldError, setFieldError] = useState("");

  const editable = parsed?.intent ? EDITABLE_INTENTS.has(parsed.intent) : false;
  const showStore = parsed?.intent === "add_expense" || parsed?.intent === "manual_edit";

  useEffect(() => {
    if (!visible || !parsed) return;
    setAmount(parsed.amount != null ? String(parsed.amount) : "");
    setCategory(parsed.category || (parsed.intent === "add_income" ? "Maaş" : "Genel"));
    setDescription(parsed.description || parsed.raw_text || "");
    setStoreName(String(parsed.store_name || parsed.place || ""));
    setFieldError("");
  }, [visible, parsed]);

  const handleConfirm = () => {
    if (!editable || !parsed) {
      onConfirm(parsed ?? null);
      return;
    }
    const nextAmount = parsePositiveAmount(amount);
    if (!nextAmount) {
      setFieldError(t.input.confirmInvalidAmount);
      return;
    }
    if (showStore && !storeName.trim()) {
      setFieldError(t.input.confirmStoreRequired);
      return;
    }
    onConfirm({
      ...parsed,
      intent: parsed.intent === "manual_edit" ? "add_expense" : parsed.intent,
      amount: nextAmount,
      category: category.trim() || parsed.category,
      description: description.trim() || parsed.description,
      store_name: storeName.trim() || parsed.store_name,
      place: storeName.trim() || parsed.place,
    });
  };

  return (
    <DialogModal
      visible={visible}
      title={t.input.confirmTitle}
      footer={
        <View style={styles.actions}>
          <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          <PrimaryButton label={t.common.confirm} onPress={handleConfirm} style={styles.btn} />
        </View>
      }
    >
      <Text style={styles.hint}>{message}</Text>
      {editable ? (
        <View style={styles.fields}>
          <Text style={styles.fieldLabel}>{t.input.confirmAmount}</Text>
          <InputField
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder={t.input.confirmAmount}
            testID="confirm-amount"
          />
          <Text style={styles.fieldLabel}>{t.input.confirmCategory}</Text>
          <ChipPicker
            options={categoriesForIntent(parsed?.intent).map((c) => ({ id: c, label: c }))}
            value={category}
            onChange={setCategory}
          />
          <Text style={styles.fieldLabel}>{t.input.confirmDescription}</Text>
          <InputField
            value={description}
            onChangeText={setDescription}
            placeholder={t.input.confirmDescription}
            testID="confirm-description"
          />
          {showStore ? (
            <>
              <Text style={styles.fieldLabel}>{t.input.confirmStore}</Text>
              <InputField
                value={storeName}
                onChangeText={setStoreName}
                placeholder={t.input.confirmStorePlaceholder}
                testID="confirm-store"
              />
            </>
          ) : null}
          <Text style={styles.editHint}>{t.input.confirmEditHint}</Text>
          {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}
        </View>
      ) : (
        <Text style={styles.message}>{message}</Text>
      )}
    </DialogModal>
  );
}

const styles = StyleSheet.create({
  hint: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: Spacing.md, textAlign: "center" },
  message: { color: Colors.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: Spacing.lg, textAlign: "center" },
  fields: { gap: Spacing.xs, marginBottom: Spacing.sm },
  fieldLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginTop: Spacing.xs },
  editHint: { color: Colors.accent, fontSize: 12, textAlign: "center", marginTop: Spacing.sm },
  error: { color: Colors.danger, fontSize: 13, textAlign: "center", marginTop: Spacing.xs },
  actions: { flexDirection: "row", gap: Spacing.sm, width: "100%" },
  btn: { flex: 1 },
});
