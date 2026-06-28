import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import * as SecureStore from "@/services/secureStorage";
import tr from "./tr";
import en from "./en";

const LOCALES = { tr, en } as const;
export type Locale = keyof typeof LOCALES;
export type Translations = (typeof LOCALES)[Locale];

const LOCALE_KEY = "talkcash_locale";

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: Translations;
}

const I18nContext = createContext<I18nContextType>({
  locale: "tr",
  setLocale: () => {},
  t: tr,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");

  useEffect(() => {
    SecureStore.getItemAsync(LOCALE_KEY).then((saved) => {
      if (saved === "en" || saved === "tr") setLocaleState(saved);
    });
  }, []);

  const setLocale = async (l: Locale) => {
    setLocaleState(l);
    await SecureStore.setItemAsync(LOCALE_KEY, l);
    try {
      const { api } = await import("@/services/api");
      await api.setLocale(l);
    } catch { /* offline */ }
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t: LOCALES[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}

export async function getStoredLocale(): Promise<Locale> {
  const saved = await SecureStore.getItemAsync(LOCALE_KEY);
  return saved === "en" ? "en" : "tr";
}
