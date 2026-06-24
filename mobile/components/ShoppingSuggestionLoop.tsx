import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import * as Speech from "expo-speech";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Shadow, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import {
  parseShoppingSuggestionResponse,
  type ShoppingSuggestion,
} from "@/utils/shoppingSuggestionVoice";

const LISTEN_MS = 2000;

type Props = {
  suggestion: ShoppingSuggestion | null;
  onAccepted: (item: string) => void;
  onDismiss: () => void;
};

export function ShoppingSuggestionLoop({ suggestion, onAccepted, onDismiss }: Props) {
  const { t, locale } = useI18n();
  const [listening, setListening] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const activeRef = useRef(false);

  const finish = useCallback((accepted: boolean) => {
    activeRef.current = false;
    setListening(false);
    if (accepted && suggestion?.suggestedItem) onAccepted(suggestion.suggestedItem);
    else onDismiss();
  }, [onAccepted, onDismiss, suggestion?.suggestedItem]);

  const startQuickListen = useCallback(async () => {
    if (!activeRef.current) return;
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setListening(true);

      await new Promise((resolve) => setTimeout(resolve, LISTEN_MS));

      if (!recordingRef.current) return;
      setListening(false);
      setProcessing(true);
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri || !activeRef.current) {
        finish(false);
        return;
      }

      const result = await api.transcribeVoice(uri);
      const decision = parseShoppingSuggestionResponse(result?.text || "");
      finish(decision === "accept");
    } catch {
      finish(false);
    } finally {
      setProcessing(false);
    }
  }, [finish]);

  useEffect(() => {
    if (!suggestion?.hasSuggestion) return;
    activeRef.current = true;

    const run = async () => {
      await new Promise<void>((resolve) => {
        Speech.speak(suggestion.speechText, {
          language: locale === "en" ? "en-US" : "tr-TR",
          onDone: () => resolve(),
          onStopped: () => resolve(),
          onError: () => resolve(),
        });
      });

      if (!activeRef.current) return;
      await startQuickListen();
    };

    run();
    return () => {
      activeRef.current = false;
      Speech.stop();
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, [suggestion?.suggestedItem, suggestion?.speechText, locale, startQuickListen]);

  useEffect(() => {
    if (!listening) {
      pulse.setValue(1);
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 500, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse, glow]);

  if (!suggestion?.hasSuggestion) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.label}>{t.shopping.predictiveTitle}</Text>
      <Text style={styles.text}>{suggestion.speechText}</Text>
      {(listening || processing) && (
        <View style={styles.micRow}>
          {listening ? (
            <Animated.View
              style={[
                styles.pulseRing,
                { opacity: glow, transform: [{ scale: pulse }] },
              ]}
            />
          ) : null}
          <Animated.View style={{ transform: [{ scale: listening ? pulse : 1 }] }}>
            <View style={[styles.micBtn, listening && Shadow.glowStrong]}>
              <Ionicons name="mic" size={18} color={Colors.bg} />
            </View>
          </Animated.View>
          <Text style={styles.hint}>
            {processing ? t.shopping.predictiveProcessing : t.shopping.predictiveListening}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: Colors.accentSoft,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
  },
  label: { color: Colors.accent, fontSize: 12, fontWeight: "700", marginBottom: 4 },
  text: { color: Colors.text, fontSize: 15, lineHeight: 22 },
  micRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.sm },
  pulseRing: {
    position: "absolute",
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentGlow,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
  },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  hint: { color: Colors.textMuted, fontSize: 12, flex: 1 },
});
