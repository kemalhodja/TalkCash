import { EXPENSE_CATEGORIES } from "./expenseCategories";

const CATEGORY_I18N: Record<string, { tr: string; en: string }> = {
  Genel: { tr: "Genel", en: "General" },
  Market: { tr: "Market", en: "Groceries" },
  Yemek: { tr: "Yemek", en: "Food" },
  Kahve: { tr: "Kahve", en: "Coffee" },
  Ulaşım: { tr: "Ulaşım", en: "Transport" },
  Faturalar: { tr: "Faturalar", en: "Bills" },
};

export function getExpenseCategoryOptions(locale: "tr" | "en" = "tr") {
  return EXPENSE_CATEGORIES.map((id) => ({
    id,
    label: CATEGORY_I18N[id]?.[locale] ?? id,
  }));
}
