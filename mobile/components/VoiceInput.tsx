import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { WHISPER_RECORDING_OPTIONS } from "@/utils/voiceRecording";
import { Ionicons } from "@expo/vector-icons";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { VoiceWaveform } from "@/components/VoiceWaveform";
import { useI18n } from "@/i18n";
import { isPremium } from "@/services/premium";
import { parseVoiceWithOfflineQueue } from "@/services/voiceQueue";
import { track } from "@/services/analytics";
import { captureError } from "@/services/observability";
import { getApiErrorMessage, isRetryableApiError } from "@/utils/apiErrors";
import { hapticImpact, hapticRecordTap, hapticSuccessDouble } from "@/utils/haptics";

interface Props {
  onResult: (text: string, parsed?: any) => void;
  onAudioCaptured?: (uri: string) => Promise<void>;
  whisperMode?: boolean;
  disabled?: boolean;
  compact?: boolean;
  holdToRecord?: boolean;
  autoRecord?: boolean;
}

function normalizeMetering(db: number | undefined): number {
  if (db == null || Number.isNaN(db)) return 0.08;
  return Math.min(1, Math.max(0.08, (db + 55) / 55));
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
  const { colors, shadow } = useTheme();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [meterLevels, setMeterLevels] = useState<number[]>([]);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { alignItems: "center", padding: Spacing.md, justifyContent: "center" },
        pulseRing: {
          position: "absolute",
          backgroundColor: colors.accentGlow,
          borderWidth: 2,
          borderColor: colors.borderStrong,
        },
        micBtn: {
          backgroundColor: colors.accent,
          justifyContent: "center",
          alignItems: "center",
        },
        micActive: { backgroundColor: colors.danger },
        micDisabled: { opacity: 0.4 },
        compact: { padding: 0 },
        hint: { color: colors.textMuted, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
        hintActive: { color: colors.danger, fontWeight: "600" },
      }),
    [colors],
  );

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
    if (!recording || !recordingRef.current) {
      setMeterLevels([]);
      return;
    }
    const timer = setInterval(async () => {
      const rec = recordingRef.current;
      if (!rec) return;
      try {
        const status = await rec.getStatusAsync();
        if (!status.isRecording) return;
        setMeterLevels((prev) => [...prev.slice(-19), normalizeMetering(status.metering)]);
      } catch {
        /* metering optional on some platforms */
      }
    }, 90);
    return () => clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!autoRecord || disabled || recording || processing) return;
    startRecording();
  }, [autoRecord, disabled]);

  const errorCopy = {
    network: t.input.voiceNetworkError,
    timeout: t.input.voiceTimeoutError,
    auth: t.input.voiceAuthError,
    validation: t.input.voiceFailed,
    server: t.input.voiceServerError,
    unknown: t.input.voiceFailed,
  };

  const processRecording = async (uri: string, premium: boolean) => {
    setProcessing(true);
    try {
      if (premium) track("premium_voice_command");
      const result = await parseVoiceWithOfflineQueue(uri, whisperMode, premium);
      if (result?.status === "queued") {
        hapticSuccessDouble();
        Alert.alert(t.common.confirm, t.input.voiceQueuedOffline);
        return;
      }
      if (premium && result?.status !== "needs_confirmation" && result?.status !== "easter_egg" && result?.status !== "success") {
        onResult(result.transcript || result.parsed?.raw_text || "", result);
        Alert.alert(t.premium.title, result.message || t.input.voiceSaved);
      } else {
        onResult(result.transcript || result.parsed?.raw_text || result.message || "", result);
      }
      if (result?.status === "success" || result?.parsed?.intent === "add_expense") {
        hapticSuccessDouble();
      } else {
        hapticImpact("success");
      }
    } catch (err) {
      hapticImpact("error");
      captureError(err, { feature: "voice_input", premium });
      const message = getApiErrorMessage(err, errorCopy);
      if (isRetryableApiError(err)) {
        Alert.alert(t.common.error, message, [
          { text: t.common.cancel, style: "cancel" },
          { text: t.common.retry, onPress: () => { void processRecording(uri, premium); } },
        ]);
      } else {
        Alert.alert(t.common.error, message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const startRecording = async () => {
    if (disabled) {
      Alert.alert(t.input.aiUnavailable);
      return;
    }
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(WHISPER_RECORDING_OPTIONS);
      recordingRef.current = rec;
      setRecording(true);
      setMeterLevels([]);
      hapticRecordTap();
    } catch (err) {
      hapticImpact("error");
      captureError(err, { feature: "voice_input", stage: "record_start" });
      Alert.alert(t.input.micPermission);
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;
    setRecording(false);
    hapticImpact("light");
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (!uri) return;
      if (onAudioCaptured) {
        setProcessing(true);
        try {
          await onAudioCaptured(uri);
        } catch (err) {
          hapticImpact("error");
          captureError(err, { feature: "voice_input", stage: "onAudioCaptured" });
          Alert.alert(t.common.error, getApiErrorMessage(err, errorCopy));
        } finally {
          setProcessing(false);
        }
        return;
      }
      const premium = await isPremium();
      await processRecording(uri, premium);
    } catch (err) {
      hapticImpact("error");
      captureError(err, { feature: "voice_input", stage: "record_stop" });
      Alert.alert(t.common.error, t.input.voiceFailed);
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

  const btnSize = compact ? 48 : 76;
  const iconSize = compact ? 22 : 30;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      {!compact ? (
        <VoiceWaveform levels={meterLevels} active={recording} height={compact ? 32 : 44} />
      ) : null}
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
            recording && shadow.glowStrong,
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
            <ActivityIndicator color={colors.bgElevated} />
          ) : (
            <Ionicons name={recording ? "stop" : "mic"} size={iconSize} color={colors.bgElevated} />
          )}
        </Pressable>
      </Animated.View>
      {!compact && <Text style={[styles.hint, recording && styles.hintActive]}>{hint}</Text>}
    </View>
  );
}
