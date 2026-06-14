import { StyleSheet, View } from "react-native";
import { Colors } from "@/constants/theme";

type Props = {
  variant?: "default" | "auth" | "subtle";
};

export function AmbientBackground({ variant = "default" }: Props) {
  const orbs = variant === "auth"
    ? [
        { top: 60, left: "15%" as const, size: 220, color: Colors.accentGlow, opacity: 0.28 },
        { top: 280, right: -40, size: 160, color: "rgba(59,130,246,0.25)", opacity: 0.35 },
      ]
    : variant === "subtle"
      ? [{ top: -60, right: -30, size: 180, color: Colors.accentGlow, opacity: 0.18 }]
      : [
          { top: -80, right: -40, size: 200, color: Colors.accentGlow, opacity: 0.22 },
          { top: 320, left: -60, size: 140, color: "rgba(59,130,246,0.2)", opacity: 0.25 },
        ];

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
