import { extractRoundUp, hasRoundUp } from "@/utils/roundUp";

describe("roundUp", () => {
  const nudge = {
    rule_key: "round_up" as const,
    spare_amount: 3,
    target_wallet_id: "w1",
    speech_text: "test",
  };

  it("reads nested round_up", () => {
    expect(extractRoundUp({ result: { round_up: nudge } })).toEqual(nudge);
  });

  it("detects presence", () => {
    expect(hasRoundUp({ round_up: nudge })).toBe(true);
    expect(hasRoundUp({})).toBe(false);
  });
});
