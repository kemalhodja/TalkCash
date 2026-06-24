/** Known subscription cancel/manage URLs (open in browser). */
const CANCEL_URLS: Record<string, string> = {
  Netflix: "https://www.netflix.com/cancelplan",
  Spotify: "https://www.spotify.com/account/subscription/",
  "YouTube Premium": "https://www.youtube.com/paid_memberships",
  iCloud: "https://appleid.apple.com/account/manage",
  "Disney+": "https://www.disneyplus.com/account",
  "Amazon Prime": "https://www.amazon.com.tr/gp/primecentral",
  Exxen: "https://www.exxen.com/tr/account",
  BluTV: "https://www.blutv.com/hesabim",
};

export function getSubscriptionCancelUrl(provider: string | null | undefined): string | null {
  if (!provider) return null;
  return CANCEL_URLS[provider] ?? null;
}

export type UpcomingSubscription = {
  subscription_name: string;
  amount: number;
  next_billing_date: string;
  cancel_url?: string | null;
};

export function extractUpcomingSubscriptions(
  transactions: Array<{
    is_recurring?: boolean;
    subscription_name?: string | null;
    next_billing_date?: string | null;
    amount?: number;
  }> | undefined,
  limit = 5,
): UpcomingSubscription[] {
  const now = new Date();
  return (transactions || [])
    .filter((tx) => tx.is_recurring && tx.subscription_name && tx.next_billing_date)
    .map((tx) => ({
      subscription_name: tx.subscription_name!,
      amount: Number(tx.amount || 0),
      next_billing_date: tx.next_billing_date!,
    }))
    .filter((s) => new Date(s.next_billing_date) >= now)
    .sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime())
    .slice(0, limit);
}
