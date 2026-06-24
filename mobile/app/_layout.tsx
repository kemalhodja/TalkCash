import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Colors } from "@/constants/theme";
import { I18nProvider } from "@/i18n";
import { auth } from "@/services/auth";
import { api } from "@/services/api";
import { useAssistantLinking } from "@/hooks/useAssistantLinking";
import { useNotificationLinking } from "@/hooks/useNotificationLinking";
import { useAppLock } from "@/hooks/useAppLock";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initObservability } from "@/services/observability";
import { initLocalDb } from "@/services/localDb";

initObservability();
initLocalDb();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState<string | null>(null);
  useAppLock();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await auth.getUser();
        if (cancelled) return;
        if (!user) {
          setInitialRoute("/login");
          return;
        }

        try {
          const me = await api.getMe();
          if (cancelled) return;
          if (typeof me.has_pin === "boolean" && me.has_pin !== user.hasPin) {
            await auth.updateUser({ hasPin: me.has_pin });
            user.hasPin = me.has_pin;
          }
        } catch {
          /* offline — use cached user */
        }

        if (user.hasPin && !auth.isUnlocked()) {
          setInitialRoute("/lock");
        } else {
          if (!user.hasPin) auth.setUnlocked(true);
          setInitialRoute("/(tabs)");
        }
      } catch {
        if (!cancelled) setInitialRoute("/login");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (ready && initialRoute) {
      router.replace(initialRoute as any);
    }
  }, [ready, initialRoute]);

  useAssistantLinking(ready);
  useNotificationLinking(ready);

  return (
    <ErrorBoundary>
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
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="lock" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="command" options={{ headerShown: false, title: "Assistant" }} />
        <Stack.Screen name="share" options={{ headerShown: false, title: "Share" }} />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="notification-settings" />
        <Stack.Screen name="receipts" />
      </Stack>
      {!ready ? (
        <View style={styles.loadingOverlay}>
          <LoadingScreen />
        </View>
      ) : null}
    </I18nProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.bg,
  },
});
