import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";
import type { QueuedOperation } from "./offlineQueue";

const SNAPSHOT_KEY = "talkcash_cloud_snapshot";

export type CloudSnapshot = {
  shopping?: { id: string; name: string; category: string; is_routine?: boolean; routine_type?: string }[];
  agenda?: any[];
  agenda_history?: any[];
  wallets?: any[];
  net_worth_total?: number;
  transactions?: any[];
  receipts?: any[];
  cached_at?: string;
};

export function groupShoppingFromSnapshot(shopping: CloudSnapshot["shopping"]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const item of shopping || []) {
    const cat = item.category || "OTHER";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: item.id,
      name: item.name,
      is_routine: item.is_routine,
      routine_type: item.routine_type || "daily",
    });
  }
  return grouped;
}

export async function pullAndCacheSnapshot(): Promise<void> {
  try {
    const data = await api.syncPull();
    await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
      ...data,
      cached_at: new Date().toISOString(),
    }));
  } catch {
    /* offline */
  }
}

export async function getCachedSnapshot(): Promise<CloudSnapshot | null> {
  const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function patchCachedSnapshot(partial: Partial<CloudSnapshot>): Promise<void> {
  const current = (await getCachedSnapshot()) || {};
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
    ...current,
    ...partial,
    cached_at: new Date().toISOString(),
  }));
}

function localId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function adjustWalletBalance(wallets: any[], walletId: string, delta: number): any[] {
  return wallets.map((w) =>
    w.id === walletId
      ? { ...w, balance_try: Number(w.balance_try || w.balance || 0) + delta }
      : w,
  );
}

/** Optimistically append shopping items when an offline queue entry is created. */
export async function optimisticAddShopping(names: string[]): Promise<void> {
  const snapshot = (await getCachedSnapshot()) || {};
  const shopping = [...(snapshot.shopping || [])];
  const stamp = Date.now();
  for (let i = 0; i < names.length; i++) {
    shopping.push({
      id: `local-${stamp}-${i}`,
      name: names[i],
      category: "OTHER",
    });
  }
  await patchCachedSnapshot({ shopping });
}

/** Apply optimistic snapshot patches when an operation is queued offline. */
export async function applyOptimisticForQueuedOp(
  type: QueuedOperation["type"],
  payload: Record<string, unknown>,
): Promise<void> {
  const snapshot = (await getCachedSnapshot()) || {};

  switch (type) {
    case "shopping_add": {
      await optimisticAddShopping((payload.items as string[]) || []);
      return;
    }
    case "shopping_complete": {
      const itemId = String(payload.item_id);
      await patchCachedSnapshot({
        shopping: (snapshot.shopping || []).filter((i) => i.id !== itemId),
      });
      return;
    }
    case "wallet_create": {
      const wallets = [...(snapshot.wallets || [])];
      wallets.push({
        id: localId("wallet"),
        name: payload.name,
        wallet_type: payload.wallet_type,
        currency: payload.currency || "TRY",
        balance_try: 0,
      });
      await patchCachedSnapshot({ wallets });
      return;
    }
    case "wallet_update": {
      const walletId = String(payload.wallet_id);
      await patchCachedSnapshot({
        wallets: (snapshot.wallets || []).map((w) =>
          w.id === walletId
            ? {
                ...w,
                ...(payload.name != null ? { name: payload.name } : {}),
                ...(payload.wallet_type != null ? { wallet_type: payload.wallet_type } : {}),
                ...(payload.currency != null ? { currency: payload.currency } : {}),
              }
            : w,
        ),
      });
      return;
    }
    case "wallet_delete": {
      const walletId = String(payload.wallet_id);
      await patchCachedSnapshot({
        wallets: (snapshot.wallets || []).filter((w) => w.id !== walletId),
      });
      return;
    }
    case "wallet_income": {
      const walletId = String(payload.wallet_id);
      const amount = Number(payload.amount || 0);
      const wallets = adjustWalletBalance(snapshot.wallets || [], walletId, amount);
      const net = Number(snapshot.net_worth_total || 0) + amount;
      await patchCachedSnapshot({ wallets, net_worth_total: net });
      return;
    }
    case "wallet_transfer": {
      const fromId = String(payload.from_wallet_id);
      const toId = String(payload.to_wallet_id);
      const amount = Number(payload.amount || 0);
      let wallets = adjustWalletBalance(snapshot.wallets || [], fromId, -amount);
      wallets = adjustWalletBalance(wallets, toId, amount);
      await patchCachedSnapshot({ wallets });
      return;
    }
    case "transaction_update": {
      const txId = String(payload.transaction_id);
      await patchCachedSnapshot({
        transactions: (snapshot.transactions || []).map((tx) =>
          tx.id === txId
            ? {
                ...tx,
                ...(payload.amount != null ? { amount: payload.amount } : {}),
                ...(payload.category != null ? { category: payload.category } : {}),
                ...(payload.description != null ? { description: payload.description } : {}),
                ...(payload.place != null ? { place: payload.place } : {}),
              }
            : tx,
        ),
      });
      return;
    }
    case "transaction_delete": {
      const txId = String(payload.transaction_id);
      await patchCachedSnapshot({
        transactions: (snapshot.transactions || []).filter((tx) => tx.id !== txId),
      });
      return;
    }
    case "agenda_add_bill": {
      const agenda = [...(snapshot.agenda || [])];
      agenda.unshift({
        id: localId("agenda"),
        title: payload.title,
        amount: payload.amount,
        due_date: payload.due_date,
        status: "pending",
        is_recurring: payload.is_recurring || false,
      });
      await patchCachedSnapshot({ agenda });
      return;
    }
    case "agenda_update": {
      const itemId = String(payload.item_id);
      await patchCachedSnapshot({
        agenda: (snapshot.agenda || []).map((item) =>
          item.id === itemId
            ? {
                ...item,
                ...(payload.title != null ? { title: payload.title } : {}),
                ...(payload.amount != null ? { amount: payload.amount } : {}),
                ...(payload.due_date != null ? { due_date: payload.due_date } : {}),
                ...(payload.is_recurring != null ? { is_recurring: payload.is_recurring } : {}),
              }
            : item,
        ),
      });
      return;
    }
    case "agenda_delete": {
      const itemId = String(payload.item_id);
      await patchCachedSnapshot({
        agenda: (snapshot.agenda || []).filter((item) => item.id !== itemId),
      });
      return;
    }
    case "agenda_mark_paid": {
      const title = String(payload.title || "").toLowerCase();
      const now = new Date().toISOString();
      await patchCachedSnapshot({
        agenda: (snapshot.agenda || []).map((item) =>
          item.title?.toLowerCase().includes(title) || title.includes(item.title?.toLowerCase())
            ? { ...item, status: "paid", paid_at: now }
            : item,
        ),
      });
      return;
    }
    default:
      return;
  }
}
