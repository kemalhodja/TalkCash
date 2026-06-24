import * as FileSystem from "expo-file-system";
import { api } from "./api";
import { enqueue, getQueue, replaceQueue, shouldQueueError } from "./offlineQueue";

const RECEIPTS_DIR = `${FileSystem.documentDirectory}offline-receipts/`;

export type QueuedReceiptResult = {
  queued: true;
  queue_id: string;
  receipt_id: null;
  merchant: string;
  total_amount: null;
  image_url?: string;
};

export async function enqueueReceiptScan(uri: string): Promise<QueuedReceiptResult> {
  await FileSystem.makeDirectoryAsync(RECEIPTS_DIR, { intermediates: true }).catch(() => {});
  const dest = `${RECEIPTS_DIR}${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  const queueId = await enqueue({ type: "receipt_scan", payload: { local_uri: dest } });
  return {
    queued: true,
    queue_id: queueId,
    receipt_id: null,
    merchant: "",
    total_amount: null,
    image_url: dest,
  };
}

export async function scanReceiptWithOfflineQueue(uri: string) {
  try {
    return await api.scanReceipt(uri);
  } catch (err) {
    if (shouldQueueError(err)) {
      return enqueueReceiptScan(uri);
    }
    throw err;
  }
}

export async function flushReceiptScans(): Promise<{ applied: number; failed: number }> {
  const queue = await getQueue();
  let applied = 0;
  let failed = 0;
  const rest = [];

  for (const op of queue) {
    if (op.type !== "receipt_scan") {
      rest.push(op);
      continue;
    }
    const uri = String(op.payload.local_uri || "");
    if (!uri) continue;
    try {
      await api.scanReceipt(uri);
      await FileSystem.deleteAsync(uri, { idempotent: true });
      applied += 1;
    } catch {
      rest.push(op);
      failed += 1;
    }
  }

  await replaceQueue(rest);
  return { applied, failed };
}

export async function getPendingReceiptScanCount(): Promise<number> {
  return (await getQueue()).filter((op) => op.type === "receipt_scan").length;
}
