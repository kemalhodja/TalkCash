import AsyncStorage from "@react-native-async-storage/async-storage";

const INTRO_DISMISSED_KEY = "talkcash_micro_savings_intro_dismissed";

export async function isMicroSavingsIntroDismissed(): Promise<boolean> {
  return (await AsyncStorage.getItem(INTRO_DISMISSED_KEY)) === "1";
}

export async function dismissMicroSavingsIntro(): Promise<void> {
  await AsyncStorage.setItem(INTRO_DISMISSED_KEY, "1");
}
