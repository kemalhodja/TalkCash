import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { flushReceiptScans } from "./receiptQueue";
import { flushVoiceParses } from "./voiceQueue";
import { getIdMap, registerRemapFromResult, remapPayload, remapQueue, remapSnapshotWithMap } from "./idRemap";
import { applyOptimisticForQueuedOp } from "./syncCache";

const QUEUE_KEY = "talkcash_offline_queue";
const BATCH_SIZE = 50;

export type QueuedOperation = {
  id: string;
  type:
    | "execute"
    | "receipt_scan"
    | "shopping_add"
    | "shopping_complete"
    | "shopping_delete"
    | "shopping_routine"
    | "wallet_income"
    | "wallet_transfer"
    | "micro_savings_transfer"
    | "transaction_update"
    | "transaction_delete"
    | "wallet_create"
    | "wallet_update"
    | "wallet_delete"
    | "agenda_add_bill"
    | "agenda_add_task"
    | "agenda_update"
    | "agenda_delete"
    | "agenda_mark_paid"
    | "agenda_complete"
    | "budget_create"
    | "budget_update"
    | "budget_delete"
    | "voice_parse"
    | "voice_premium";
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
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    await AsyncStorage.removeItem(QUEUE_KEY);
    return [];
  }
}

async function saveQueue(queue: QueuedOperation[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function replaceQueue(queue: QueuedOperation[]): Promise<void> {
  await saveQueue(queue);
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

  const receiptFlush = await flushReceiptScans();
  applied += receiptFlush.applied;
  failed += receiptFlush.failed;

  const voiceFlush = await flushVoiceParses();
  applied += voiceFlush.applied;
  failed += voiceFlush.failed;

  while ((await getQueue()).filter((op) => op.type !== "receipt_scan" && op.type !== "voice_parse" && op.type !== "voice_premium").length > 0) {
    const queue = (await getQueue()).filter((op) => op.type !== "receipt_scan" && op.type !== "voice_parse" && op.type !== "voice_premium");
    const idMap = await getIdMap();
    const chunk = queue.slice(0, BATCH_SIZE).map((op) => ({
      ...op,
      payload: remapPayload(op.type, op.payload, idMap),
    }));
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
    let remapped = false;

    for (const op of chunk) {
      const ok = result.applied.find((a: any) => a.operation_id === op.id);
      const fail = result.failed.find((f: any) => f.operation_id === op.id);
      const conflict = result.conflicts.find((c: SyncConflict) => c.operation_id === op.id);

      if (ok) {
        chunkApplied += ok.status === "ok" ? 1 : 0;
        if (ok.result && await registerRemapFromResult(op, ok.result as Record<string, unknown>)) {
          remapped = true;
        }
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

    const pendingReceipts = (await getQueue()).filter((op) => op.type === "receipt_scan");
    await saveQueue([...pendingReceipts, ...nextQueue]);
    if (remapped) {
      const updatedMap = await getIdMap();
      const remappedQueue = remapQueue(await getQueue(), updatedMap);
      const receipts = remappedQueue.filter((op) => op.type === "receipt_scan");
      const syncOps = remappedQueue.filter((op) => op.type !== "receipt_scan");
      await replaceQueue([...receipts, ...syncOps]);
      await remapSnapshotWithMap(updatedMap);
    }
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
