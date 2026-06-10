import { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

interface Props {
  onResult: (text: string, parsed?: any) => void;
  whisperMode?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

export function VoiceInput({ onResult, whisperMode = false, disabled = false, compact = false }: Props) {
  const { t } = useI18n();
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

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
    } catch {
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
        const result = await api.parseVoice(uri, whisperMode);
        onResult(result.parsed?.raw_text || result.message, result);
      }
    } catch {
      onResult(t.input.voiceFailed);
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
      : whisperMode
        ? t.input.whisperMode
        : t.input.voiceCommand;

  const btnSize = compact ? 48 : 64;
  const iconSize = compact ? 22 : 28;

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <TouchableOpacity
        style={[styles.micBtn, { width: btnSize, height: btnSize, borderRadius: btnSize / 2 }, recording && styles.micActive, disabled && styles.micDisabled]}
        onPress={handlePress}
        disabled={processing || disabled}
      >
        {processing ? (
          <ActivityIndicator color={Colors.bg} />
        ) : (
          <Ionicons name={recording ? "stop" : "mic"} size={iconSize} color={Colors.bg} />
        )}
      </TouchableOpacity>
      {!compact && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", padding: Spacing.md },
  micBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.accent, justifyContent: "center", alignItems: "center",
  },
  micActive: { backgroundColor: Colors.danger },
  micDisabled: { opacity: 0.4 },
  compact: { padding: 0, alignItems: "center", justifyContent: "center" },
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
});
