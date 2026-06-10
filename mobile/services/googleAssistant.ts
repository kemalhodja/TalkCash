export type GoogleAssistantAction =
  | "add_expense"
  | "add_income"
  | "add_shopping"
  | "mark_paid";

export type GoogleActionParams = {
  action?: string;
  amount?: string;
  currency?: string;
  description?: string;
  item?: string;
  feature?: string;
  text?: string;
  source?: string;
};

const GOOGLE_ACTIONS = new Set<GoogleAssistantAction>([
  "add_expense",
  "add_income",
  "add_shopping",
  "mark_paid",
]);

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function resolveAction(params: GoogleActionParams): GoogleAssistantAction | null {
  const action = clean(params.action) as GoogleAssistantAction;
  if (GOOGLE_ACTIONS.has(action)) return action;

  const feature = clean(params.feature) as GoogleAssistantAction;
  if (GOOGLE_ACTIONS.has(feature)) return feature;

  return null;
}

/** Build NLP command text from Google Assistant App Action parameters. */
export function googleActionParamsToText(params: GoogleActionParams, locale: "tr" | "en" = "tr"): string | null {
  const direct = clean(params.text);
  if (direct) return direct;

  const action = resolveAction(params);
  if (!action) return null;

  const amount = clean(params.amount);
  const currency = clean(params.currency) || (locale === "en" ? "USD" : "TL");
  const description = clean(params.description);
  const item = clean(params.item);

  switch (action) {
    case "add_expense":
      if (amount && description) return `${amount} ${currency} ${description}`;
      if (amount) return locale === "en" ? `${amount} ${currency} expense` : `${amount} ${currency} harcama`;
      return locale === "en" ? "add expense" : "harcama ekle";
    case "add_income":
      if (amount) {
        return locale === "en"
          ? `salary deposited ${amount} ${currency}`
          : `maaşım yattı ${amount} ${currency}`;
      }
      return locale === "en" ? "salary deposited" : "maaşım yattı";
    case "add_shopping":
      if (item) return locale === "en" ? `add ${item} to list` : `listeye ${item} ekle`;
      return locale === "en" ? "add to shopping list" : "listeye ekle";
    case "mark_paid":
      if (description) {
        return locale === "en"
          ? `paid ${description} bill`
          : `${description} faturasını ödedim`;
      }
      return locale === "en" ? "paid bill" : "faturayı ödedim";
    default:
      return null;
  }
}

export function isGoogleAssistantAction(action: string): action is GoogleAssistantAction {
  return GOOGLE_ACTIONS.has(action as GoogleAssistantAction);
}
