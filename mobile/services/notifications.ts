import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import tr from "@/i18n/tr";
import en from "@/i18n/en";
import type { Locale } from "@/i18n";
import { formatMoney } from "@/utils/format";
import { api } from "./api";
const MESSAGES = { tr, en };
const PLACEHOLDER_PROJECT_ID = "00000000-0000-0000-0000-000000000000";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function msg(locale: Locale) {
  return MESSAGES[locale]?.notifications || MESSAGES.tr.notifications;
}

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "TalkCash",
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    || Constants.easConfig?.projectId;
  if (!projectId || projectId === PLACEHOLDER_PROJECT_ID) {
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  try {
    await api.registerPushToken(token);
  } catch { /* backend offline */ }
  return token;
}

export async function scheduleAgendaReminder(
  title: string, amount: number, dueDate: Date, locale: Locale = "tr",
) {
  const t = msg(locale);
  const formattedAmount = formatMoney(amount, locale);
  const dayBefore = new Date(dueDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  if (dayBefore > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t.tomorrowTitle.replace("{title}", title),
        body: t.tomorrowBody.replace("{amount}", formattedAmount),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dayBefore },
    });
  }

  const dueMorning = new Date(dueDate);
  dueMorning.setHours(8, 0, 0, 0);
  if (dueMorning > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t.todayTitle.replace("{title}", title),
        body: t.todayBody.replace("{amount}", formattedAmount),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueMorning },
    });
  }
}

function subscriptionReminderId(provider: string, nextBillingDate: Date): string {
  return `sub-${provider.toLowerCase().replace(/\s+/g, "-")}-${nextBillingDate.toISOString().slice(0, 10)}`;
}

export async function scheduleSubscriptionReminder(
  provider: string,
  amount: number,
  nextBillingDate: Date,
  locale: Locale = "tr",
) {
  const t = MESSAGES[locale]?.subscription || MESSAGES.tr.subscription;
  const formattedAmount = formatMoney(amount, locale);
  const twoDaysBefore = new Date(nextBillingDate);
  twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
  twoDaysBefore.setHours(9, 0, 0, 0);
  const identifier = subscriptionReminderId(provider, nextBillingDate);

  if (twoDaysBefore > new Date()) {
    await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: t.reminderTitle.replace("{provider}", provider),
        body: t.reminderBody.replace("{amount}", formattedAmount).replace("{provider}", provider),
        data: { route: "/transactions", subscription_name: provider },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: twoDaysBefore },
    });
  }
}

/** Re-schedule local T-2 reminders from synced recurring transactions (deduped). */
export async function resyncSubscriptionRemindersFromTransactions(
  transactions: Array<{
    is_recurring?: boolean;
    next_billing_date?: string | null;
    subscription_name?: string | null;
    amount?: number;
  }>,
  locale: Locale = "tr",
) {
  for (const tx of transactions) {
    if (!tx.is_recurring || !tx.next_billing_date || !tx.subscription_name) continue;
    await scheduleSubscriptionReminder(
      tx.subscription_name,
      Number(tx.amount || 0),
      new Date(tx.next_billing_date),
      locale,
    );
  }
}

export async function notifyReceiptsSynced(count: number, locale: Locale = "tr") {
  if (count <= 0) return;
  const t = MESSAGES[locale]?.sync || MESSAGES.tr.sync;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t.receiptsSyncedTitle,
      body: t.receiptsSyncedBody.replace("{count}", String(count)),
    },
    trigger: null,
  });
}
