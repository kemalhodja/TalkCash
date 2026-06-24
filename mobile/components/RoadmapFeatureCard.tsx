import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Surface } from "@/components/ui/Surface";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Colors, Radius, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";

export type RoadmapFeature = {
  id: string;
  title: string;
  description: string;
  status: "active" | "soon" | "backlog";
  vote_count: number;
  is_voted: boolean;
  sort_order: number;
};

type Props = {
  feature: RoadmapFeature;
  onVote?: (id: string) => Promise<void>;
  voting?: boolean;
};

function ConfettiBurst({ active }: { active: boolean }) {
  const particles = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active) return;
    particles.forEach((anim, index) => {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 650,
        delay: index * 35,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
  }, [active, particles]);

  if (!active) return null;

  const colors = [Colors.accent, Colors.accentBlue, Colors.warning, Colors.success];

  return (
    <View style={styles.confettiLayer} pointerEvents="none">
      {particles.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confettiDot,
            {
              backgroundColor: colors[index % colors.length],
              left: 12 + index * 10,
              opacity: anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -28 - index * 4] }) },
                { scale: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 1, 0.6] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function RoadmapFeatureCard({ feature, onVote, voting }: Props) {
  const { t } = useI18n();
  const [localVoted, setLocalVoted] = useState(feature.is_voted);
  const [localCount, setLocalCount] = useState(feature.vote_count);
  const [burst, setBurst] = useState(false);
  const countAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setLocalVoted(feature.is_voted);
    setLocalCount(feature.vote_count);
  }, [feature.is_voted, feature.vote_count]);

  const bumpCount = () => {
    countAnim.setValue(1);
    Animated.sequence([
      Animated.timing(countAnim, { toValue: 1.28, duration: 140, useNativeDriver: true }),
      Animated.spring(countAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  };

  const handleVote = async () => {
    if (!onVote || localVoted || voting) return;
    try {
      await onVote(feature.id);
      setLocalVoted(true);
      setLocalCount((c) => c + 1);
      bumpCount();
      setBurst(true);
      setTimeout(() => setBurst(false), 700);
    } catch {
      /* parent may alert */
    }
  };

  const showVote = feature.status === "backlog";

  return (
    <Surface variant="elevated" style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{feature.title}</Text>
        {showVote ? (
          <View style={styles.voteCountWrap}>
            <ConfettiBurst active={burst} />
            <Animated.Text style={[styles.voteCount, { transform: [{ scale: countAnim }] }]}>
              {t.roadmap.votes.replace("{count}", String(localCount))}
            </Animated.Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.description}>{feature.description}</Text>
      {showVote ? (
        <PrimaryButton
          label={localVoted ? t.roadmap.voted : t.roadmap.vote}
          onPress={handleVote}
          variant={localVoted ? "secondary" : "primary"}
          disabled={localVoted || voting}
          loading={voting && !localVoted}
          compact
          style={[styles.voteBtn, localVoted && styles.voteBtnVoted]}
          testID={`roadmap-vote-${feature.id}`}
        />
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.sm, position: "relative" },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: Spacing.sm },
  title: { ...Typography.subtitle, color: Colors.text, flex: 1 },
  description: { ...Typography.body, color: Colors.textSecondary, marginTop: Spacing.xs, lineHeight: 21 },
  voteCountWrap: { minWidth: 72, alignItems: "flex-end", position: "relative", overflow: "visible" },
  voteCount: { ...Typography.caption, color: Colors.accent, fontWeight: "700" },
  voteBtn: { marginTop: Spacing.md, alignSelf: "flex-start" },
  voteBtnVoted: { opacity: 0.85 },
  confettiLayer: {
    position: "absolute",
    top: -4,
    right: 0,
    width: 80,
    height: 36,
    overflow: "visible",
  },
  confettiDot: {
    position: "absolute",
    bottom: 0,
    width: 6,
    height: 6,
    borderRadius: Radius.pill,
  },
});
