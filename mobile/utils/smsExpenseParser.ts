export type SmsExpenseDraft = {
  amount: number;
  description: string;
  merchant?: string;
  date?: string;
};

/** Parse Turkish bank SMS / notification text into a draft expense. */
export function parseBankSms(text: string): SmsExpenseDraft | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  const amountMatch =
    normalized.match(/(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]?\d*)\s*(?:TL|TRY|₺)/i) ||
    normalized.match(/(?:TL|TRY|₺)\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]?\d*)/i);
  if (!amountMatch) return null;

  const rawAmount = amountMatch[1].replace(/\./g, "").replace(",", ".");
  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const dateMatch = normalized.match(/(\d{1,2}[./]\d{1,2}[./]\d{2,4})/);
  const date = dateMatch?.[1];

  const merchantMatch =
    normalized.match(/(?:işyeri|is yeri|merchant|mağaza|magaza)[:\s]+([^,.]+)/i) ||
    normalized.match(/(?:X bankası|bankası ile)[^.]*?(?:\d{1,2}[./]\d{1,2}[./]\d{2,4})[^.]*?(?:yapılan|yapilan)\s+[^.]*?(?:\d+[.,]?\d*\s*(?:TL|TRY|₺))[^.]*?(?:-\s*)?([^,.]+)/i);

  let description = merchantMatch?.[1]?.trim();
  if (!description) {
    const afterAmount = normalized.split(amountMatch[0])[1]?.trim() || "";
    description = afterAmount.replace(/^[-–—]\s*/, "").split(/[,.]/)[0]?.trim() || "Banka harcaması";
  }

  return {
    amount,
    description: description.slice(0, 120),
    merchant: description.slice(0, 120),
    date,
  };
}
