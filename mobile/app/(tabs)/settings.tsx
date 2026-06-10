import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";
import { Colors, Spacing } from "@/constants/theme";
import { api } from "@/services/api";
import { auth } from "@/services/auth";
import { setupGeofencing, stopGeofencing } from "@/services/geofencing";
import { registerForPushNotifications } from "@/services/notifications";

export default function SettingsScreen() {
  const [biometric, setBiometric] = useState(false);
  const [geofence, setGeofence] = useState(false);
  const [exporting, setExporting] = useState(false);

  const toggleBiometric = async (val: boolean) => {
    setBiometric(val);
    try { await api.toggleBiometric(val); } catch { /* */ }
  };

  const toggleGeofence = async (val: boolean) => {
    setGeofence(val);
    if (val) await setupGeofencing();
    else await stopGeofencing();
  };

  const handleExport = async (type: "pdf" | "excel") => {
    setExporting(true);
    try {
      const blob = type === "pdf" ? await api.exportPdf() : await api.exportExcel();
      const ext = type === "pdf" ? "pdf" : "xlsx";
      const path = `${FileSystem.cacheDirectory}talkcash-rapor.${ext}`;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(path);
        }
      };
      reader.readAsDataURL(blob);
    } catch {
      Alert.alert("Export", "Rapor oluşturulamadı. Backend bağlantısını kontrol edin.");
    } finally {
      setExporting(false);
    }
  };

  const handleLogout = async () => {
    await auth.clear();
    router.replace("/login");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Ayarlar</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Biyometrik Giriş</Text>
        <Switch value={biometric} onValueChange={toggleBiometric} trackColor={{ true: Colors.accent }} />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Market Geofencing</Text>
        <Switch value={geofence} onValueChange={toggleGeofence} trackColor={{ true: Colors.accent }} />
      </View>

      <TouchableOpacity style={styles.btn} onPress={() => registerForPushNotifications()}>
        <Text style={styles.btnText}>Push Bildirimlerini Etkinleştir</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Dışa Aktar</Text>
      <TouchableOpacity style={styles.btn} onPress={() => handleExport("pdf")} disabled={exporting}>
        <Text style={styles.btnText}>PDF Rapor İndir</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.btn, { marginTop: Spacing.sm }]} onPress={() => handleExport("excel")} disabled={exporting}>
        <Text style={styles.btnText}>Excel Rapor İndir</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Çıkış Yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: Spacing.md },
  title: { color: Colors.text, fontSize: 22, fontWeight: "700", marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.text, fontSize: 16, fontWeight: "600", marginTop: Spacing.lg, marginBottom: Spacing.sm },
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  label: { color: Colors.text, fontSize: 16 },
  btn: { backgroundColor: Colors.card, padding: Spacing.md, borderRadius: 10, alignItems: "center", marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  btnText: { color: Colors.accent, fontWeight: "600" },
  logoutBtn: { marginTop: Spacing.xl, padding: Spacing.md, alignItems: "center" },
  logoutText: { color: Colors.danger, fontWeight: "600" },
});
