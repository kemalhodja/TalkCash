export type SwapNudge = {
  rule_key: string;
  saved_amount: number;
  actual_amount: number;
  alternative: string;
  target_wallet_type: string;
  target_wallet_id: string;
  target_wallet_name: string;
  target_label: string;
  source_wallet_id?: string;
  speech_text: string;
  locked?: boolean;
  upgrade_message?: string;
  nudge_limit?: number;
  nudge_used?: number;
};

export function extractSwapNudge(result: any): SwapNudge | null {
  const nudge = result?.swap_nudge ?? result?.result?.swap_nudge;
  if (!nudge?.saved_amount || !nudge?.target_wallet_id) return null;
  return nudge as SwapNudge;
}

export function hasSwapNudge(result: any): boolean {
  return extractSwapNudge(result) != null;
}
