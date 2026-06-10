import { useEffect } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { auth } from "@/services/auth";
import { parseAssistantUrl, storePendingAssistant } from "@/services/assistant";

export function useAssistantLinking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const handleUrl = async (url: string) => {
      const params = parseAssistantUrl(url);
      if (!params) return;

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
    };

    Linking.getInitialURL().then((url) => { if (url) handleUrl(url); });
    const sub = Linking.addEventListener("url", ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [enabled]);
}
