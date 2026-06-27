import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { I18nProvider } from "@/i18n";
import { ThemeProvider, useTheme } from "@/theme/ThemeProvider";
import { auth } from "@/services/auth";
import { api } from "@/services/api";
import { useAssistantLinking } from "@/hooks/useAssistantLinking";
import { useNotificationLinking } from "@/hooks/useNotificationLinking";
import { useAppLock } from "@/hooks/useAppLock";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initObservability } from "@/services/observability";
import { initLocalDb } from "@/services/localDb";
import { initRevenueCat, isRevenueCatConfigured } from "@/services/revenueCat";

initObservability();
initLocalDb();
if (isRevenueCatConfigured()) {
  void initRevenueCat();
}

function waitForNavigationPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function RootNavigator({ bootPhase }: { bootPhase: "loading" | "ready" }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1, backgroundColor: colors.bg },
        bootOverlay: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor: colors.bg,
          zIndex: 100,
        },
      }),
    [colors.bg],
  );

  useAssistantLinking(bootPhase === "ready");
  useNotificationLinking(bootPhase === "ready");

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} backgroundColor={colors.bg} translucent={false} />
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.bg },
            animation: "fade",
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
          <Stack.Screen name="quick-voice" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="notification-settings" />
          <Stack.Screen name="roadmap" />
          <Stack.Screen name="micro-savings-settings" />
          <Stack.Screen name="receipts" />
          <Stack.Screen name="feature-hub" options={{ title: "Features" }} />
          <Stack.Screen name="account" />
          <Stack.Screen name="feedback" />
          <Stack.Screen name="monthly-report" />
        </Stack>
        {bootPhase === "loading" ? (
          <View style={styles.bootOverlay} pointerEvents="auto">
            <LoadingScreen />
          </View>
        ) : null}
      </View>
    </>
  );
}

export default function RootLayout() {
  const [bootPhase, setBootPhase] = useState<"loading" | "ready">("loading");
  useAppLock();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await auth.getUser();
        if (cancelled) return;

        let route = "/login";
        if (user) {
          if (!(await auth.keepStoredSession())) {
            await auth.clear({ preserveOffline: true });
          } else {
            await auth.restoreSessionState();
            if (isRevenueCatConfigured()) {
              void initRevenueCat(user.userId);
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
              route = "/lock";
            } else {
              if (!user.hasPin) auth.setUnlocked(true);
              route = "/(tabs)";
            }
          }
        }

        router.replace(route as any);
        await waitForNavigationPaint();
        if (!cancelled) setBootPhase("ready");
      } catch {
        if (!cancelled) {
          router.replace("/login");
          await waitForNavigationPaint();
          setBootPhase("ready");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <I18nProvider>
            <RootNavigator bootPhase={bootPhase} />
          </I18nProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
