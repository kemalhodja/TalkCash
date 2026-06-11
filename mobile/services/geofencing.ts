import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as Notifications from "expo-notifications";
import en from "@/i18n/en";
import tr from "@/i18n/tr";
import { api } from "./api";

const GEOFENCE_TASK = "TALKCASH_GEOFENCE";
const LOCALE_KEY = "talkcash_locale";
const MARKET_NAMES_KEY = "talkcash_geofence_markets";
const MAX_REGIONS = 20;
const GEOFENCE_RADIUS_M = 150;

const GEO_MESSAGES = { tr: tr.geofence, en: en.geofence };

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const event = data as { eventType?: number; region?: { identifier?: string } } | undefined;
  if (!event?.region?.identifier) return;

  const locale = (await SecureStore.getItemAsync(LOCALE_KEY)) || "tr";
  const namesJson = await SecureStore.getItemAsync(MARKET_NAMES_KEY);
  const names: Record<string, string> = namesJson ? JSON.parse(namesJson) : {};
  const marketName = names[event.region.identifier] || (locale === "en" ? "market" : "market");

  const msg = GEO_MESSAGES[locale as keyof typeof GEO_MESSAGES] || GEO_MESSAGES.tr;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: msg.title.replace("{name}", marketName),
      body: msg.body,
    },
    trigger: null,
  });
});

export async function setupGeofencing() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") return false;

  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== "granted") return false;

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const { latitude, longitude } = position.coords;

  let markets: { id: string; name: string; lat: number; lng: number }[] = [];
  try {
    const res = await api.getNearbyMarkets(latitude, longitude);
    markets = res.markets || [];
  } catch {
    return false;
  }

  if (!markets.length) return false;

  const nameMap: Record<string, string> = {};
  const regions = markets.slice(0, MAX_REGIONS).map((m) => {
    nameMap[m.id] = m.name;
    return {
      identifier: m.id,
      latitude: m.lat,
      longitude: m.lng,
      radius: GEOFENCE_RADIUS_M,
      notifyOnEnter: true,
      notifyOnExit: false,
    };
  });

  await SecureStore.setItemAsync(MARKET_NAMES_KEY, JSON.stringify(nameMap));

  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  return true;
}

export async function stopGeofencing() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK);
  if (isRegistered) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
  await SecureStore.deleteItemAsync(MARKET_NAMES_KEY);
}
