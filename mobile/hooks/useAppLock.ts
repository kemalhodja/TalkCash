import { useEffect } from "react";
import { AppState } from "react-native";
import { router } from "expo-router";
import { auth } from "@/services/auth";

/** Re-lock app when backgrounded; return to lock screen when foregrounded. */
export function useAppLock() {
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") {
        auth.setUnlocked(false);
        return;
      }
      if (state === "active") {
        auth.getUser().then((user) => {
          if (user && !auth.isUnlocked()) {
            router.replace("/lock");
          }
        });
      }
    });
    return () => sub.remove();
  }, []);
}
