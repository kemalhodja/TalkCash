import { api } from "@/services/api";
import {
  getLocalShoppingItems,
  groupLocalShopping,
  initLocalDb,
  removeLocalShoppingItem,
  replaceLocalShoppingFromSnapshot,
  updateLocalShoppingRoutine,
  upsertLocalShoppingItems,
} from "@/services/localDb";
import { getCachedSnapshot, groupShoppingFromSnapshot, pullAndCacheSnapshot } from "@/services/syncCache";
import { newClientId } from "@/utils/clientId";

function categorizeLocal(name: string): string {
  const lower = name.toLowerCase();
  if (["et", "tavuk", "sucuk", "meat", "chicken"].some((k) => lower.includes(k))) return "sarkuteri";
  if (["domates", "salatalık", "marul", "tomato", "lettuce"].some((k) => lower.includes(k))) return "manav";
  if (["süt", "yumurta", "peynir", "milk", "egg", "cheese"].some((k) => lower.includes(k))) return "sut_urunleri";
  if (["deterjan", "temizlik", "soap", "clean"].some((k) => lower.includes(k))) return "temizlik";
  if (["ekmek", "simit", "bread"].some((k) => lower.includes(k))) return "firin";
  if (["su", "kola", "kahve", "çay", "coffee", "tea", "soda"].some((k) => lower.includes(k))) return "icecek";
  return "diger";
}

export async function loadShoppingLocalFirst(): Promise<Record<string, any[]>> {
  initLocalDb();
  const local = getLocalShoppingItems();
  if (local.length) return groupLocalShopping(local);

  const snapshot = await getCachedSnapshot();
  if (snapshot?.shopping?.length) {
    replaceLocalShoppingFromSnapshot(snapshot.shopping);
    return groupShoppingFromSnapshot(snapshot.shopping);
  }
  return {};
}

export async function refreshShoppingWithSync(): Promise<Record<string, any[]>> {
  initLocalDb();
  const local = getLocalShoppingItems();
  let grouped = local.length ? groupLocalShopping(local) : {};

  try {
    const live = await api.getShoppingList();
    grouped = live;
    const flat = Object.entries(live).flatMap(([category, items]) =>
      (items as any[]).map((item) => ({
        id: item.id,
        name: item.name,
        category,
        is_routine: item.is_routine,
        routine_type: item.routine_type,
      })),
    );
    replaceLocalShoppingFromSnapshot(flat);
    await pullAndCacheSnapshot();
  } catch {
    if (!Object.keys(grouped).length) {
      const snapshot = await getCachedSnapshot();
      if (snapshot?.shopping?.length) {
        replaceLocalShoppingFromSnapshot(snapshot.shopping);
        grouped = groupShoppingFromSnapshot(snapshot.shopping);
      }
    }
  }

  return grouped;
}

export async function addShoppingLocalFirst(items: string[], skipSuggestion = false) {
  initLocalDb();
  const optimistic = items.map((name) => ({
    id: newClientId(),
    name: name.trim(),
    category: categorizeLocal(name),
    is_routine: false,
    routine_type: "daily",
    pending_sync: 1,
  }));
  upsertLocalShoppingItems(optimistic);
  const res = (await api.addShoppingItems(items, skipSuggestion)) as {
    status?: string;
    items?: string[];
  };
  if (res?.status !== "queued" && res?.items?.length) {
    upsertLocalShoppingItems(
      res.items.map((name: string, idx: number) => ({
        id: optimistic[idx]?.id || newClientId(),
        name,
        category: categorizeLocal(name),
        pending_sync: 0,
      })),
    );
  }
  return res;
}

export async function deleteShoppingLocalFirst(itemId: string) {
  initLocalDb();
  removeLocalShoppingItem(itemId);
  return api.deleteShoppingItem(itemId);
}

export async function completeShoppingLocalFirst(
  itemId: string,
  price?: number,
  walletId?: string,
  storeName?: string,
) {
  initLocalDb();
  removeLocalShoppingItem(itemId);
  return api.completeShoppingItem(itemId, price, walletId, storeName);
}

export async function setRoutineLocalFirst(
  itemId: string,
  isRoutine: boolean,
  routineType: "daily" | "weekly" = "daily",
) {
  initLocalDb();
  updateLocalShoppingRoutine(itemId, isRoutine, routineType);
  return api.setRoutine(itemId, isRoutine, routineType);
}

export function hydrateLocalDbFromSnapshot(): void {
  initLocalDb();
  getCachedSnapshot().then((snapshot) => {
    if (snapshot?.shopping?.length) {
      replaceLocalShoppingFromSnapshot(snapshot.shopping);
    }
  });
}
