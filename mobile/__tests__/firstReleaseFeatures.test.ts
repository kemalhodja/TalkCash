import { parseAppDeepLink, parseShareUrl, parseInputVoiceUrl } from "@/services/deepLink";
import { parseBankSms } from "@/utils/smsExpenseParser";
import { buildShoppingDepletionHints } from "@/utils/shoppingSuggestions";
import { parseShoppingSuggestionResponse } from "@/utils/shoppingSuggestionVoice";

describe("deepLink", () => {
  it("parses share links", () => {
    const parsed = parseShareUrl("talkcash://share?text=350%20TL%20market&source=share");
    expect(parsed?.text).toBe("350 TL market");
  });

  it("parses whisper input shortcut links", () => {
    const parsed = parseInputVoiceUrl("talkcash://input?whisper=1&hold=1&source=shortcut");
    expect(parsed?.whisper).toBe(true);
    expect(parsed?.hold).toBe(true);
  });

  it("routes command links through parseAppDeepLink", () => {
    const parsed = parseAppDeepLink("talkcash://command?text=150%20kahve&source=shortcut", "tr");
    expect(parsed?.kind).toBe("command");
  });
});

describe("parseBankSms", () => {
  it("extracts amount and merchant from Turkish bank SMS", () => {
    const draft = parseBankSms(
      "X bankası ile 19.06.2026 tarihinde yapılan 350,00 TL'lik harcama - MARKET ABC",
    );
    expect(draft).not.toBeNull();
    expect(draft?.amount).toBe(350);
    expect(draft?.description).toMatch(/MARKET|Banka/i);
  });

  it("returns null when no amount is found", () => {
    expect(parseBankSms("Merhaba, hesabınıza para yatırıldı")).toBeNull();
  });
});

describe("buildShoppingDepletionHints", () => {
  it("suggests staples missing from the active list", () => {
    const hints = buildShoppingDepletionHints(
      [
        { description: "Market alışverişi süt", category: "Market", created_at: "2026-06-01T10:00:00Z" },
        { description: "Kahve", category: "Kahve", created_at: "2026-06-17T10:00:00Z" },
      ],
      ["ekmek"],
      7,
      3,
    );
    expect(hints.some((h) => h.item.toLowerCase().includes("süt"))).toBe(true);
    expect(hints.some((h) => h.item.toLowerCase().includes("ekmek"))).toBe(false);
  });
});

describe("parseShoppingSuggestionResponse", () => {
  it("accepts Turkish affirmatives", () => {
    expect(parseShoppingSuggestionResponse("evet olur")).toBe("accept");
    expect(parseShoppingSuggestionResponse("ekle")).toBe("accept");
  });

  it("rejects Turkish negatives", () => {
    expect(parseShoppingSuggestionResponse("hayır istemez")).toBe("reject");
    expect(parseShoppingSuggestionResponse("yok kalsın")).toBe("reject");
  });
});
