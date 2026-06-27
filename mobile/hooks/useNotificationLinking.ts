import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

const ROUTE_MAP: Record<string, string> = {
  "/agenda": "/agenda",
  "/budget": "/budgets",
  "/budgets": "/budgets",
  "/settings": "/(tabs)/settings",
  "/input": "/(tabs)/input",
  "/insights": "/(tabs)/insights",
  "/transactions": "/(tabs)/transactions",
  "/": "/",
  "/notifications": "/notifications",
};

export function navigateFromMetadata(metadata?: { route?: string }) {
  const route = metadata?.route || "/notifications";
  const target = ROUTE_MAP[route] || "/notifications";
  router.push(target as any);
}

function handlePushData(data?: Record<string, unknown>) {
  if (!data) return;
  if (data.route) {
    navigateFromMetadata({ route: String(data.route) });
    return;
  }
  const url = data.url as string | undefined;
  if (!url) return;
  if (url.includes("agenda")) router.push("/agenda");
  else if (url.includes("budget")) router.push("/budgets");
  else if (url.includes("input") || url.includes("quick-voice")) router.push("/(tabs)/input");
  else if (url.includes("insights")) router.push("/(tabs)/insights");
  else if (url.includes("settings")) router.push("/(tabs)/settings");
  else if (url.includes("home")) router.push("/");
}

export function useNotificationLinking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => handlePushData(response?.notification.request.content.data as Record<string, unknown>))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushData(response.notification.request.content.data as Record<string, unknown>);
    });

    return () => sub.remove();
  }, [enabled]);
}
