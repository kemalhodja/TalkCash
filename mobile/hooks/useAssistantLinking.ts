import { useEffect } from "react";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";
import { router } from "expo-router";
import { auth } from "@/services/auth";
import { parseAppDeepLink } from "@/services/deepLink";
import { parseAssistantUrl, storePendingAssistant, type AssistantParams } from "@/services/assistant";
import {
  addSiriShortcutListener,
  getInitialSiriShortcut,
  shortcutInfoToText,
} from "@/services/siriShortcuts";

const PENDING_SHARE_KEY = "talkcash_pending_share";
const PENDING_INPUT_KEY = "talkcash_pending_input";
const PENDING_QUICK_VOICE_KEY = "talkcash_pending_quick_voice";
const PENDING_WORKSPACE_INVITE_KEY = "talkcash_pending_workspace_invite";

export async function storePendingShare(text: string): Promise<void> {
  await SecureStore.setItemAsync(PENDING_SHARE_KEY, text);
}

export async function consumePendingShare(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(PENDING_SHARE_KEY);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(PENDING_SHARE_KEY);
  return raw;
}

async function routeAssistantCommand(params: AssistantParams) {
  const user = await auth.getUser();
  if (!user) {
    await storePendingAssistant(params);
    router.push("/login");
    return;
  }
  if (user.hasPin && !auth.isUnlocked()) {
    await storePendingAssistant(params);
    router.push("/lock");
    return;
  }

  const qs = new URLSearchParams({
    text: params.text,
    confirm: params.confirm ? "true" : "false",
    source: params.source,
  });
  router.push(`/command?${qs.toString()}`);
}

async function routeShareText(text: string) {
  const user = await auth.getUser();
  if (!user) {
    await storePendingShare(text);
    router.push("/login");
    return;
  }
  if (user.hasPin && !auth.isUnlocked()) {
    await storePendingShare(text);
    router.push("/lock");
    return;
  }
  router.push(`/share?text=${encodeURIComponent(text)}&source=share`);
}

async function routeQuickVoice() {
  const user = await auth.getUser();
  if (!user) {
    router.push("/login");
    return;
  }
  if (user.hasPin && !auth.isUnlocked()) {
    await SecureStore.setItemAsync(PENDING_QUICK_VOICE_KEY, "1");
    router.push("/lock");
    return;
  }
  router.push("/quick-voice?hold=1");
}

async function routeInputVoice(params: { whisper: boolean; hold: boolean; smsPaste?: boolean }) {
  const user = await auth.getUser();
  if (!user) {
    await SecureStore.setItemAsync(PENDING_INPUT_KEY, JSON.stringify(params));
    router.push("/login");
    return;
  }
  if (user.hasPin && !auth.isUnlocked()) {
    await SecureStore.setItemAsync(PENDING_INPUT_KEY, JSON.stringify(params));
    router.push("/lock");
    return;
  }
  const qs = new URLSearchParams({
    whisper: params.whisper ? "1" : "0",
    hold: params.hold ? "1" : "0",
  });
  if (params.smsPaste) qs.set("sms", "1");
  router.push(`/(tabs)/input?${qs.toString()}`);
}

async function routeWorkspaceInvite(token: string) {
  const user = await auth.getUser();
  if (!user) {
    await SecureStore.setItemAsync(PENDING_WORKSPACE_INVITE_KEY, token);
    router.push("/login");
    return;
  }
  if (user.hasPin && !auth.isUnlocked()) {
    await SecureStore.setItemAsync(PENDING_WORKSPACE_INVITE_KEY, token);
    router.push("/lock");
    return;
  }
  router.push(`/(tabs)/workspaces?accept=${encodeURIComponent(token)}`);
}

export function useAssistantLinking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleUrl = async (url: string) => {
      const savedLocale = await SecureStore.getItemAsync("talkcash_locale");
      const locale = savedLocale === "en" ? "en" : "tr";
      const parsed = parseAppDeepLink(url, locale);
      if (!parsed) return;
      if (parsed.kind === "command") await routeAssistantCommand(parsed.params);
      else if (parsed.kind === "share") await routeShareText(parsed.params.text);
      else if (parsed.kind === "quick_voice") await routeQuickVoice();
      else if (parsed.kind === "reset_password") {
        router.push({ pathname: "/reset-password", params: { token: parsed.token } });
      } else if (parsed.kind === "workspace_invite") {
        await routeWorkspaceInvite(parsed.params.token);
      } else await routeInputVoice(parsed.params);
    };

    const handleSiriShortcut = async (info: { activityType: string; userInfo?: Record<string, unknown> }) => {
      const savedLocale = await SecureStore.getItemAsync("talkcash_locale");
      const siriLocale = savedLocale === "en" ? "en" : "tr";
      const text = shortcutInfoToText(info, (url) => parseAssistantUrl(url, siriLocale));
      if (!text) return;
      await routeAssistantCommand({ text, confirm: false, source: "siri" });
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const urlSub = Linking.addEventListener("url", ({ url }) => handleUrl(url));

    getInitialSiriShortcut().then((info) => { if (info) handleSiriShortcut(info); });
    const removeSiri = addSiriShortcutListener(handleSiriShortcut);

    return () => {
      urlSub.remove();
      removeSiri?.();
    };
  }, [enabled]);
}

export async function consumePendingQuickVoice(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(PENDING_QUICK_VOICE_KEY);
  if (!raw) return false;
  await SecureStore.deleteItemAsync(PENDING_QUICK_VOICE_KEY);
  return true;
}

export async function consumePendingInputVoice(): Promise<{ whisper: boolean; hold: boolean; smsPaste?: boolean } | null> {
  const raw = await SecureStore.getItemAsync(PENDING_INPUT_KEY);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(PENDING_INPUT_KEY);
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function consumePendingWorkspaceInvite(): Promise<string | null> {
  const raw = await SecureStore.getItemAsync(PENDING_WORKSPACE_INVITE_KEY);
  if (!raw) return null;
  await SecureStore.deleteItemAsync(PENDING_WORKSPACE_INVITE_KEY);
  return raw;
}
