import { StyleProp, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";

type Props = TextInputProps & {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export function InputField({ label, containerStyle, style, ...props }: Props) {
  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, style]}
        placeholderTextColor={Colors.textMuted}
        accessibilityLabel={label || props.placeholder}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: Spacing.sm },
  label: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", marginBottom: 6, letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.cardElevated,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 15,
  },
});
