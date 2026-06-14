import { ReactNode } from "react";
import { StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, Radius, Spacing } from "@/constants/theme";

type Props = {
  title: string;
  subtitle?: string;
  value?: string;
  valueTone?: "default" | "accent" | "danger" | "success";
  icon?: keyof typeof Ionicons.glyphMap;
  iconEmoji?: string;
  trailing?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

const valueColors = {
  default: Colors.text,
  accent: Colors.accent,
  danger: Colors.danger,
  success: Colors.success,
};

export function ListRow({
  title,
  subtitle,
  value,
  valueTone = "default",
  icon,
  iconEmoji,
  trailing,
  onPress,
  onLongPress,
  style,
}: Props) {
  const content = (
    <>
      {(icon || iconEmoji) ? (
        <View style={styles.iconWrap}>
          {iconEmoji ? (
            <Text style={styles.emoji}>{iconEmoji}</Text>
          ) : icon ? (
            <Ionicons name={icon} size={18} color={Colors.accent} />
          ) : null}
        </View>
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {value ? (
        <Text style={[styles.value, { color: valueColors[valueTone] }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {trailing}
    </>
  );

  if (onPress || onLongPress) {
    return (
      <TouchableOpacity
        style={[styles.row, style]}
        onPress={onPress}
        onLongPress={onLongPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.row, style]}>{content}</View>;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.sm,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 18 },
  body: { flex: 1, minWidth: 0 },
  title: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  subtitle: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  value: { fontSize: 14, fontWeight: "700", maxWidth: "40%" },
});
