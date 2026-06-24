import { tabBarBottomOffset, tabBarScrollClearance } from "@/utils/screenInsets";

describe("screenInsets", () => {
  const insets = { top: 44, bottom: 34, left: 0, right: 0 };

  it("accounts for gesture bar on tab bar offset", () => {
    expect(tabBarBottomOffset(insets)).toBeGreaterThanOrEqual(34);
  });

  it("clears tab bar height for scroll content", () => {
    expect(tabBarScrollClearance(insets)).toBeGreaterThan(100);
  });

  it("uses minimum offset when inset is zero", () => {
    const zero = { top: 0, bottom: 0, left: 0, right: 0 };
    expect(tabBarBottomOffset(zero)).toBeGreaterThan(0);
  });
});
