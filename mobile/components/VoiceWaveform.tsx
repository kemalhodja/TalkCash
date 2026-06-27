import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

const BAR_COUNT = 20;

type Props = {
  /** Normalized audio levels 0–1, oldest → newest. */
  levels: number[];
  active?: boolean;
  height?: number;
};

function VoiceWaveformInner({ levels, active = false, height = 44 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          height,
          marginBottom: 8,
        },
        bar: {
          width: 4,
          borderRadius: 2,
          backgroundColor: colors.accent,
          opacity: active ? 1 : 0.35,
        },
        idleBar: {
          backgroundColor: colors.textMuted,
          opacity: 0.25,
        },
      }),
    [colors, active],
  );

  const bars = useMemo(() => {
    const padded = [...Array(Math.max(0, BAR_COUNT - levels.length)).fill(0.08), ...levels];
    return padded.slice(-BAR_COUNT);
  }, [levels]);

  return (
    <View style={styles.wrap} accessibilityElementsHidden importantForAccessibility="no">
      {bars.map((level, index) => {
        const clamped = Math.min(1, Math.max(0.08, level));
        const barHeight = Math.round(8 + clamped * (height - 12));
        const isIdle = !active && level <= 0.1;
        return (
          <View
            key={index}
            style={[
              styles.bar,
              isIdle && styles.idleBar,
              { height: barHeight },
            ]}
          />
        );
      })}
    </View>
  );
}

export const VoiceWaveform = memo(VoiceWaveformInner);
