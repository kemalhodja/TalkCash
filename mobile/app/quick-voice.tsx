import { useCallback, useState } from "react";

import { Alert, StyleSheet, Text, View } from "react-native";

import { Stack, router, useLocalSearchParams } from "expo-router";

import * as Notifications from "expo-notifications";

import { VoiceInput } from "@/components/VoiceInput";

import { ScreenShell } from "@/components/ui/ScreenShell";

import { Colors, Spacing, Typography } from "@/constants/theme";

import { useI18n } from "@/i18n";

import { useRequireUnlock } from "@/hooks/useRequireUnlock";

import { api } from "@/services/api";

import { scheduleSubscriptionReminder } from "@/services/notifications";

import { playExpenseFeedback } from "@/utils/voiceAlert";



export default function QuickVoiceScreen() {

  const { t, locale } = useI18n();

  useRequireUnlock();

  const params = useLocalSearchParams<{ hold?: string; source?: string }>();

  const holdMode = params.hold === "1" || params.source === "widget" || params.source === "tile";

  const [busy, setBusy] = useState(false);



  const handleAudio = useCallback(async (uri: string) => {

    setBusy(true);

    try {

      const res = await api.quickVoice(uri);

      if (res.status === "needs_confirmation") {

        router.replace(`/(tabs)/input?text=${encodeURIComponent(res.transcript || "")}`);

        return;

      }

      if (res.notification_title) {

        await Notifications.scheduleNotificationAsync({

          content: {

            title: res.notification_title,

            body: res.notification_body || "",

          },

          trigger: null,

        });

      }

      if (res.result?.subscription?.next_billing_date && res.result?.subscription?.subscription_name) {

        await scheduleSubscriptionReminder(

          res.result.subscription.subscription_name,

          Number(res.result?.amount || 0),

          new Date(res.result.subscription.next_billing_date),

          locale,

        );

      }

      playExpenseFeedback(res, locale);

      if (holdMode) {

        router.replace("/(tabs)");

      } else {

        Alert.alert(res.notification_title || t.quickVoice.done, res.notification_body || t.quickVoice.hint);

        router.back();

      }

    } catch (e: any) {

      Alert.alert(t.common.error, e.message || t.common.error);

    } finally {

      setBusy(false);

    }

  }, [holdMode, locale, t]);



  return (

    <ScreenShell bottomInset={false}>

      <Stack.Screen options={{ title: t.quickVoice.title, headerStyle: { backgroundColor: Colors.bg }, headerTintColor: Colors.text }} />

      <View style={styles.wrap}>

        <Text style={styles.hint}>{holdMode ? t.quickVoice.holdHint : t.quickVoice.hint}</Text>

        <VoiceInput

          holdToRecord={holdMode}

          whisperMode

          onResult={() => {}}

          onAudioCaptured={handleAudio}

          disabled={busy}

        />

      </View>

    </ScreenShell>

  );

}



const styles = StyleSheet.create({

  wrap: { flex: 1, padding: Spacing.lg, justifyContent: "center", gap: Spacing.lg },

  hint: { ...Typography.body, color: Colors.textSecondary, textAlign: "center", lineHeight: 22 },

});


