import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Radius, Shadow, Spacing } from "@/constants/theme";
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
      setError(t.scanner.galleryPermission);
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
        <Surface variant="glass" style={styles.permissionCard}>
          <Text style={styles.text}>{t.scanner.cameraPermission}</Text>
          <PrimaryButton label={t.scanner.grantPermission} onPress={requestPermission} />
        </Surface>
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
      <Surface variant="glass" style={styles.controls}>
        <TouchableOpacity onPress={onClose}><Text style={styles.btnText}>{t.common.close}</Text></TouchableOpacity>
        <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} disabled={scanning} activeOpacity={0.85}>
          {scanning ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.captureText}>📷</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={pickFromGallery} disabled={scanning}>
          <Text style={styles.btnText}>{t.scanner.pickGallery}</Text>
        </TouchableOpacity>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  permissionCard: { margin: Spacing.lg, padding: Spacing.xl, alignItems: "center", gap: Spacing.md },
  controls: {
    flexDirection: "row", justifyContent: "space-around", alignItems: "center",
    padding: Spacing.lg, borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
  },
  btnText: { color: Colors.textSecondary, fontSize: 14, fontWeight: "600" },
  captureBtn: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.accent,
    justifyContent: "center", alignItems: "center", ...Shadow.glow,
  },
  captureText: { fontSize: 28 },
  text: { color: Colors.text, textAlign: "center", lineHeight: 22 },
  error: { color: Colors.danger, textAlign: "center", padding: Spacing.sm, backgroundColor: Colors.overlay },
});
