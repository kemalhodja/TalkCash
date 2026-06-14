import AsyncStorage from "@react-native-async-storage/async-storage";
import type { QueuedOperation } from "./offlineQueue";
import { getCachedSnapshot, patchCachedSnapshot } from "./syncCache";

export const ID_MAP_KEY = "talkcash_id_remap";

type IdMap = Record<string, string>;

export async function getIdMap(): Promise<IdMap> {
  const raw = await AsyncStorage.getItem(ID_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}

export async function registerMapping(localId: string, serverId: string): Promise<void> {
  if (!localId || !serverId || localId === serverId) return;
  const map = await getIdMap();
  map[localId] = serverId;
  await AsyncStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
}

export function resolveId(id: string, map: IdMap): string {
  return map[id] || id;
}

const ID_FIELDS = [
  "wallet_id",
  "from_wallet_id",
  "to_wallet_id",
  "item_id",
  "transaction_id",
  "budget_id",
] as const;

export function remapPayload(
  _type: QueuedOperation["type"],
  payload: Record<string, unknown>,
  map: IdMap,
): Record<string, unknown> {
  const next = { ...payload };
  for (const field of ID_FIELDS) {
    if (typeof next[field] === "string") {
      next[field] = resolveId(next[field] as string, map);
    }
  }
  return next;
}

export function remapQueue(queue: QueuedOperation[], map: IdMap): QueuedOperation[] {
  return queue.map((op) => ({
    ...op,
    payload: remapPayload(op.type, op.payload, map),
  }));
}

export async function registerRemapFromResult(
  op: QueuedOperation,
  result: Record<string, unknown>,
): Promise<boolean> {
  let changed = false;
  if (op.type === "wallet_create" && op.payload.client_wallet_id && result.wallet_id) {
    await registerMapping(String(op.payload.client_wallet_id), String(result.wallet_id));
    changed = true;
  }
  if (op.type === "agenda_add_bill" && op.payload.client_item_id && result.id) {
    await registerMapping(String(op.payload.client_item_id), String(result.id));
    changed = true;
  }
  if (op.type === "budget_create" && op.payload.client_budget_id && result.budget_id) {
    await registerMapping(String(op.payload.client_budget_id), String(result.budget_id));
    changed = true;
  }
  return changed;
}

export async function remapSnapshotWithMap(map: IdMap): Promise<void> {
  const snapshot = await getCachedSnapshot();
  if (!snapshot) return;

  const rw = (id: string) => resolveId(id, map);
  await patchCachedSnapshot({
    wallets: snapshot.wallets?.map((w) => ({ ...w, id: rw(w.id) })),
    agenda: snapshot.agenda?.map((a) => ({ ...a, id: rw(a.id) })),
    transactions: snapshot.transactions?.map((tx) => ({
      ...tx,
      id: rw(tx.id),
      wallet_id: tx.wallet_id ? rw(tx.wallet_id) : tx.wallet_id,
    })),
    shopping: snapshot.shopping?.map((s) => ({ ...s, id: rw(s.id) })),
  });
}

export async function applyRemapsToOfflineState(map?: IdMap): Promise<void> {
  const idMap = map || (await getIdMap());
  await remapSnapshotWithMap(idMap);
}

export async function clearIdMap(): Promise<void> {
  await AsyncStorage.removeItem(ID_MAP_KEY);
}
