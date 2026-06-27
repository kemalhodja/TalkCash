import { useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Radius, Spacing } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";

type Action = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
};

export function QuickActionGrid({ actions }: { actions: Action[] }) {
  const { colors, shadow } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
        btn: {
          flex: 1,
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          paddingVertical: Spacing.md + 2,
          paddingHorizontal: Spacing.sm,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.border,
          overflow: "hidden",
          minHeight: 88,
          justifyContent: "center",
          ...shadow.card,
        },
        btnPrimary: {
          backgroundColor: colors.accentSoft,
          borderColor: colors.borderStrong,
          ...shadow.glow,
        },
        iconWrap: {
          width: 42,
          height: 42,
          borderRadius: 21,
          backgroundColor: colors.accentSoft,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        },
        iconWrapPrimary: { backgroundColor: colors.accent },
        label: { color: colors.textSecondary, fontSize: 12, fontWeight: "600", textAlign: "center", lineHeight: 16 },
        labelPrimary: { color: colors.accent },
        primaryGlow: {
          position: "absolute",
          top: -24,
          right: -24,
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: colors.accentGlow,
          opacity: 0.35,
        },
      }),
    [colors, shadow],
  );

  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.key}
          style={[styles.btn, a.primary && styles.btnPrimary]}
          onPress={a.onPress}
          activeOpacity={0.82}
        >
          <View style={[styles.iconWrap, a.primary && styles.iconWrapPrimary]}>
            <Ionicons name={a.icon} size={20} color={a.primary ? colors.bgElevated : colors.accent} />
          </View>
          <Text style={[styles.label, a.primary && styles.labelPrimary]} numberOfLines={2}>
            {a.label}
          </Text>
          {a.primary ? <View style={styles.primaryGlow} /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}
