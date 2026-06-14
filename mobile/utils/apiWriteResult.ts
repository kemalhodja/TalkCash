import { Alert } from "react-native";

type QueuedResult = { status: "queued"; operation_id?: string };

export function isQueuedResult(result: unknown): result is QueuedResult {
  return !!result && typeof result === "object" && (result as QueuedResult).status === "queued";
}

export function showQueuedAlert(title: string, message: string): void {
  Alert.alert(title, message);
}
