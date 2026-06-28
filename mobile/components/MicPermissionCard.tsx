import { useMemo, useState } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { Ionicons } from "@expo/vector-icons";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Radius, Spacing, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n";
import { hapticImpact } from "@/utils/haptics";

type Props = {
  onGranted: () => void;
  onSkip?: () => void;
};

export function MicPermissionCard({ onGranted, onSkip }: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [status, setStatus] = useState<"idle" | "denied">("idle");

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { padding: Spacing.lg, alignItems: "center", gap: Spacing.md },
        iconRing: {
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: Spacing.xs,
        },
        title: { color: colors.text, ...Typography.title, fontSize: 18, textAlign: "center" },
        body: { color: colors.textSecondary, ...Typography.body, textAlign: "center", lineHeight: 22 },
        privacy: { color: colors.textMuted, fontSize: 12, textAlign: "center", lineHeight: 18 },
        denied: { color: colors.warning, fontSize: 13, textAlign: "center" },
      }),
    [colors],
  );

  const requestMic = async () => {
    hapticImpact("medium");
    const current = await Audio.getPermissionsAsync();
    if (current.granted) {
      onGranted();
      return;
    }
    const result = await Audio.requestPermissionsAsync();
    if (result.granted) {
      hapticImpact("success");
      onGranted();
      return;
    }
    setStatus("denied");
  };

  return (
    <Surface variant="accent" style={styles.wrap} testID="mic-permission-card">
      <View style={styles.iconRing}>
        <Ionicons name="mic" size={32} color={colors.accent} />
      </View>
      <Text style={styles.title}>{t.onboarding.micPermissionTitle}</Text>
      <Text style={styles.body}>{t.onboarding.micPermissionBody}</Text>
      <Text style={styles.privacy}>{t.onboarding.micPermissionPrivacy}</Text>
      {status === "denied" ? (
        <Text style={styles.denied}>{t.onboarding.micPermissionDenied}</Text>
      ) : null}
      <PrimaryButton label={t.onboarding.micPermissionReady} onPress={requestMic} testID="mic-permission-ready" />
      {status === "denied" ? (
        <PrimaryButton
          label={t.onboarding.micPermissionSettings}
          onPress={() => Linking.openSettings()}
          variant="secondary"
        />
      ) : null}
      {onSkip ? (
        <PrimaryButton label={t.onboarding.micPermissionLater} onPress={onSkip} variant="ghost" testID="mic-permission-later" />
      ) : null}
    </Surface>
  );
}
