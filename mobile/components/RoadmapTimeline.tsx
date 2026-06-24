import { StyleSheet, Text, View } from "react-native";
import { RoadmapFeature, RoadmapFeatureCard } from "@/components/RoadmapFeatureCard";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";

type GroupedRoadmap = {
  active: RoadmapFeature[];
  soon: RoadmapFeature[];
  backlog: RoadmapFeature[];
};

type Props = {
  data: GroupedRoadmap;
  onVote?: (id: string) => Promise<void>;
  votingId?: string | null;
};

type SectionKey = keyof GroupedRoadmap;

const SECTION_ORDER: SectionKey[] = ["active", "soon", "backlog"];

function TimelineDot({ variant }: { variant: SectionKey }) {
  const color =
    variant === "active" ? Colors.success : variant === "soon" ? Colors.warning : Colors.accentBlue;
  return (
    <View style={styles.dotColumn}>
      <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]} />
      <View style={styles.line} />
    </View>
  );
}

export function RoadmapTimeline({ data, onVote, votingId }: Props) {
  const { t } = useI18n();

  const labels: Record<SectionKey, string> = {
    active: t.roadmap.active,
    soon: t.roadmap.soon,
    backlog: t.roadmap.backlog,
  };

  return (
    <View style={styles.timeline}>
      {SECTION_ORDER.map((key) => {
        const items = data[key] ?? [];
        return (
          <View key={key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <TimelineDot variant={key} />
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>{labels[key]}</Text>
                {key === "backlog" ? (
                  <Text style={styles.sectionHint}>{t.roadmap.backlogHint}</Text>
                ) : null}
              </View>
            </View>
            <View style={styles.cardsColumn}>
              {items.length === 0 ? (
                <Text style={styles.empty}>{t.roadmap.empty}</Text>
              ) : (
                items.map((feature) => (
                  <RoadmapFeatureCard
                    key={feature.id}
                    feature={feature}
                    onVote={key === "backlog" ? onVote : undefined}
                    voting={votingId === feature.id}
                  />
                ))
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { paddingBottom: Spacing.xl },
  section: { marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  dotColumn: { width: 18, alignItems: "center" },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    shadowOpacity: 0.45,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 3,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginTop: Spacing.xs,
    minHeight: 24,
  },
  sectionTitleWrap: { flex: 1, paddingTop: 2 },
  sectionTitle: { ...Typography.label, color: Colors.text },
  sectionHint: { ...Typography.caption, color: Colors.textMuted, marginTop: 4 },
  cardsColumn: { marginLeft: 34 },
  empty: { ...Typography.caption, color: Colors.textMuted, fontStyle: "italic" },
});
