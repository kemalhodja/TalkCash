import AsyncStorage from "@react-native-async-storage/async-storage";

const FIRST_EXPENSE_KEY = "talkcash_first_expense_added";
const COACH_DONE_KEY = "talkcash_coach_done";
const SIMPLE_INPUT_KEY = "talkcash_simple_input";
const SIMPLE_HOME_KEY = "talkcash_simple_home";
const DEMO_OFFER_KEY = "talkcash_demo_offer_shown";
const PENDING_DEMO_OFFER_KEY = "talkcash_pending_demo_offer";

export async function hasAddedFirstExpense(): Promise<boolean> {
  return (await AsyncStorage.getItem(FIRST_EXPENSE_KEY)) === "1";
}

export async function markFirstExpenseAdded(): Promise<void> {
  await AsyncStorage.setItem(FIRST_EXPENSE_KEY, "1");
}

export async function isCoachDone(): Promise<boolean> {
  return (await AsyncStorage.getItem(COACH_DONE_KEY)) === "1";
}

export async function markCoachDone(): Promise<void> {
  await AsyncStorage.setItem(COACH_DONE_KEY, "1");
}

export async function getCoachStep(): Promise<number> {
  const raw = await AsyncStorage.getItem("talkcash_coach_step");
  return raw ? Number(raw) : 0;
}

export async function setCoachStep(step: number): Promise<void> {
  await AsyncStorage.setItem("talkcash_coach_step", String(step));
}

/** Default simple until first expense or user disables in settings. */
export async function isSimpleInputMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SIMPLE_INPUT_KEY);
  if (raw === "0") return false;
  if (raw === "1") return true;
  return !(await hasAddedFirstExpense());
}

export async function setSimpleInputMode(value: boolean): Promise<void> {
  await AsyncStorage.setItem(SIMPLE_INPUT_KEY, value ? "1" : "0");
}

/** Simplified home until user has expenses or turns off in settings. */
export async function isSimpleHomeMode(): Promise<boolean> {
  const raw = await AsyncStorage.getItem(SIMPLE_HOME_KEY);
  if (raw === "0") return false;
  if (raw === "1") return true;
  return !(await hasAddedFirstExpense());
}

export async function setSimpleHomeMode(value: boolean): Promise<void> {
  await AsyncStorage.setItem(SIMPLE_HOME_KEY, value ? "1" : "0");
}

export async function wasDemoOfferShown(): Promise<boolean> {
  return (await AsyncStorage.getItem(DEMO_OFFER_KEY)) === "1";
}

export async function markDemoOfferShown(): Promise<void> {
  await AsyncStorage.setItem(DEMO_OFFER_KEY, "1");
}

/** Set after successful registration; consumed once on home screen. */
export async function setPendingDemoOffer(): Promise<void> {
  await AsyncStorage.setItem(PENDING_DEMO_OFFER_KEY, "1");
}

export async function consumePendingDemoOffer(): Promise<boolean> {
  const pending = (await AsyncStorage.getItem(PENDING_DEMO_OFFER_KEY)) === "1";
  if (pending) await AsyncStorage.removeItem(PENDING_DEMO_OFFER_KEY);
  return pending;
}
