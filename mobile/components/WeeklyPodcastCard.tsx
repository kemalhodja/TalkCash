import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Audio } from "expo-av";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { Surface } from "@/components/ui/Surface";
import { Colors, Spacing } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { api, resolveMediaUrl } from "@/services/api";

export function WeeklyPodcastCard() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [podcast, setPodcast] = useState<any>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    api.getLatestPodcast()
      .then(setPodcast)
      .catch(() => setPodcast({ available: false }))
      .finally(() => setLoading(false));
    return () => { sound?.unloadAsync(); };
  }, []);

  const togglePlay = async () => {
    if (!podcast?.audio_url) return;
    if (sound) {
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
        setPlaying(false);
        return;
      }
      await sound.playAsync();
      setPlaying(true);
      return;
    }
    const media = await resolveMediaUrl(podcast.audio_url);
    const { sound: next } = await Audio.Sound.createAsync(
      { uri: media.uri, headers: media.headers },
      { shouldPlay: true },
    );
    setSound(next);
    setPlaying(true);
    next.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) setPlaying(false);
    });
  };

  if (loading) return null;
  if (!podcast?.available) return null;

  return (
    <Surface variant="glass" style={styles.card}>
      <Text style={styles.title}>{t.home.weeklyPodcastTitle}</Text>
      <Text style={styles.script} numberOfLines={4}>{podcast.script}</Text>
      {podcast.has_audio ? (
        <PrimaryButton
          label={playing ? t.home.weeklyPodcastPause : t.home.weeklyPodcastPlay}
          onPress={togglePlay}
          compact
          style={styles.btn}
        />
      ) : (
        <ActivityIndicator color={Colors.accent} style={styles.btn} />
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.md, marginBottom: Spacing.md },
  title: { color: Colors.accent, fontWeight: "700", marginBottom: Spacing.xs },
  script: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: Spacing.sm },
  btn: { alignSelf: "flex-start" },
});
