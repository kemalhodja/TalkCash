import { useCallback, useEffect, useState } from "react";
import { isPremium, refreshPremiumStatus, type PremiumStatus } from "@/services/premium";

type PremiumState = {
  isPremium: boolean;
  status: PremiumStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Reactive premium entitlement — use on paywalls and premium-gated screens.
 * Checks RevenueCat + backend on refresh.
 */
export function usePremium(): PremiumState {
  const [isPremiumUser, setIsPremiumUser] = useState(false);
  const [status, setStatus] = useState<PremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [premium, nextStatus] = await Promise.all([
        isPremium(true),
        refreshPremiumStatus(),
      ]);
      setIsPremiumUser(premium);
      setStatus(nextStatus);
    } catch {
      setIsPremiumUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { isPremium: isPremiumUser, status, loading, refresh };
}
