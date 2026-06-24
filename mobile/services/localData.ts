import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearLocalDb } from "./localDb";

const QUEUE_KEY = "talkcash_offline_queue";
const SNAPSHOT_KEY = "talkcash_cloud_snapshot";
const ID_MAP_KEY = "talkcash_id_remap";

/** Clear per-user offline data (queue + cloud snapshot + id remap + SQLite). */
export async function clearLocalUserData(): Promise<void> {
  clearLocalDb();
  await AsyncStorage.multiRemove([QUEUE_KEY, SNAPSHOT_KEY, ID_MAP_KEY]);
}
