import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

const PENDING_KEY = "talkcash_pending_assistant";

export const SIRI_ACTIVITY_TYPES = {
  ADD_EXPENSE: "io.talkcash.app.add-expense",
  ADD_INCOME: "io.talkcash.app.add-income",
  ADD_SHOPPING: "io.talkcash.app.add-shopping",
  MARK_PAID: "io.talkcash.app.mark-paid",
} as const;

export type SiriActivityType = (typeof SIRI_ACTIVITY_TYPES)[keyof typeof SIRI_ACTIVITY_TYPES];

export type AssistantParams = {
  text: string;
  confirm: boolean;
  source: "siri" | "google" | "shortcut" | "unknown";
};

export function buildAssistantUrl(text: string, options?: { confirm?: boolean; source?: string }): string {
  const params = new URLSearchParams({ text });
  if (options?.confirm) params.set("confirm", "true");
  if (options?.source) params.set("source", options.source);
  return `talkcash://command?${params.toString()}`;
}

export function parseAssistantUrl(url: string): AssistantParams | null {
  try {
    const parsed = Linking.parse(url);
    const segment = (parsed.hostname || parsed.path || "").replace(/^\//, "");
    if (segment && segment !== "command") return null;

    const text = typeof parsed.queryParams?.text === "string" ? parsed.queryParams.text : "";
    if (!text.trim()) return null;

    const confirm = parsed.queryParams?.confirm === "true";
    const rawSource = typeof parsed.queryParams?.source === "string" ? parsed.queryParams.source : "unknown";
    const source = (["siri", "google", "shortcut"].includes(rawSource) ? rawSource : "unknown") as AssistantParams["source"];

    return { text: text.trim(), confirm, source };
  } catch {
    return null;
  }
}

export async function storePendingAssistant(params: AssistantParams): Promise<void> {
  await SecureStore.setItemAsync(PENDING_KEY, JSON.stringify(params));
}

export async function consumePendingAssistant(): Promise<AssistantParams | null> {
  const raw = await SecureStore.getItemAsync(PENDING_KEY);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(PENDING_KEY);
  try {
    return JSON.parse(raw) as AssistantParams;
  } catch {
    return null;
  }
}

export const ASSISTANT_PHRASES_TR = [
  {
    label: "Harcama ekle",
    text: "150 TL kahve banka",
    url: buildAssistantUrl("150 TL kahve banka", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_EXPENSE,
    suggestedPhrase: "TalkCash harcama ekle",
  },
  {
    label: "Gelir ekle",
    text: "maaşım yattı 45000 banka",
    url: buildAssistantUrl("maaşım yattı 45000 banka", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_INCOME,
    suggestedPhrase: "TalkCash gelir ekle",
  },
  {
    label: "Listeye ekle",
    text: "listeye süt ekmek ekle",
    url: buildAssistantUrl("listeye süt ekmek ekle", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_SHOPPING,
    suggestedPhrase: "TalkCash listeye ekle",
  },
  {
    label: "Fatura ödedim",
    text: "elektrik faturasını ödedim",
    url: buildAssistantUrl("elektrik faturasını ödedim", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.MARK_PAID,
    suggestedPhrase: "TalkCash fatura ödedim",
  },
];

export const ASSISTANT_PHRASES_EN = [
  {
    label: "Add expense",
    text: "150 coffee bank",
    url: buildAssistantUrl("150 coffee bank", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_EXPENSE,
    suggestedPhrase: "TalkCash add expense",
  },
  {
    label: "Add income",
    text: "salary deposited 5000 bank",
    url: buildAssistantUrl("salary deposited 5000 bank", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_INCOME,
    suggestedPhrase: "TalkCash add income",
  },
  {
    label: "Add to list",
    text: "add milk eggs to list",
    url: buildAssistantUrl("add milk eggs to list", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.ADD_SHOPPING,
    suggestedPhrase: "TalkCash add to list",
  },
  {
    label: "Mark bill paid",
    text: "paid electricity bill",
    url: buildAssistantUrl("paid electricity bill", { source: "shortcut" }),
    activityType: SIRI_ACTIVITY_TYPES.MARK_PAID,
    suggestedPhrase: "TalkCash mark bill paid",
  },
];
