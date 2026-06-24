import { useRef, useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";

type Props = {
  visible: boolean;
  onClose: () => void;
  onItems: (items: string[]) => void;
};

export function SmartBasketScanner({ visible, onClose, onItems }: Props) {
  const { t } = useI18n();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const cameraRef = useRef<CameraView>(null);

  const processImage = async (uri: string) => {
    setScanning(true);
    setError("");
    try {
      const result = await api.scanShoppingPhoto(uri);
      if (!result.items?.length) {
        setError(t.shopping.smartBasketEmpty);
        return;
      }
      onItems(result.items);
      onClose();
    } catch (e: any) {
      setError(e.message || t.shopping.smartBasketFailed);
    } finally {
      setScanning(false);
    }
  };

  const capture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) await processImage(photo.uri);
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      await processImage(result.assets[0].uri);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!permission?.granted ? (
          <Surface variant="glass" style={styles.card}>
            <Text style={styles.text}>{t.scanner.cameraPermission}</Text>
            <PrimaryButton label={t.scanner.grantPermission} onPress={requestPermission} />
          </Surface>
        ) : (
          <>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" />
            {scanning ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={Colors.accent} size="large" />
                <Text style={styles.hint}>{t.shopping.smartBasketScanning}</Text>
              </View>
            ) : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.actions}>
              <PrimaryButton label={t.shopping.smartBasketCapture} onPress={capture} disabled={scanning} />
              <PrimaryButton label={t.scanner.pickGallery} onPress={pickFromGallery} variant="secondary" disabled={scanning} />
              <PrimaryButton label={t.common.cancel} onPress={onClose} variant="ghost" />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  camera: { flex: 1 },
  card: { margin: Spacing.lg, padding: Spacing.lg },
  text: { color: Colors.textSecondary, marginBottom: Spacing.md, textAlign: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: Colors.overlay, alignItems: "center", justifyContent: "center" },
  hint: { color: Colors.text, marginTop: Spacing.md },
  error: { color: Colors.danger, textAlign: "center", padding: Spacing.sm },
  actions: { padding: Spacing.lg, gap: Spacing.sm },
});
