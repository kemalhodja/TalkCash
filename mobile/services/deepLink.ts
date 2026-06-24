import * as Linking from "expo-linking";
import { parseAssistantUrl, type AssistantParams } from "./assistant";

export type ShareLinkParams = {
  text: string;
  source: "share" | "sms";
};

export type InputVoiceLinkParams = {
  whisper: boolean;
  hold: boolean;
  source: string;
};

function queryValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return typeof value === "string" ? value : "";
}

export function parseShareUrl(url: string): ShareLinkParams | null {
  try {
    const parsed = Linking.parse(url);
    const segment = (parsed.hostname || parsed.path || "").replace(/^\//, "");
    if (segment !== "share") return null;
    const text = queryValue(parsed.queryParams?.text).trim();
    if (!text) return null;
    const rawSource = queryValue(parsed.queryParams?.source) || "share";
    return { text, source: rawSource === "sms" ? "sms" : "share" };
  } catch {
    return null;
  }
}

export function parseInputVoiceUrl(url: string): InputVoiceLinkParams | null {
  try {
    const parsed = Linking.parse(url);
    const segment = (parsed.hostname || parsed.path || "").replace(/^\//, "");
    if (segment !== "input") return null;
    const qp = parsed.queryParams ?? {};
    return {
      whisper: queryValue(qp.whisper) === "1" || queryValue(qp.whisper) === "true",
      hold: queryValue(qp.hold) === "1" || queryValue(qp.hold) === "true",
      source: queryValue(qp.source) || "shortcut",
    };
  } catch {
    return null;
  }
}

export function parseQuickVoiceUrl(url: string): boolean {
  try {
    const parsed = Linking.parse(url);
    const segment = (parsed.hostname || parsed.path || "").replace(/^\//, "");
    return segment === "quick-voice";
  } catch {
    return false;
  }
}

export function parseAppDeepLink(
  url: string,
  locale: "tr" | "en" = "tr",
): { kind: "command"; params: AssistantParams } | { kind: "share"; params: ShareLinkParams } | { kind: "input"; params: InputVoiceLinkParams } | { kind: "quick_voice" } | null {
  if (parseQuickVoiceUrl(url)) return { kind: "quick_voice" };
  const command = parseAssistantUrl(url, locale);
  if (command) return { kind: "command", params: command };
  const share = parseShareUrl(url);
  if (share) return { kind: "share", params: share };
  const input = parseInputVoiceUrl(url);
  if (input) return { kind: "input", params: input };
  return null;
}
