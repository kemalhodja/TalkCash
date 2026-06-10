import { buildAssistantUrl, parseAssistantUrl } from "../services/assistant";
import { googleActionParamsToText } from "../services/googleAssistant";

describe("google assistant app actions", () => {
  it("builds expense text from amount and description", () => {
    const text = googleActionParamsToText({
      action: "add_expense",
      amount: "150",
      currency: "TL",
      description: "kahve",
    });
    expect(text).toBe("150 TL kahve");
  });

  it("builds shopping list text from item", () => {
    const text = googleActionParamsToText({ action: "add_shopping", item: "süt" }, "tr");
    expect(text).toBe("listeye süt ekle");
  });

  it("builds mark paid text from description", () => {
    const text = googleActionParamsToText({ action: "mark_paid", description: "elektrik" }, "tr");
    expect(text).toBe("elektrik faturasını ödedim");
  });

  it("parses google app action deep link with structured params", () => {
    const url = "talkcash://command?amount=200&currency=TL&description=market&action=add_expense&source=google";
    const result = parseAssistantUrl(url, "tr");
    expect(result).not.toBeNull();
    expect(result!.text).toBe("200 TL market");
    expect(result!.source).toBe("google");
  });

  it("parses google action fallback without amount", () => {
    const url = "talkcash://command?action=add_shopping&source=google";
    const result = parseAssistantUrl(url, "tr");
    expect(result?.text).toBe("listeye ekle");
    expect(result?.source).toBe("google");
  });

  it("still parses classic text deep links", () => {
    const url = buildAssistantUrl("150 TL kahve", { source: "google" });
    const result = parseAssistantUrl(url, "tr");
    expect(result?.text).toBe("150 TL kahve");
    expect(result?.source).toBe("google");
  });
});
