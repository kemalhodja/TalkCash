import { Platform } from "react-native";
import { buildAssistantUrl, type SiriActivityType } from "./assistant";

export { SIRI_ACTIVITY_TYPES, type SiriActivityType } from "./assistant";

export type SiriPhrase = {
  label: string;
  text: string;
  url: string;
  activityType: SiriActivityType;
  suggestedPhrase: string;
};

type ShortcutOptions = {
  activityType: string;
  title?: string;
  suggestedInvocationPhrase?: string;
  isEligibleForPrediction?: boolean;
  isEligibleForSearch?: boolean;
  userInfo?: Record<string, string>;
};

type ShortcutInfo = {
  activityType: string;
  userInfo?: Record<string, unknown>;
};

type SiriModule = {
  donateShortcut: (options: ShortcutOptions) => void;
  suggestShortcuts: (options: ShortcutOptions[]) => void;
  getInitialShortcut: () => Promise<ShortcutInfo | null>;
  addShortcutListener: (cb: (info: ShortcutInfo) => void) => { remove: () => void };
  AddToSiriButton?: React.ComponentType<{
    shortcut: ShortcutOptions;
    buttonStyle?: number;
    style?: object;
    onPress?: () => void;
  }>;
  SiriButtonStyles?: { automaticOutline: number };
};

let siriModule: SiriModule | null | undefined;

function getSiriModule(): SiriModule | null {
  if (Platform.OS !== "ios") return null;
  if (siriModule !== undefined) return siriModule;
  try {
    siriModule = require("react-native-siri-shortcut") as SiriModule;
  } catch {
    siriModule = null;
  }
  return siriModule;
}

export function isSiriShortcutsAvailable(): boolean {
  const mod = getSiriModule();
  return !!mod?.AddToSiriButton;
}

export function buildShortcutOptions(phrase: Pick<SiriPhrase, "label" | "text" | "activityType" | "suggestedPhrase">): ShortcutOptions {
  return {
    activityType: phrase.activityType,
    title: phrase.label,
    suggestedInvocationPhrase: phrase.suggestedPhrase,
    isEligibleForPrediction: true,
    isEligibleForSearch: true,
    userInfo: {
      text: phrase.text,
      url: buildAssistantUrl(phrase.text, { source: "siri" }),
    },
  };
}

export function shortcutInfoToText(info: ShortcutInfo, parseUrl?: (url: string) => { text: string } | null): string | null {
  const text = info.userInfo?.text;
  if (typeof text === "string" && text.trim()) return text.trim();
  const url = info.userInfo?.url;
  if (typeof url === "string" && parseUrl) return parseUrl(url)?.text ?? null;
  return null;
}

export function donateShortcut(phrase: Pick<SiriPhrase, "label" | "text" | "activityType" | "suggestedPhrase">): void {
  const mod = getSiriModule();
  if (!mod) return;
  mod.donateShortcut(buildShortcutOptions(phrase));
}

export function donateAllShortcuts(phrases: SiriPhrase[]): void {
  const mod = getSiriModule();
  if (!mod) return;
  mod.suggestShortcuts(phrases.map(buildShortcutOptions));
}

export async function getInitialSiriShortcut(): Promise<ShortcutInfo | null> {
  const mod = getSiriModule();
  if (!mod?.getInitialShortcut) return null;
  try {
    return await mod.getInitialShortcut();
  } catch {
    return null;
  }
}

export function addSiriShortcutListener(callback: (info: ShortcutInfo) => void): (() => void) | null {
  const mod = getSiriModule();
  if (!mod?.addShortcutListener) return null;
  const sub = mod.addShortcutListener(callback);
  return () => sub.remove();
}

export function getAddToSiriButton(): SiriModule["AddToSiriButton"] | null {
  return getSiriModule()?.AddToSiriButton ?? null;
}

export function getSiriButtonStyle(): number {
  const mod = getSiriModule();
  return mod?.SiriButtonStyles?.automaticOutline ?? 5;
}
