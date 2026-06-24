/** Local yes/no parsing for predictive shopping voice loop. */

const AFFIRMATIVE = ["evet", "olur", "ekle", "aynen", "koy", "yes", "yeah", "ok", "okay", "sure", "add"];
const NEGATIVE = ["hayır", "hayir", "istemez", "kalsın", "kalsin", "yok", "no", "nope", "skip", "cancel"];

export type VoiceDecision = "accept" | "reject" | "unknown";

export function parseShoppingSuggestionResponse(text: string): VoiceDecision {
  const normalized = text.toLowerCase().trim();
  if (!normalized) return "unknown";

  for (const word of NEGATIVE) {
    if (normalized === word || normalized.startsWith(`${word} `) || normalized.includes(` ${word}`)) {
      return "reject";
    }
  }

  for (const word of AFFIRMATIVE) {
    if (normalized === word || normalized.startsWith(`${word} `) || normalized.includes(` ${word}`)) {
      return "accept";
    }
  }

  return "unknown";
}

export type ShoppingSuggestion = {
  hasSuggestion: boolean;
  suggestedItem: string;
  speechText: string;
  triggerProduct?: string;
  confidenceScore?: number;
};

export function hasActiveSuggestion(res: any): res is { suggestion: ShoppingSuggestion } {
  return Boolean(res?.suggestion?.hasSuggestion && res?.suggestion?.suggestedItem);
}
