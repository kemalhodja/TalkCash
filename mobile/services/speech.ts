import * as SecureStore from "expo-secure-store";
import * as Speech from "expo-speech";

const TTS_KEY = "talkcash_tts_budget";

export async function isBudgetTtsEnabled(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(TTS_KEY);
  return val !== "false";
}

export async function setBudgetTtsEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(TTS_KEY, enabled ? "true" : "false");
}

export async function speakBudgetAlert(message: string, locale: string): Promise<void> {
  if (!(await isBudgetTtsEnabled())) return;
  Speech.stop();
  Speech.speak(message, {
    language: locale === "tr" ? "tr-TR" : "en-US",
    rate: 0.95,
  });
}
