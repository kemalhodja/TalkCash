import * as SQLite from "expo-sqlite";

export type LocalShoppingRow = {
  id: string;
  name: string;
  category: string;
  is_routine?: boolean;
  routine_type?: string;
  pending_sync?: number;
};

let db: SQLite.SQLiteDatabase | null = null;

export function initLocalDb(): void {
  if (db) return;
  db = SQLite.openDatabaseSync("talkcash.db");
  db.execSync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS shopping_items (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'diger',
      is_routine INTEGER NOT NULL DEFAULT 0,
      routine_type TEXT,
      pending_sync INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shopping_category ON shopping_items(category);
  `);
}

function requireDb(): SQLite.SQLiteDatabase {
  if (!db) initLocalDb();
  return db!;
}

export function getLocalShoppingItems(): LocalShoppingRow[] {
  const database = requireDb();
  return database.getAllSync<LocalShoppingRow>(
    `SELECT id, name, category, is_routine, routine_type, pending_sync
     FROM shopping_items ORDER BY category, name COLLATE NOCASE`,
  );
}

export function upsertLocalShoppingItems(items: LocalShoppingRow[]): void {
  const database = requireDb();
  database.withTransactionSync(() => {
    for (const item of items) {
      database.runSync(
        `INSERT INTO shopping_items (id, name, category, is_routine, routine_type, pending_sync, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           name = excluded.name,
           category = excluded.category,
           is_routine = excluded.is_routine,
           routine_type = excluded.routine_type,
           pending_sync = excluded.pending_sync,
           updated_at = excluded.updated_at`,
        [
          item.id,
          item.name,
          item.category || "diger",
          item.is_routine ? 1 : 0,
          item.routine_type || "daily",
          item.pending_sync ? 1 : 0,
          new Date().toISOString(),
        ],
      );
    }
  });
}

export function removeLocalShoppingItem(id: string): void {
  requireDb().runSync("DELETE FROM shopping_items WHERE id = ?", [id]);
}

export function updateLocalShoppingRoutine(
  id: string,
  isRoutine: boolean,
  routineType: "daily" | "weekly" = "daily",
): void {
  requireDb().runSync(
    `UPDATE shopping_items SET is_routine = ?, routine_type = ?, updated_at = ? WHERE id = ?`,
    [isRoutine ? 1 : 0, routineType, new Date().toISOString(), id],
  );
}

export function replaceLocalShoppingFromSnapshot(
  items: { id: string; name: string; category: string; is_routine?: boolean; routine_type?: string }[],
): void {
  const database = requireDb();
  database.withTransactionSync(() => {
    database.runSync("DELETE FROM shopping_items WHERE pending_sync = 0");
    for (const item of items) {
      database.runSync(
        `INSERT OR REPLACE INTO shopping_items
         (id, name, category, is_routine, routine_type, pending_sync, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
        [
          item.id,
          item.name,
          item.category || "diger",
          item.is_routine ? 1 : 0,
          item.routine_type || "daily",
          new Date().toISOString(),
        ],
      );
    }
  });
}

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

export function clearLocalDb(): void {
  if (!db) return;
  db.execSync("DELETE FROM shopping_items");
}
