import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Shadow, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { getPremiumStatus } from "@/services/premium";
import { track } from "@/services/analytics";
import { hapticImpact, hapticSelection } from "@/utils/haptics";

interface Props {
  onResult: (text: string, parsed?: any) => void;
  onAudioCaptured?: (uri: string) => Promise<void>;
  whisperMode?: boolean;
  disabled?: boolean;
  compact?: boolean;
  holdToRecord?: boolean;
  autoRecord?: boolean;
}

export function VoiceInput({
  onResult,
  onAudioCaptured,
  whisperMode = false,
  disabled = false,
  compact = false,
  holdToRecord = false,
  autoRecord = false,
}: Props) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      glow.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.12, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse, glow]);

  useEffect(() => {
    if (!autoRecord || disabled || recording || processing) return;
    startRecording();
  }, [autoRecord, disabled]);

  const startRecording = async () => {
    if (disabled) {
      Alert.alert(t.input.aiUnavailable);
      return;
    }
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(true);
      hapticImpact("medium");
    } catch {
      hapticImpact("error");
      Alert.alert(t.input.micPermission);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setRecording(false);
    setProcessing(true);
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) {
        if (onAudioCaptured) {
          await onAudioCaptured(uri);
          return;
        }
        const premium = await getPremiumStatus();
        if (premium.is_premium) {
          track("premium_voice_command");
          const result = await api.processPremiumVoice(uri, whisperMode);
          if (result?.status === "needs_confirmation" || result?.status === "easter_egg") {
            onResult(result.transcript || result.parsed?.raw_text || "", result);
          } else {
            onResult(result.transcript || result.parsed?.raw_text || "", result);
            Alert.alert(t.premium.title, result.message || t.input.voiceSaved);
          }
        } else {
          const result = await api.parseVoice(uri, whisperMode);
          onResult(result.parsed?.raw_text || result.message, result);
        }
        hapticImpact("success");
      }
    } catch {
      hapticImpact("error");
      Alert.alert(t.common.error, t.input.voiceFailed);
    } finally {
      setProcessing(false);
    }
  };

  const handlePress = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  const hint = processing
    ? t.input.processing
    : recording
      ? t.input.listeningStop
      : holdToRecord
        ? t.input.holdToRecord
        : whisperMode
          ? t.input.whisperMode
          : t.input.voiceCommand;

  const btnSize = compact ? 48 : 72;
  const iconSize = compact ? 22 : 28;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {recording ? (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: btnSize + 24,
              height: btnSize + 24,
              borderRadius: (btnSize + 24) / 2,
              opacity: glow,
              transform: [{ scale: pulse }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={{ transform: [{ scale: recording ? pulse : 1 }] }}>
        <Pressable
          style={[
            styles.micBtn,
            { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
            recording && styles.micActive,
            disabled && styles.micDisabled,
            recording && Shadow.glowStrong,
          ]}
          onPress={holdToRecord ? undefined : handlePress}
          onPressIn={holdToRecord ? () => { if (!processing && !disabled && !recording) startRecording(); } : undefined}
          onPressOut={holdToRecord ? () => { if (recording) stopRecording(); } : undefined}
          disabled={processing || disabled}
          accessibilityRole="button"
          accessibilityLabel={recording ? t.input.listeningStop : t.input.voiceCommand}
          accessibilityState={{ busy: processing, disabled: processing || disabled }}
        >
          {processing ? (
            <ActivityIndicator color={Colors.bg} />
          ) : (
            <Ionicons name={recording ? "stop" : "mic"} size={iconSize} color={Colors.bg} />
          )}
        </Pressable>
      </Animated.View>
      {!compact && <Text style={[styles.hint, recording && styles.hintActive]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: Spacing.md, justifyContent: "center" },
  pulseRing: {
    position: "absolute",
    backgroundColor: Colors.accentGlow,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
  },
  micBtn: {
    backgroundColor: Colors.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  micActive: { backgroundColor: Colors.danger },
  micDisabled: { opacity: 0.4 },
  compact: { padding: 0 },
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
  hintActive: { color: Colors.danger, fontWeight: "600" },
});
