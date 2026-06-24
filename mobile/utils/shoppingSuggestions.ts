const TRACKED_ITEMS = [
  "süt", "yumurta", "ekmek", "peynir", "domates", "su", "kahve", "tereyağı", "tereyagi",
  "milk", "egg", "bread", "cheese", "tomato", "water", "coffee", "butter",
];

export type ShoppingDepletionHint = {
  item: string;
  daysSince: number;
};

function normalizeItem(name: string): string {
  return name.trim().toLowerCase();
}

function matchesTracked(description: string): string | null {
  const lower = normalizeItem(description);
  for (const item of TRACKED_ITEMS) {
    if (lower.includes(item)) return item.charAt(0).toUpperCase() + item.slice(1);
  }
  return null;
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

/** Suggest staples missing from the active list based on recent market expenses. */
export function buildShoppingDepletionHints(
  transactions: { description?: string; category?: string; created_at?: string; date?: string }[] | undefined,
  activeListNames: string[],
  minDays = 7,
  maxHints = 3,
): ShoppingDepletionHint[] {
  const active = new Set(activeListNames.map(normalizeItem));
  const lastPurchase = new Map<string, Date>();
  const now = new Date();

  for (const tx of transactions || []) {
    const cat = (tx.category || "").toLowerCase();
    if (cat && cat !== "market" && cat !== "genel") continue;
    const item = matchesTracked(tx.description || "");
    if (!item) continue;
    const rawDate = tx.created_at || tx.date;
    const when = rawDate ? new Date(rawDate) : now;
    if (Number.isNaN(when.getTime())) continue;
    const key = normalizeItem(item);
    const prev = lastPurchase.get(key);
    if (!prev || when > prev) lastPurchase.set(key, when);
  }

  const hints: ShoppingDepletionHint[] = [];
  for (const [key, when] of lastPurchase.entries()) {
    if (active.has(key)) continue;
    const daysSince = daysBetween(when, now);
    if (daysSince < minDays) continue;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    hints.push({ item: label, daysSince });
  }

  return hints.sort((a, b) => b.daysSince - a.daysSince).slice(0, maxHints);
}
