import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  variant?: "default" | "auth" | "subtle";
};

export function AmbientBackground({ variant = "default" }: Props) {
  const { colors } = useTheme();
  const orbs = useMemo(() => {
    if (variant === "auth") {
      return [
        { top: 60, left: "12%" as const, size: 220, color: colors.accentGlow, opacity: 0.26 },
        { top: 280, right: -40, size: 160, color: "rgba(79,142,247,0.22)", opacity: 0.32 },
      ];
    }
    if (variant === "subtle") {
      return [{ top: -64, right: -32, size: 184, color: colors.accentGlow, opacity: 0.16 }];
    }
    return [
      { top: -88, right: -44, size: 208, color: colors.accentGlow, opacity: 0.2 },
      { top: 300, left: -64, size: 148, color: "rgba(79,142,247,0.18)", opacity: 0.22 },
    ];
  }, [colors.accentGlow, variant]);

  return (
    <View style={styles.root} pointerEvents="none">
      {orbs.map((orb, i) => (
        <View
          key={i}
          style={[
            styles.orb,
            {
              top: orb.top,
              left: "left" in orb ? orb.left : undefined,
              right: "right" in orb ? orb.right : undefined,
              width: orb.size,
              height: orb.size,
              borderRadius: orb.size / 2,
              backgroundColor: orb.color,
              opacity: orb.opacity,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  orb: { position: "absolute" },
});
