import { useEffect } from "react";
import { router } from "expo-router";
import { api } from "@/services/api";
import { auth } from "@/services/auth";

/** Redirect to login/lock when session is not unlocked (finance screens). */
export function useRequireUnlock() {
  useEffect(() => {
    if (auth.isUnlocked()) return;

    let cancelled = false;
    (async () => {
      const user = await auth.getUser();
      if (cancelled) return;
      if (!user) {
        router.replace("/login");
        return;
      }

      let hasPin = user.hasPin;
      try {
        const me = await api.getMe();
        if (cancelled) return;
        if (typeof me.has_pin === "boolean") {
          hasPin = me.has_pin;
          if (me.has_pin !== user.hasPin) {
            await auth.updateUser({ hasPin: me.has_pin });
          }
        }
      } catch {
        /* offline — use cached user */
      }

      if (!hasPin) {
        auth.setUnlocked(true);
        return;
      }

      if (auth.isUnlocked()) return;

      if (!auth.isUnlocked()) {
        router.replace("/lock");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
}
