import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";

interface Props {
  onResult: (text: string, parsed?: any) => void;
  whisperMode?: boolean;
}

export function VoiceInput({ onResult, whisperMode = false }: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = rec;
      setRecording(true);
    } catch {
      alert("Mikrofon izni gerekli");
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
      onResult("Ses işlenemedi. Lütfen tekrar deneyin.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePress = () => {
    if (recording) stopRecording();
    else startRecording();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.micBtn, recording && styles.micActive]}
        onPress={handlePress}
        disabled={processing}
      >
        {processing ? (
          <ActivityIndicator color={Colors.bg} />
        ) : (
          <Ionicons name={recording ? "stop" : "mic"} size={28} color={Colors.bg} />
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>
        {processing ? "İşleniyor..." : recording ? "Dinleniyor — durdurmak için dokunun" : whisperMode ? "Fısıltı Modu" : "Sesli Komut"}
      </Text>
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
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: Spacing.sm, textAlign: "center" },
});
