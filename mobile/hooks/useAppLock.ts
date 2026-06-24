import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import { auth } from "@/services/auth";

/** Re-lock only after the app was in background for a while (not on every blur/inactive). */
const RELOCK_AFTER_MS = 60_000;

export function useAppLock() {
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (nextState === "background") {
        backgroundedAt.current = Date.now();
        return;
      }

      if (nextState !== "active") return;
      if (prev !== "background") return;

      const bgAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (bgAt == null || Date.now() - bgAt < RELOCK_AFTER_MS) return;

      auth.getUser().then((user) => {
        if (!user?.hasPin || !auth.isUnlocked()) return;
        auth.setUnlocked(false);
        router.replace("/lock");
      });
    });
    return () => sub.remove();
  }, []);
}
