import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import tr from "@/i18n/tr";
import en from "@/i18n/en";
import { api } from "./api";

type Locale = "tr" | "en";
const MESSAGES = { tr, en };

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

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  try {
    await api.registerPushToken(token);
  } catch { /* backend offline */ }
  return token;
}

export async function scheduleAgendaReminder(
  title: string, amount: number, dueDate: Date, locale: Locale = "tr",
) {
  const t = msg(locale);
  const dayBefore = new Date(dueDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  if (dayBefore > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t.tomorrowTitle.replace("{title}", title),
        body: t.tomorrowBody.replace("{amount}", String(amount)),
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
        body: t.todayBody.replace("{amount}", String(amount)),
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueMorning },
    });
  }
}
