import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import { enqueue, getQueue, replaceQueue, shouldQueueError } from "./offlineQueue";
import { captureError } from "./observability";

const VOICE_DIR = `${FileSystem.documentDirectory}offline-voice/`;
const PENDING_RESULT_KEY = "talkcash_pending_voice_result";

export type QueuedVoiceResult = {
  queued: true;
  queue_id: string;
};

async function persistRecording(uri: string): Promise<string> {
  await FileSystem.makeDirectoryAsync(VOICE_DIR, { intermediates: true }).catch(() => {});
  const dest = `${VOICE_DIR}${Date.now()}.m4a`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function storePendingVoiceResult(result: unknown): Promise<void> {
  await AsyncStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(result));
}

export async function consumePendingVoiceResult<T = unknown>(): Promise<T | null> {
  const raw = await AsyncStorage.getItem(PENDING_RESULT_KEY);
  if (!raw) return null;
  await AsyncStorage.removeItem(PENDING_RESULT_KEY);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function parseVoiceWithOfflineQueue(
  uri: string,
  whisperMode: boolean,
  premium: boolean,
): Promise<any> {
  try {
    return premium
      ? await api.processPremiumVoice(uri, whisperMode)
      : await api.parseVoice(uri, whisperMode);
  } catch (err) {
    if (!shouldQueueError(err)) throw err;
    const localUri = await persistRecording(uri);
    const queueId = await enqueue({
      type: premium ? "voice_premium" : "voice_parse",
      payload: { local_uri: localUri, whisper_mode: whisperMode },
    });
    return { status: "queued", queue_id: queueId };
  }
}

export async function flushVoiceParses(): Promise<{ applied: number; failed: number }> {
  const queue = await getQueue();
  let applied = 0;
  let failed = 0;
  const rest = [];

  for (const op of queue) {
    if (op.type !== "voice_parse" && op.type !== "voice_premium") {
      rest.push(op);
      continue;
    }
    const uri = String(op.payload.local_uri || "");
    const whisperMode = Boolean(op.payload.whisper_mode);
    if (!uri) continue;
    try {
      const result = op.type === "voice_premium"
        ? await api.processPremiumVoice(uri, whisperMode)
        : await api.parseVoice(uri, whisperMode);
      await storePendingVoiceResult(result);
      await FileSystem.deleteAsync(uri, { idempotent: true });
      applied += 1;
    } catch (err) {
      captureError(err, { op: op.type, queue_id: op.id });
      rest.push(op);
      failed += 1;
    }
  }

  await replaceQueue(rest);
  return { applied, failed };
}

export async function quickVoiceWithOfflineQueue(uri: string): Promise<any> {
  try {
    return await api.quickVoice(uri);
  } catch (err) {
    if (!shouldQueueError(err)) throw err;
    const localUri = await persistRecording(uri);
    const queueId = await enqueue({
      type: "voice_parse",
      payload: { local_uri: localUri, whisper_mode: true, quick: true },
    });
    return { status: "queued", queue_id: queueId };
  }
}
