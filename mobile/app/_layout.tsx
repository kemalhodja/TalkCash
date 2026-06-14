import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";
import { I18nProvider } from "@/i18n";
import { auth } from "@/services/auth";
import { useAssistantLinking } from "@/hooks/useAssistantLinking";
import { useNotificationLinking } from "@/hooks/useNotificationLinking";
import { useAppLock } from "@/hooks/useAppLock";

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useAppLock();
  useEffect(() => {
    auth.getUser().then((user) => {
      if (!user) {
        router.replace("/login");
      } else if (!auth.isUnlocked()) {
        router.replace("/lock");
      }
      setReady(true);
    });
  }, []);

  useAssistantLinking(ready);
  useNotificationLinking(ready);

  if (!ready) return null;

  return (
    <I18nProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
          contentStyle: { backgroundColor: Colors.bg },
        }}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="command" options={{ headerShown: false, title: "Assistant" }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="receipts" />
      </Stack>
    </I18nProvider>
  );
}
