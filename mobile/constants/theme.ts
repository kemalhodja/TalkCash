export type ThemeColors = {
  bg: string;
  bgElevated: string;
  card: string;
  cardElevated: string;
  cardHover: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  accentBlue: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderStrong: string;
  danger: string;
  warning: string;
  success: string;
  overlay: string;
};

export const ColorsDark: ThemeColors = {
  bg: "#06080F",
  bgElevated: "#0A0E17",
  card: "#0F1520",
  cardElevated: "#141C2B",
  cardHover: "#1A2438",
  accent: "#00D4AA",
  accentSoft: "rgba(0,212,170,0.12)",
  accentGlow: "rgba(0,212,170,0.35)",
  accentBlue: "#3B82F6",
  text: "#F4F7FB",
  textSecondary: "#94A3B8",
  textMuted: "#64748B",
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(0,212,170,0.25)",
  danger: "#F87171",
  warning: "#FBBF24",
  success: "#34D399",
  overlay: "rgba(6,8,15,0.92)",
};

export const ColorsLight: ThemeColors = {
  bg: "#F4F7FB",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardElevated: "#F8FAFC",
  cardHover: "#EEF2F7",
  accent: "#00B894",
  accentSoft: "rgba(0,184,148,0.12)",
  accentGlow: "rgba(0,184,148,0.22)",
  accentBlue: "#2563EB",
  text: "#0F172A",
  textSecondary: "#475569",
  textMuted: "#94A3B8",
  border: "rgba(15,23,42,0.08)",
  borderStrong: "rgba(0,184,148,0.35)",
  danger: "#DC2626",
  warning: "#D97706",
  success: "#059669",
  overlay: "rgba(244,247,251,0.92)",
};

/** Default export for legacy imports — prefer `useTheme().colors` in new code. */
export const Colors = ColorsDark;

export function getColors(scheme: "light" | "dark" | null | undefined): ThemeColors {
  return scheme === "light" ? ColorsLight : ColorsDark;
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
};

export const Typography = {
  hero: { fontSize: 40, fontWeight: "800" as const, letterSpacing: -1.2 },
  title: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.4 },
  subtitle: { fontSize: 15, fontWeight: "500" as const },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.8, textTransform: "uppercase" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 12, fontWeight: "500" as const },
};

export function getShadow(colors: ThemeColors) {
  return {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: colors === ColorsLight ? 0.08 : 0.35,
      shadowRadius: 16,
      elevation: 8,
    },
    glow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 12,
    },
    glowStrong: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 32,
      elevation: 16,
    },
  };
}

/** @deprecated Use getShadow(useTheme().colors) in themed components. */
export const Shadow = getShadow(ColorsDark);

export const Layout = {
  screenPadding: Spacing.md,
  tabBarHeight: 68,
  tabBarBottom: 16,
  tabBarClearance: 100,
  sectionGap: Spacing.lg,
  cardGap: Spacing.sm,
  maxContentWidth: 480,
};

export function getGradients(colors: ThemeColors) {
  return {
    accent: [`${colors.accentGlow}`, `${colors.accentSoft}`] as const,
    hero: [`${colors.accentSoft}`, "rgba(59,130,246,0.08)", "transparent"] as const,
    card: [colors.cardElevated, colors.card] as const,
  };
}

export const Gradients = getGradients(ColorsDark);
