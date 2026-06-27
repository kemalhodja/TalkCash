import AsyncStorage from "@react-native-async-storage/async-storage";

const INSIGHTS_CACHE_KEY = "talkcash_insights_cache";

export type InsightsCache = {
  monthlySummary?: Record<string, unknown> | null;
  insightsSummary?: Record<string, unknown> | null;
  cached_at?: string;
};

export async function getInsightsCache(): Promise<InsightsCache | null> {
  const raw = await AsyncStorage.getItem(INSIGHTS_CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    await AsyncStorage.removeItem(INSIGHTS_CACHE_KEY);
    return null;
  }
}

export async function patchInsightsCache(partial: Partial<InsightsCache>): Promise<void> {
  const current = (await getInsightsCache()) || {};
  await AsyncStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify({
    ...current,
    ...partial,
    cached_at: new Date().toISOString(),
  }));
}

export async function clearInsightsCache(): Promise<void> {
  await AsyncStorage.removeItem(INSIGHTS_CACHE_KEY);
}
