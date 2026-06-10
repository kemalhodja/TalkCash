import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { auth } from "@/services/auth";
import { parseAssistantUrl, storePendingAssistant, type AssistantParams } from "@/services/assistant";
import {
  addSiriShortcutListener,
  getInitialSiriShortcut,
  shortcutInfoToText,
} from "@/services/siriShortcuts";

async function routeAssistantCommand(params: AssistantParams) {
  const user = await auth.getUser();
  if (!user) {
    await storePendingAssistant(params);
    router.push("/login");
    return;
  }
  if (!auth.isUnlocked()) {
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

export function useAssistantLinking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleUrl = async (url: string) => {
      const params = parseAssistantUrl(url);
      if (!params) return;
      await routeAssistantCommand(params);
    };

    const handleSiriShortcut = async (info: { activityType: string; userInfo?: Record<string, unknown> }) => {
      const text = shortcutInfoToText(info, parseAssistantUrl);
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
