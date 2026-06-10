import { useEffect, useState } from "react";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";
import { I18nProvider } from "@/i18n";
import { auth } from "@/services/auth";

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    auth.getUser().then((user) => {
      if (!user) {
        router.replace("/login");
      } else if (!user.hasPin) {
        router.replace("/lock");
      }
      setReady(true);
    });
  }, []);

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
        <Stack.Screen name="lock" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="receipts" />
      </Stack>
    </I18nProvider>
  );
}
