import type { Locale } from "@/i18n";

export function getDateLocale(locale: Locale): string {
  return locale === "en" ? "en-US" : "tr-TR";
}

export function formatMoney(amount: number, locale: Locale, currency = "TRY"): string {
  const dateLocale = getDateLocale(locale);
  try {
    return new Intl.NumberFormat(dateLocale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    const suffix = currency === "TRY" ? "₺" : currency;
    return `${amount.toLocaleString(dateLocale, { minimumFractionDigits: 2 })} ${suffix}`;
  }
}

export function formatDate(value: string | Date, locale: Locale): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString(getDateLocale(locale));
}

export function formatNumber(value: number, locale: Locale): string {
  return value.toLocaleString(getDateLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
