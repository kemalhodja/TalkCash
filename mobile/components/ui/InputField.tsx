import { useMemo, useState } from "react";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Radius, Spacing, Touch, Typography } from "@/constants/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { useI18n } from "@/i18n";

type Props = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  allowReveal?: boolean;
};

export function InputField({
  label,
  containerStyle,
  style,
  secureTextEntry,
  allowReveal,
  ...props
}: Props) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const canReveal = !!secureTextEntry && allowReveal !== false;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { marginBottom: Spacing.sm },
        label: { color: colors.textMuted, ...Typography.label, marginBottom: 8, textTransform: "none", letterSpacing: 0.3, fontSize: 12 },
        inputRow: { position: "relative" },
        input: {
          backgroundColor: colors.cardElevated,
          borderRadius: Radius.lg,
          minHeight: Touch.inputHeight,
          paddingVertical: 14,
          paddingHorizontal: Spacing.md,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
          fontSize: 16,
          lineHeight: 22,
        },
        inputWithToggle: {
          paddingRight: Spacing.xl + Spacing.sm,
        },
        revealBtn: {
          position: "absolute",
          right: Spacing.sm,
          top: 0,
          bottom: 0,
          justifyContent: "center",
          paddingHorizontal: Spacing.xs,
        },
      }),
    [colors],
  );

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, canReveal && styles.inputWithToggle, style]}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={label || props.placeholder}
          secureTextEntry={canReveal ? !revealed : secureTextEntry}
          {...props}
        />
        {canReveal ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={revealed ? t.common.hidePassword : t.common.showPassword}
            onPress={() => setRevealed((value) => !value)}
            style={styles.revealBtn}
            hitSlop={8}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
