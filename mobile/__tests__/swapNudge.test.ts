import { extractSwapNudge, hasSwapNudge } from "@/utils/swapNudge";

describe("swapNudge", () => {
  const nudge = {
    rule_key: "coffee",
    saved_amount: 42,
    target_wallet_id: "w1",
    speech_text: "test",
  };

  it("reads nested swap_nudge", () => {
    expect(extractSwapNudge({ result: { swap_nudge: nudge } })).toEqual(nudge);
  });

  it("reads top-level swap_nudge", () => {
    expect(extractSwapNudge({ swap_nudge: nudge })).toEqual(nudge);
  });

  it("detects presence", () => {
    expect(hasSwapNudge({ swap_nudge: nudge })).toBe(true);
    expect(hasSwapNudge({})).toBe(false);
  });
});
