import { useCallback, useState } from "react";

export function usePullRefresh(loadFn: () => Promise<void>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadFn();
    } finally {
      setRefreshing(false);
    }
  }, [loadFn]);

  return { refreshing, onRefresh };
}
