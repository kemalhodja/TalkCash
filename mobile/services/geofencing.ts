import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";

const GEOFENCE_TASK = "TALKCASH_GEOFENCE";
const LOCALE_KEY = "talkcash_locale";

const GEO_MESSAGES = {
  tr: {
    title: "Market yakınındasınız!",
    body: "Alışveriş listenizdeki eksikleri almayı unutmayın.",
  },
  en: {
    title: "You're near a market!",
    body: "Don't forget items on your shopping list.",
  },
};

TaskManager.defineTask(GEOFENCE_TASK, async () => {
  const locale = (await SecureStore.getItemAsync(LOCALE_KEY)) || "tr";
  const msg = GEO_MESSAGES[locale as keyof typeof GEO_MESSAGES] || GEO_MESSAGES.tr;
  await Notifications.scheduleNotificationAsync({
    content: { title: msg.title, body: msg.body },
    trigger: null,
  });
});

export async function setupGeofencing() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const region = {
    identifier: "nearby-market",
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    radius: 500,
    notifyOnEnter: true,
    notifyOnExit: false,
  };

  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, [region]);
  return true;
}

export async function stopGeofencing() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
