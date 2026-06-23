import { useEffect } from "react";
import { router } from "expo-router";
import { auth } from "@/services/auth";

/** Redirect to login/lock when session is not unlocked (finance screens). */
export function useRequireUnlock() {
  useEffect(() => {
    let cancelled = false;
    auth.getUser().then((user) => {
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
      } else if (user.hasPin && !auth.isUnlocked()) {
        router.replace("/lock");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
}
