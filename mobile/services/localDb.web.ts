export type LocalShoppingRow = {
  id: string;
  name: string;
  category: string;
  is_routine?: boolean;
  routine_type?: string;
  pending_sync?: number;
};

/** Web preview: SQLite is native-only; use no-op stubs. */
export function initLocalDb(): void {}

export function getLocalShoppingItems(): LocalShoppingRow[] {
  return [];
}

export function upsertLocalShoppingItems(_items: LocalShoppingRow[]): void {}

export function removeLocalShoppingItem(_id: string): void {}

export function updateLocalShoppingRoutine(
  _id: string,
  _isRoutine: boolean,
  _routineType: "daily" | "weekly" = "daily",
): void {}

export function replaceLocalShoppingFromSnapshot(
  _items: { id: string; name: string; category: string; is_routine?: boolean; routine_type?: string }[],
): void {}

export function groupLocalShopping(items: LocalShoppingRow[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const item of items) {
    const cat = item.category || "diger";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: item.id,
      name: item.name,
      is_routine: Boolean(item.is_routine),
      routine_type: item.routine_type || "daily",
    });
  }
  return grouped;
}

export function clearLocalDb(): void {}
