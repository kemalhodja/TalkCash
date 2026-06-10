import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const SNAPSHOT_KEY = "talkcash_cloud_snapshot";

export async function pullAndCacheSnapshot(): Promise<void> {
  try {
    const data = await api.syncPull();
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      ...data,
      cached_at: new Date().toISOString(),
    }));
  } catch {
    /* offline */
  }
}

export async function getCachedSnapshot(): Promise<any | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
}
