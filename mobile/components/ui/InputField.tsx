import { useState } from "react";
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
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";

type Props = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
  /** Show eye toggle for secure fields. Default: true when secureTextEntry is set. */
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
  const [revealed, setRevealed] = useState(false);
  const canReveal = !!secureTextEntry && allowReveal !== false;

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, canReveal && styles.inputWithToggle, style]}
          placeholderTextColor={Colors.textMuted}
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
              color={Colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 },
  inputRow: { position: "relative" },
  input: {
    backgroundColor: Colors.cardElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
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
});
