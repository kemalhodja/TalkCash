import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { applyOptimisticForQueuedOp } from "./syncCache";

const QUEUE_KEY = "talkcash_offline_queue";
const BATCH_SIZE = 50;

export type QueuedOperation = {
  id: string;
  type:
    | "execute"
    | "shopping_add"
    | "shopping_complete"
    | "wallet_income"
    | "wallet_transfer"
    | "transaction_update"
    | "transaction_delete"
    | "wallet_create"
    | "wallet_update"
    | "wallet_delete"
    | "agenda_add_bill"
    | "agenda_update"
    | "agenda_delete"
    | "agenda_mark_paid";
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
  applyOptimisticForQueuedOp(entry.type, entry.payload).catch(() => {});
  return entry.id;
}

export async function flushQueue(
  onConflict?: (conflict: SyncConflict) => Promise<"local" | "server" | "skip">,
): Promise<{ applied: number; conflicts: number; failed: number }> {
  let applied = 0;
  let conflicts = 0;
  let failed = 0;

  while ((await getQueue()).length > 0) {
    const queue = await getQueue();
    const chunk = queue.slice(0, BATCH_SIZE);
    const rest = queue.slice(BATCH_SIZE);

    const batch = chunk.map((op) => ({
      id: op.id,
      type: op.type,
      payload: op.payload,
      client_timestamp: op.clientTimestamp,
      resolve_strategy: op.resolveStrategy ?? null,
    }));

    let result: Awaited<ReturnType<typeof api.syncPush>>;
    try {
      result = await api.syncPush(batch);
    } catch {
      failed += chunk.length;
      break;
    }

    const nextQueue: QueuedOperation[] = [...rest];
    let chunkApplied = 0;
    let chunkConflicts = 0;

    for (const op of chunk) {
      const ok = result.applied.find((a: any) => a.operation_id === op.id);
      const fail = result.failed.find((f: any) => f.operation_id === op.id);
      const conflict = result.conflicts.find((c: SyncConflict) => c.operation_id === op.id);

      if (ok) {
        chunkApplied += ok.status === "ok" ? 1 : 0;
        continue;
      }
      if (fail) {
        nextQueue.push(op);
        continue;
      }
      if (conflict) {
        chunkConflicts += 1;
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
    applied += chunkApplied;
    conflicts += chunkConflicts;
    failed += result.failed.length;

    if (chunkConflicts > 0 && !onConflict) {
      break;
    }

    if (nextQueue.some((op) => op.resolveStrategy) && onConflict) {
      const retry = await flushQueue(onConflict);
      return {
        applied: applied + retry.applied,
        conflicts: conflicts + retry.conflicts,
        failed: failed + retry.failed,
      };
    }

    if (chunk.length < BATCH_SIZE) {
      break;
    }
  }

  return { applied, conflicts, failed };
}
