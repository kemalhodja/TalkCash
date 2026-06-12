import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const SNAPSHOT_KEY = "talkcash_cloud_snapshot";

export type CloudSnapshot = {
  shopping?: { id: string; name: string; category: string; is_routine?: boolean; routine_type?: string }[];
  agenda?: any[];
  agenda_history?: any[];
  wallets?: any[];
  net_worth_total?: number;
  transactions?: any[];
  receipts?: any[];
  cached_at?: string;
};

export function groupShoppingFromSnapshot(shopping: CloudSnapshot["shopping"]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const item of shopping || []) {
    const cat = item.category || "OTHER";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: item.id,
      name: item.name,
      is_routine: item.is_routine,
      routine_type: item.routine_type || "daily",
    });
  }
  return grouped;
}

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

export async function getCachedSnapshot(): Promise<CloudSnapshot | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
}
