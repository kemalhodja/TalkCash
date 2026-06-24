import * as Speech from "expo-speech";

export type VoiceAlertPayload = {
  action: "trigger_voice_alert";
  speech_text: string;
  current_store?: string;
  previous_store?: string;
  current_price?: number;
  previous_price?: number;
  percent_diff?: number;
  product?: string;
};

export function extractVoiceAlert(result: any): VoiceAlertPayload | null {
  const r = result?.result ?? result;
  for (const key of ["persona_speech", "subscription_alert", "voice_alert"]) {
    const alert = r?.[key] ?? result?.[key];
    if (alert?.action === "trigger_voice_alert" && alert?.speech_text) return alert;
  }
  return null;
}

function speakNext(texts: string[], locale: string, index = 0): void {
  if (index >= texts.length || !texts[index]) return;
  Speech.speak(texts[index], {
    language: locale === "en" ? "en-US" : "tr-TR",
    onDone: () => speakNext(texts, locale, index + 1),
  });
}

/** Play persona roast, subscription warning, then store price compare — in order. */
export function playExpenseFeedback(result: any, locale: string): void {
  const r = result?.result ?? result;
  const texts = [
    r?.persona_speech?.speech_text ?? result?.persona_speech?.speech_text,
    r?.subscription_alert?.speech_text ?? result?.subscription_alert?.speech_text,
    r?.voice_alert?.speech_text ?? result?.voice_alert?.speech_text,
  ].filter(Boolean) as string[];
  if (!texts.length) return;
  Speech.stop();
  speakNext(texts, locale);
}

export function playVoiceAlert(alert: VoiceAlertPayload | null | undefined, locale: string): void {
  if (!alert || alert.action !== "trigger_voice_alert" || !alert.speech_text) return;
  Speech.speak(alert.speech_text, {
    language: locale === "en" ? "en-US" : "tr-TR",
  });
}
