import { useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import { auth } from "@/services/auth";

interface Props {
  onResult: (data: any) => void;
  onClose: () => void;
}

export function ReceiptScanner({ onResult, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Kamera izni gerekli</Text>
        <TouchableOpacity style={styles.btn} onPress={requestPermission}>
          <Text style={styles.btnText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const takePhoto = async () => {
    if (!cameraRef.current || scanning) return;
    setScanning(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      const user = await auth.getUser();
      if (photo?.uri && user) {
        const result = await api.scanReceipt(photo.uri, user.userId);
        onResult(result);
      }
    } catch {
      alert("Fiş taranamadı. Tekrar deneyin.");
    } finally {
      setScanning(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.btnText}>Kapat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.captureBtn} onPress={takePhoto} disabled={scanning}>
          {scanning ? <ActivityIndicator color={Colors.bg} /> : <Text style={styles.captureText}>📷</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  controls: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", padding: Spacing.lg },
  closeBtn: { padding: Spacing.md },
  btnText: { color: Colors.text, fontSize: 16 },
  captureBtn: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.accent, justifyContent: "center", alignItems: "center",
  },
  captureText: { fontSize: 28 },
  text: { color: Colors.text, textAlign: "center", marginTop: 100 },
  btn: { backgroundColor: Colors.accent, padding: Spacing.md, borderRadius: 10, margin: Spacing.lg, alignItems: "center" },
});
