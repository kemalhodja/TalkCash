export type RoundUpNudge = {
  rule_key: "round_up";
  spare_amount: number;
  original_amount: number;
  rounded_to: number;
  step: number;
  target_wallet_id: string;
  target_wallet_name: string;
  source_wallet_id?: string;
  speech_text: string;
  auto_applied?: boolean;
  auto_requires_premium?: boolean;
};

export function extractRoundUp(result: any): RoundUpNudge | null {
  const nudge = result?.round_up ?? result?.result?.round_up;
  if (!nudge?.spare_amount || !nudge?.target_wallet_id) return null;
  return nudge as RoundUpNudge;
}

export function hasRoundUp(result: any): boolean {
  return extractRoundUp(result) != null;
}
