import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Spacing } from "@/constants/theme";

interface Props {
  onResult: (text: string) => void;
  whisperMode?: boolean;
}

export function VoiceInput({ onResult, whisperMode = false }: Props) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handlePress = async () => {
    if (recording) {
      setRecording(false);
      setProcessing(true);
      // Gerçek uygulamada expo-av ile kayıt yapılıp API'ye gönderilir
      setTimeout(() => {
        onResult("150 TL kahve Starbucks");
        setProcessing(false);
      }, 1500);
    } else {
      setRecording(true);
    }
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
        {processing ? "İşleniyor..." : recording ? "Dinleniyor..." : whisperMode ? "Fısıltı Modu" : "Sesli Komut"}
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
  hint: { color: Colors.textMuted, fontSize: 13, marginTop: Spacing.sm },
});
