import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { Stack } from "expo-router";
import { RoadmapTimeline } from "@/components/RoadmapTimeline";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Colors, Spacing, Typography } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";
import { api } from "@/services/api";
import { track } from "@/services/analytics";

type RoadmapData = Awaited<ReturnType<typeof api.getRoadmap>>;

export default function RoadmapScreen() {
  const { t } = useI18n();
  useRequireUnlock();
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setData(await api.getRoadmap());
    setLoading(false);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const handleVote = async (featureId: string) => {
    setVotingId(featureId);
    try {
      const result = await api.voteRoadmapFeature(featureId);
      track("roadmap_vote", { feature_id: featureId });
      setData((prev) => {
        if (!prev) return prev;
        const patch = (items: typeof prev.backlog) =>
          items.map((item) =>
            item.id === featureId
              ? { ...item, vote_count: result.vote_count, is_voted: result.is_voted }
              : item,
          );
        return { ...prev, backlog: patch(prev.backlog) };
      });
    } catch (e: any) {
      Alert.alert(t.common.error, e.message || t.roadmap.voteError);
      throw e;
    } finally {
      setVotingId(null);
    }
  };

  if (loading || !data) return <LoadingScreen />;

  return (
    <ScreenShell bottomInset={false}>
      <Stack.Screen
        options={{
          title: t.roadmap.title,
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        <Text style={styles.subtitle}>{t.roadmap.subtitle}</Text>
        <RoadmapTimeline data={data} onVote={handleVote} votingId={votingId} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  subtitle: { ...Typography.body, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 22 },
});
