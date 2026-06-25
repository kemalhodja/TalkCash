import { Stack } from "expo-router";
import { FeatureDiscovery } from "@/components/FeatureDiscovery";
import { ScreenHeader } from "@/components/ui/ScreenHeader";
import { ScreenShell } from "@/components/ui/ScreenShell";
import { Colors } from "@/constants/theme";
import { useI18n } from "@/i18n";
import { useRequireUnlock } from "@/hooks/useRequireUnlock";

export default function FeatureHubScreen() {
  const { t } = useI18n();
  useRequireUnlock();

  return (
    <ScreenShell ambient="subtle">
      <Stack.Screen
        options={{
          title: t.features.title,
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.text,
        }}
      />
      <ScreenHeader title={t.features.title} subtitle={t.features.subtitle} />
      <FeatureDiscovery compact />
    </ScreenShell>
  );
}
