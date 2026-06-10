import { buildAssistantUrl, parseAssistantUrl } from "../services/assistant";

describe("assistant deep links", () => {
  it("builds talkcash command URL", () => {
    const url = buildAssistantUrl("150 TL kahve", { source: "siri" });
    expect(url).toContain("command");
    expect(url).toContain("text=");
  });

  it("parses command URL with text param", () => {
    const result = parseAssistantUrl("talkcash://command?text=150%20TL%20kahve&source=siri");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("150 TL kahve");
    expect(result!.source).toBe("siri");
  });

  it("rejects non-command paths", () => {
    expect(parseAssistantUrl("talkcash://home?text=foo")).toBeNull();
  });

  it("parses confirm flag", () => {
    const result = parseAssistantUrl("talkcash://command?text=test&confirm=true");
    expect(result?.confirm).toBe(true);
  });

  it("infers google source from app action params", () => {
    const result = parseAssistantUrl("talkcash://command?action=add_income&amount=5000");
    expect(result?.source).toBe("google");
    expect(result?.text).toContain("5000");
  });
});
