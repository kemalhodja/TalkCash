import { useCallback, useEffect, useState } from "react";
import { getCachedSnapshot, pullAndCacheSnapshot } from "@/services/syncCache";

type Loaders<T> = {
  live: () => Promise<T>;
  fromCache: (snapshot: any) => T | null;
};

export function useCachedData<T>(loaders: Loaders<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromCache, setFromCache] = useState(false);

  const refresh = useCallback(async () => {
    setError("");
    const snapshot = await getCachedSnapshot();
    if (snapshot) {
      const cached = loaders.fromCache(snapshot);
      if (cached != null) {
        setData(cached);
        setFromCache(true);
      }
    }
    try {
      const live = await loaders.live();
      setData(live);
      setFromCache(false);
      await pullAndCacheSnapshot();
    } catch (e: any) {
      if (data == null) setError(e.message || "Error");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, error, fromCache, refresh, setData };
}
