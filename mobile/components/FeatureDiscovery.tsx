import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { ListRow } from "@/components/ui/ListRow";
import { SectionBlock } from "@/components/ui/SectionBlock";
import { Colors } from "@/constants/theme";
import { useI18n } from "@/i18n";

type FeatureRoute = {
  key: string;
  route: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export function FeatureDiscovery({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();

  const features: FeatureRoute[] = [
    { key: "shopping", route: "/(tabs)/shopping", label: t.tabs.shopping, icon: "cart-outline" },
    { key: "agenda", route: "/(tabs)/agenda", label: t.tabs.agenda, icon: "calendar-outline" },
    { key: "budget", route: "/(tabs)/budgets", label: t.tabs.budget, icon: "pie-chart-outline" },
    { key: "mentor", route: "/(tabs)/mentor", label: t.tabs.mentor, icon: "chatbubble-ellipses-outline" },
    { key: "social", route: "/(tabs)/social", label: t.tabs.social, icon: "people-outline" },
    { key: "insights", route: "/(tabs)/insights", label: t.tabs.insights, icon: "analytics-outline" },
    { key: "receipts", route: "/receipts", label: t.settings.viewReceipts, icon: "receipt-outline" },
    { key: "workspaces", route: "/(tabs)/workspaces", label: t.workspaces.title, icon: "briefcase-outline" },
    { key: "micro", route: "/micro-savings-settings", label: t.microSavings.settingsTitle, icon: "trending-up-outline" },
    { key: "quickVoice", route: "/quick-voice?hold=1", label: t.quickVoice.title, icon: "ear-outline" },
  ];

  return (
    <SectionBlock title={t.features.title} bare={compact}>
      {features.map((f) => (
        <ListRow
          key={f.key}
          title={f.label}
          icon={f.icon}
          onPress={() => router.push(f.route as any)}
          trailing={<Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />}
        />
      ))}
    </SectionBlock>
  );
}
