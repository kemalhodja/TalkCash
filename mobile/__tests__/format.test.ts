import { formatMoney, getDateLocale } from "@/utils/format";

describe("format utils", () => {
  it("formats Turkish currency", () => {
    const formatted = formatMoney(1500.5, "tr");
    expect(formatted).toContain("1");
    expect(formatted).toMatch(/₺|TRY/);
  });

  it("formats English locale", () => {
    expect(getDateLocale("en")).toBe("en-US");
    expect(getDateLocale("tr")).toBe("tr-TR");
  });
});
