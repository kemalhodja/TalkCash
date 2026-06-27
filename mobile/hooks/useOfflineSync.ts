import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getStoredLocale } from "@/i18n";
import { trackFirstSync } from "@/services/analytics";
import { checkApiHealth } from "@/services/config";
import { flushQueue, getPendingCount, type SyncConflict } from "@/services/offlineQueue";
import { notifyReceiptsSynced } from "@/services/notifications";
import { getPendingReceiptScanCount } from "@/services/receiptQueue";
import { pullAndCacheSnapshot } from "@/services/syncCache";
import { hydrateLocalDbFromSnapshot } from "@/services/shoppingRepository";

const RECONNECT_POLL_MS = 15_000;

export function useOfflineSync() {
  const [pendingCount, setPendingCount] = useState(0);
  const [conflict, setConflict] = useState<SyncConflict | null>(null);
  const resolverRef = useRef<((choice: "local" | "server" | "skip") => void) | null>(null);
  const wasOfflineRef = useRef(false);
  const syncingRef = useRef(false);

  const refreshCount = useCallback(async () => {
    setPendingCount(await getPendingCount());
  }, []);

  const resolveConflict = useCallback((choice: "local" | "server" | "skip") => {
    resolverRef.current?.(choice);
    resolverRef.current = null;
    setConflict(null);
  }, []);

  const runSync = useCallback(async (notifyOnReceiptFlush = false) => {
    if (syncingRef.current) {
      return { applied: 0, conflicts: 0, failed: 0 };
    }
    syncingRef.current = true;
    try {
      const receiptsBefore = await getPendingReceiptScanCount();
      const result = await flushQueue(async (c) => {
        setConflict(c);
        return new Promise<"local" | "server" | "skip">((resolve) => {
          resolverRef.current = resolve;
        });
      });
      await pullAndCacheSnapshot();
      hydrateLocalDbFromSnapshot();
      await refreshCount();
      const receiptsAfter = await getPendingReceiptScanCount();
      const receiptsFlushed = Math.max(0, receiptsBefore - receiptsAfter);
      if (notifyOnReceiptFlush && receiptsFlushed > 0) {
        await notifyReceiptsSynced(receiptsFlushed, await getStoredLocale());
      }
      return result;
    } catch {
      await refreshCount();
      return { applied: 0, conflicts: 0, failed: 0 };
    } finally {
      syncingRef.current = false;
    }
  }, [refreshCount]);

  const syncOnReconnect = useCallback(async () => {
    const health = await checkApiHealth(5000);
    if (!health.ok) {
      wasOfflineRef.current = true;
      return;
    }
    const cameBackOnline = wasOfflineRef.current;
    wasOfflineRef.current = false;
    if (cameBackOnline || (await getPendingReceiptScanCount()) > 0 || (await getPendingCount()) > 0) {
      const result = await runSync(cameBackOnline);
      if (result.applied > 0) {
        await trackFirstSync({ applied: result.applied });
      }
    }
  }, [runSync]);

  useEffect(() => {
    refreshCount();
    syncOnReconnect();

    const appSub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncOnReconnect();
    });

    const poll = setInterval(() => {
      if (AppState.currentState !== "active") return;
      if (!wasOfflineRef.current) return;
      syncOnReconnect();
    }, RECONNECT_POLL_MS);

    return () => {
      appSub.remove();
      clearInterval(poll);
    };
  }, [refreshCount, syncOnReconnect]);

  return { pendingCount, conflict, resolveConflict, runSync, refreshCount };
}
