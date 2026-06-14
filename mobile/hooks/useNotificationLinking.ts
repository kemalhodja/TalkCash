import { useEffect } from "react";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";

const ROUTE_MAP: Record<string, string> = {
  "/agenda": "/agenda",
  "/budget": "/budget",
  "/": "/",
  "/notifications": "/notifications",
};

export function navigateFromMetadata(metadata?: { route?: string }) {
  const route = metadata?.route || "/notifications";
  const target = ROUTE_MAP[route] || "/notifications";
  router.push(target as any);
}

function handlePushUrl(url?: string) {
  if (!url) return;
  if (url.includes("agenda")) router.push("/agenda");
  else if (url.includes("budget")) router.push("/budget");
  else if (url.includes("home")) router.push("/");
}

export function useNotificationLinking(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    Notifications.getLastNotificationResponseAsync()
      .then((response) => handlePushUrl(response?.notification.request.content.data?.url as string))
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handlePushUrl(response.notification.request.content.data?.url as string);
    });

    return () => sub.remove();
  }, [enabled]);
}
