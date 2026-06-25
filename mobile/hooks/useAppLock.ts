import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { router } from "expo-router";
import { auth, RELOCK_AFTER_MS } from "@/services/auth";

export function useAppLock() {
  const appState = useRef(AppState.currentState);
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prev = appState.current;
      appState.current = nextState;

      if (nextState === "background") {
        backgroundedAt.current = Date.now();
        void auth.recordBackgroundAt();
        return;
      }

      if (nextState !== "active") return;
      if (prev !== "background") return;

      const bgAt = backgroundedAt.current;
      backgroundedAt.current = null;
      if (bgAt == null || Date.now() - bgAt < RELOCK_AFTER_MS) {
        void auth.clearBackgroundTimestamp();
        return;
      }

      auth.getUser().then(async (user) => {
        if (!user?.hasPin || !auth.isUnlocked()) return;
        auth.setUnlocked(false);
        router.replace("/lock");
      });
    });
    return () => sub.remove();
  }, []);
}
