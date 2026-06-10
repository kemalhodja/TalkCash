import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

interface Props {
  onResult: (data: any) => void;
  onClose: () => void;
}

export function ReceiptScanner({ onResult, onClose }: Props) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<CameraView>(null);

  const processImage = async (uri: string) => {
    setScanning(true);
    setError("");
    try {
      const result = await api.scanReceipt(uri);
      onResult(result);
    } catch (e: any) {
      setError(e.message || t.scanner.scanFailed);
    } finally {
      setScanning(false);
    }
  };

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      setError(t.scanner.cameraPermission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processImage(result.assets[0].uri);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>{t.scanner.cameraPermission}</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>{t.scanner.grantPermission}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || scanning) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (photo?.uri) await processImage(photo.uri);
    } catch (e: any) {
      setError(e.message || t.scanner.scanFailed);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.controls}>
        <TouchableOpacity onPress={onClose}><Text style={styles.btnText}>{t.common.close}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} disabled={scanning}>
          {scanning ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.captureText}>📷</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFromGallery} disabled={scanning}>
          <Text style={styles.btnText}>{t.scanner.pickGallery}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  controls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: Spacing.lg },
  btnText: { color: Colors.text, fontSize: 14 },
  captureBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent, justifyContent: "center", alignItems: "center" },
  captureText: { fontSize: 28 },
  text: { color: Colors.text, textAlign: "center", marginTop: 100 },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, margin: Spacing.lg, alignItems: "center" },
  error: { color: Colors.danger, textAlign: "center", padding: Spacing.sm },
});
