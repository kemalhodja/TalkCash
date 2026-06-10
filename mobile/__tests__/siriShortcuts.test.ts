import { Platform } from "react-native";
import {
  ASSISTANT_PHRASES_TR,
  buildAssistantUrl,
  parseAssistantUrl,
  SIRI_ACTIVITY_TYPES,
} from "../services/assistant";
import {
  buildShortcutOptions,
  isSiriShortcutsAvailable,
  shortcutInfoToText,
} from "../services/siriShortcuts";

jest.mock("react-native-siri-shortcut", () => ({
  AddToSiriButton: jest.fn(),
  SiriButtonStyles: { automaticOutline: 5 },
  donateShortcut: jest.fn(),
  suggestShortcuts: jest.fn(),
  getInitialShortcut: jest.fn(),
  addShortcutListener: jest.fn(() => ({ remove: jest.fn() })),
}));

describe("siri shortcuts", () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, "OS", { value: originalOS });
  });

  it("defines activity types for all assistant phrases", () => {
    expect(ASSISTANT_PHRASES_TR).toHaveLength(4);
    for (const phrase of ASSISTANT_PHRASES_TR) {
      expect(phrase.activityType).toMatch(/^io\.talkcash\.app\./);
      expect(phrase.suggestedPhrase).toContain("TalkCash");
    }
  });

  it("builds shortcut options with userInfo text and url", () => {
    const phrase = ASSISTANT_PHRASES_TR[0];
    const options = buildShortcutOptions(phrase);
    expect(options.activityType).toBe(SIRI_ACTIVITY_TYPES.ADD_EXPENSE);
    expect(options.userInfo?.text).toBe(phrase.text);
    expect(options.userInfo?.url).toBe(buildAssistantUrl(phrase.text, { source: "siri" }));
    expect(options.suggestedInvocationPhrase).toBe(phrase.suggestedPhrase);
  });

  it("resolves shortcut text from userInfo", () => {
    const text = shortcutInfoToText(
      { activityType: SIRI_ACTIVITY_TYPES.ADD_EXPENSE, userInfo: { text: "150 TL kahve" } },
      parseAssistantUrl,
    );
    expect(text).toBe("150 TL kahve");
  });

  it("resolves shortcut text from stored url", () => {
    const url = buildAssistantUrl("maaşım yattı", { source: "siri" });
    const text = shortcutInfoToText(
      { activityType: SIRI_ACTIVITY_TYPES.ADD_INCOME, userInfo: { url } },
      parseAssistantUrl,
    );
    expect(text).toBe("maaşım yattı");
  });

  it("reports Siri availability on iOS when native module loads", () => {
    Object.defineProperty(Platform, "OS", { value: "ios" });
    expect(isSiriShortcutsAvailable()).toBe(true);
  });

  it("reports Siri unavailable on Android", () => {
    Object.defineProperty(Platform, "OS", { value: "android" });
    expect(isSiriShortcutsAvailable()).toBe(false);
  });
});
