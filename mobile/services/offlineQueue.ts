import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

const QUEUE_KEY = "talkcash_offline_queue";

export type QueuedOperation = {
  id: string;
  type: "execute" | "shopping_add" | "shopping_complete";
  payload: Record<string, unknown>;
  clientTimestamp: string;
  resolveStrategy?: "local" | "server";
};

export type SyncConflict = {
  operation_id: string;
  type: string;
  field: string;
  local: unknown;
  server: unknown;
  message: string;
};

function newId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function shouldQueueError(err: unknown): boolean {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status: number }).status;
    return status >= 500 || status === 0;
  }
  return true;
}

export async function getQueue(): Promise<QueuedOperation[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveQueue(queue: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getPendingCount(): Promise<number> {
  return (await getQueue()).length;
}

export async function enqueue(
  op: Omit<QueuedOperation, "id" | "clientTimestamp"> & Partial<Pick<QueuedOperation, "id" | "clientTimestamp">>,
): Promise<string> {
  const queue = await getQueue();
  const entry: QueuedOperation = {
    id: op.id || newId(),
    type: op.type,
    payload: op.payload,
    clientTimestamp: op.clientTimestamp || new Date().toISOString(),
    resolveStrategy: op.resolveStrategy,
  };
  queue.push(entry);
  await saveQueue(queue);
  return entry.id;
}

export async function flushQueue(
  onConflict?: (conflict: SyncConflict) => Promise<"local" | "server" | "skip">,
): Promise<{ applied: number; conflicts: number; failed: number }> {
  const queue = await getQueue();
  if (queue.length === 0) return { applied: 0, conflicts: 0, failed: 0 };

  const batch = queue.map((op) => ({
    id: op.id,
    type: op.type,
    payload: op.payload,
    client_timestamp: op.clientTimestamp,
    resolve_strategy: op.resolveStrategy ?? null,
  }));

  const result = await api.syncPush(batch);
  const nextQueue: QueuedOperation[] = [];
  let applied = 0;
  let conflicts = 0;

  for (const op of queue) {
    const ok = result.applied.find((a: any) => a.operation_id === op.id);
    const fail = result.failed.find((f: any) => f.operation_id === op.id);
    const conflict = result.conflicts.find((c: SyncConflict) => c.operation_id === op.id);

    if (ok) {
      applied += ok.status === "ok" ? 1 : 0;
      continue;
    }
    if (fail) {
      nextQueue.push(op);
      continue;
    }
    if (conflict) {
      conflicts += 1;
      if (onConflict) {
        const choice = await onConflict(conflict);
        if (choice !== "skip") {
          nextQueue.push({ ...op, resolveStrategy: choice });
        }
      } else {
        nextQueue.push(op);
      }
      continue;
    }
    nextQueue.push(op);
  }

  await saveQueue(nextQueue);

  if (nextQueue.some((op) => op.resolveStrategy) && onConflict) {
    const retry = await flushQueue(onConflict);
    return {
      applied: applied + retry.applied,
      conflicts: conflicts + retry.conflicts,
      failed: result.failed.length + retry.failed,
    };
  }

  return { applied, conflicts, failed: result.failed.length };
}
