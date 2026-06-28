import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChipPicker } from "@/components/ui/ChipPicker";
import { DialogModal } from "@/components/ui/DialogModal";
import { InputField } from "@/components/ui/InputField";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SettingSwitchRow } from "@/components/ui/SettingSwitchRow";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/constants/expenseCategories";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { formatMoney } from "@/utils/format";
import { parsePositiveAmount } from "@/utils/amount";
import { hapticImpact, hapticSuccessDouble } from "@/utils/haptics";

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
  variant?: "default" | "instant";
  onConfirm: (parsed: ParsedConfirmation | null) => void;
  onCancel: () => void;
}

const EDITABLE_INTENTS = new Set(["add_expense", "add_income", "add_bill", "manual_edit"]);

function categoriesForIntent(intent?: string): string[] {
  if (intent === "add_income") return INCOME_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

export function ConfirmationCard({
  visible,
  message,
  parsed,
  variant = "default",
  onConfirm,
  onCancel,
}: Props) {
  const { t, locale } = useI18n();
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Genel");
  const [description, setDescription] = useState("");
  const [storeName, setStoreName] = useState("");
  const [shareToFamily, setShareToFamily] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [expanded, setExpanded] = useState(false);

  const editable = parsed?.intent ? EDITABLE_INTENTS.has(parsed.intent) : false;
  const showStore = parsed?.intent === "add_expense" || parsed?.intent === "manual_edit";
  const instant = variant === "instant" && editable && !expanded;

  useEffect(() => {
    if (!visible || !parsed) return;
    setAmount(parsed.amount != null ? String(parsed.amount) : "");
    setCategory(parsed.category || (parsed.intent === "add_income" ? "Maaş" : "Genel"));
    setDescription(parsed.description || parsed.raw_text || "");
    setStoreName(String(parsed.store_name || parsed.place || "Genel"));
    setShareToFamily(!!parsed.share_to_family);
    setFieldError("");
    setExpanded(false);
  }, [visible, parsed]);

  const buildPayload = (): ParsedConfirmation | null => {
    if (!editable || !parsed) return parsed ?? null;
    const nextAmount = parsePositiveAmount(amount);
    if (!nextAmount) {
      setFieldError(t.input.confirmInvalidAmount);
      hapticImpact("warning");
      return null;
    }
    if (!instant && showStore && !storeName.trim()) {
      setFieldError(t.input.confirmStoreRequired);
      hapticImpact("warning");
      return null;
    }
    hapticSuccessDouble();
    return {
      ...parsed,
      intent: parsed.intent === "manual_edit" ? "add_expense" : parsed.intent,
      amount: nextAmount,
      category: category.trim() || parsed.category,
      description: description.trim() || parsed.description,
      store_name: (storeName.trim() || parsed.store_name || "Genel") as string,
      place: (storeName.trim() || parsed.place || "Genel") as string,
      share_to_family: shareToFamily,
    };
  };

  const handleConfirm = () => {
    const payload = buildPayload();
    if (payload) onConfirm(payload);
  };

  const instantAmount = parsePositiveAmount(amount) || parsed?.amount;
  const instantCategory = category || parsed?.category || "Genel";
  const fxOriginal = parsed?.original_currency && parsed?.original_amount
    && String(parsed.original_currency).toUpperCase() !== String(parsed?.currency || "TRY").toUpperCase();
  const fxLabel = fxOriginal
    ? t.input.fxConverted
        .replace("{original}", formatMoney(Number(parsed!.original_amount), locale, String(parsed!.original_currency)))
        .replace("{converted}", formatMoney(Number(instantAmount || parsed?.amount || 0), locale, String(parsed?.currency || "TRY")))
    : null;

  return (
    <DialogModal
      visible={visible}
      title={instant ? undefined : t.input.confirmTitle}
      footer={
        instant ? (
          <View style={styles.instantActions}>
            <PrimaryButton
              label={t.input.instantConfirm}
              onPress={handleConfirm}
              style={styles.instantBtn}
              testID="instant-confirm"
            />
            <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
          </View>
        ) : (
          <View style={styles.actions}>
            <PrimaryButton label={t.common.cancel} onPress={onCancel} variant="ghost" style={styles.btn} />
            <PrimaryButton label={t.common.confirm} onPress={handleConfirm} style={styles.btn} />
          </View>
        )
      }
    >
      {instant ? (
        <View style={styles.instantBody}>
          {fxLabel ? <Text style={styles.fxBadge}>{fxLabel}</Text> : null}
          <Text style={styles.instantHeadline}>
            {formatMoney(Number(instantAmount || 0), locale, String(parsed?.currency || "TRY"))}
          </Text>
          <Text style={styles.instantCategory}>{instantCategory}</Text>
          {(parsed?.intent === "add_expense" || parsed?.intent === "manual_edit") ? (
            <SettingSwitchRow
              label={t.input.shareToFamily}
              value={shareToFamily}
              onValueChange={setShareToFamily}
              testID="share-to-family-toggle"
            />
          ) : null}
          <Text style={styles.instantQuestion}>{t.input.instantConfirmQuestion}</Text>
          <Pressable onPress={() => setExpanded(true)} accessibilityRole="button">
            <Text style={styles.editLink}>{t.input.instantEdit}</Text>
          </Pressable>
          {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}
        </View>
      ) : (
        <>
          <Text style={styles.hint}>{message}</Text>
          {fxLabel ? <Text style={styles.fxBadge}>{fxLabel}</Text> : null}
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
              {(parsed?.intent === "add_expense" || parsed?.intent === "manual_edit") ? (
                <SettingSwitchRow
                  label={t.input.shareToFamily}
                  value={shareToFamily}
                  onValueChange={setShareToFamily}
                  testID="share-to-family-toggle"
                />
              ) : null}
              <Text style={styles.editHint}>{t.input.confirmEditHint}</Text>
              {fieldError ? <Text style={styles.error}>{fieldError}</Text> : null}
            </View>
          ) : (
            <Text style={styles.message}>{message}</Text>
          )}
        </>
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
  fxBadge: { color: Colors.accent, fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: Spacing.xs },
  error: { color: Colors.danger, fontSize: 13, textAlign: "center", marginTop: Spacing.xs },
  actions: { flexDirection: "row", gap: Spacing.sm, width: "100%" },
  btn: { flex: 1 },
  instantBody: { alignItems: "center", paddingVertical: Spacing.md, gap: Spacing.sm },
  instantHeadline: { color: Colors.text, fontSize: 42, fontWeight: "800", textAlign: "center" },
  instantCategory: { color: Colors.accent, fontSize: 20, fontWeight: "700", textAlign: "center" },
  instantQuestion: { color: Colors.textSecondary, fontSize: 16, marginTop: Spacing.sm, textAlign: "center" },
  editLink: { color: Colors.textMuted, fontSize: 13, textDecorationLine: "underline", marginTop: Spacing.xs },
  instantActions: { width: "100%", gap: Spacing.sm },
  instantBtn: { width: "100%" },
});
