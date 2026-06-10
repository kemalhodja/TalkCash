import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { api } from "./api";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

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

export async function scheduleAgendaReminder(title: string, amount: number, dueDate: Date) {
  const dayBefore = new Date(dueDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  dayBefore.setHours(9, 0, 0, 0);

  if (dayBefore > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Yarın: ${title}`,
        body: `${amount} TL ödeme yarın son gün!`,
      },
      trigger: { date: dayBefore },
    });
  }

  const dueMorning = new Date(dueDate);
  dueMorning.setHours(8, 0, 0, 0);
  if (dueMorning > new Date()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `Bugün: ${title}`,
        body: `${amount} TL ödeme bugün son gün!`,
      },
      trigger: { date: dueMorning },
    });
  }
}
