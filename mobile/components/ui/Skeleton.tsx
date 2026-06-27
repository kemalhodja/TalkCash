import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { Colors, Radius, Spacing } from "@/constants/theme";

type Props = {
  lines?: number;
  style?: ViewStyle;
};

function Pulse({ style }: { style: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.75, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.line, style, { opacity }]} />;
}

export function SkeletonBlock({ lines = 3, style }: Props) {
  return (
    <View style={[styles.wrap, style]} accessibilityLabel="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <Pulse key={i} style={{ width: i === lines - 1 ? "70%" : "100%", height: i === 0 ? 20 : 14 }} />
      ))}
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Pulse style={{ width: "45%", height: 18, marginBottom: Spacing.sm }} />
      <Pulse style={{ width: "100%", height: 12 }} />
      <Pulse style={{ width: "85%", height: 12, marginTop: Spacing.xs }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, padding: Spacing.md },
  line: { backgroundColor: Colors.border, borderRadius: Radius.sm },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
});
