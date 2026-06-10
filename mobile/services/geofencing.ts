import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";

const GEOFENCE_TASK = "TALKCASH_GEOFENCE";

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType, region } = data as any;
  if (eventType === Location.GeofencingEventType.Enter) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Market yakınındasınız!",
        body: "Alışveriş listenizdeki eksikleri almayı unutmayın.",
      },
      trigger: null,
    });
  }
});

const DEFAULT_MARKET_REGION = {
  identifier: "nearby-market",
  latitude: 41.0082,
  longitude: 28.9784,
  radius: 500,
  notifyOnEnter: true,
  notifyOnExit: false,
};

export async function setupGeofencing() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;

  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (!isRegistered) {
    await Location.startGeofencingAsync(GEOFENCE_TASK, [DEFAULT_MARKET_REGION]);
  }
  return true;
}

export async function stopGeofencing() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
