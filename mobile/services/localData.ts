import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "talkcash_offline_queue";
const SNAPSHOT_KEY = "talkcash_cloud_snapshot";

/** Clear per-user offline data (queue + cloud snapshot). */
export async function clearLocalUserData(): Promise<void> {
  await AsyncStorage.multiRemove([QUEUE_KEY, SNAPSHOT_KEY]);
}
