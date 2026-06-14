import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { flushQueue, getPendingCount, type SyncConflict } from "@/services/offlineQueue";
import { pullAndCacheSnapshot } from "@/services/syncCache";

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const resolverRef = useRef<((choice: "local" | "server" | "skip") => void) | null>(null);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const resolveConflict = useCallback((choice: "local" | "server" | "skip") => {
    resolverRef.current?.(choice);
    resolverRef.current = null;
    setConflict(null);
  }, []);

  const runSync = useCallback(async () => {
    try {
      const result = await flushQueue(async (c) => {
        setConflict(c);
        return new Promise<"local" | "server" | "skip">((resolve) => {
          resolverRef.current = resolve;
        });
      });
      await pullAndCacheSnapshot();
      await refreshCount();
      return result;
    } catch {
      await refreshCount();
      return { applied: 0, conflicts: 0, failed: 0 };
    }
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runSync();
    });
    runSync();
    return () => sub.remove();
  }, [refreshCount, runSync]);

  return { pendingCount, conflict, resolveConflict, runSync, refreshCount };
}
