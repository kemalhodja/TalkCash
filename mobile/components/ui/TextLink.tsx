import { StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity } from "react-native";
import { Colors } from "@/constants/theme";

type Props = {
  label: string;
  onPress: () => void;
  danger?: boolean;
  style?: StyleProp<TextStyle>;
};

export function TextLink({ label, onPress, danger, style }: Props) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.link, danger && styles.danger, style]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  link: { color: Colors.accent, fontWeight: "600", fontSize: 13 },
  danger: { color: Colors.danger },
});
