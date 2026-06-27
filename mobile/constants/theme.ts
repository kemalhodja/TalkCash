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
  bg: "#04060C",
  bgElevated: "#080C14",
  card: "#0E1420",
  cardElevated: "#121A28",
  cardHover: "#182234",
  accent: "#00E4B8",
  accentSoft: "rgba(0,228,184,0.14)",
  accentGlow: "rgba(0,228,184,0.32)",
  accentBlue: "#4F8EF7",
  text: "#F8FAFC",
  textSecondary: "#A8B4C8",
  textMuted: "#6B7A94",
  border: "rgba(255,255,255,0.06)",
  borderStrong: "rgba(0,228,184,0.28)",
  danger: "#FF6B6B",
  warning: "#FBBF24",
  success: "#34D399",
  overlay: "rgba(4,6,12,0.94)",
};

export const ColorsLight: ThemeColors = {
  bg: "#F0F4FA",
  bgElevated: "#FFFFFF",
  card: "#FFFFFF",
  cardElevated: "#F8FAFD",
  cardHover: "#EEF2F8",
  accent: "#00A884",
  accentSoft: "rgba(0,168,132,0.10)",
  accentGlow: "rgba(0,168,132,0.18)",
  accentBlue: "#2563EB",
  text: "#0C1222",
  textSecondary: "#4A5568",
  textMuted: "#8B97AB",
  border: "rgba(12,18,34,0.07)",
  borderStrong: "rgba(0,168,132,0.32)",
  danger: "#DC2626",
  warning: "#D97706",
  success: "#059669",
  overlay: "rgba(240,244,250,0.94)",
};

/** Default export for legacy imports — prefer `useTheme().colors` in new code. */
export const Colors = ColorsDark;

export function getColors(scheme: "light" | "dark" | null | undefined): ThemeColors {
  return scheme === "light" ? ColorsLight : ColorsDark;
}

/** 8pt rhythm — premium spacing scale */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  /** Screen horizontal gutter on phones */
  screen: 20,
};

export const Radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 28,
  pill: 999,
};

export const Typography = {
  hero: { fontSize: 36, fontWeight: "800" as const, letterSpacing: -1.1, lineHeight: 42 },
  title: { fontSize: 20, fontWeight: "700" as const, letterSpacing: -0.35, lineHeight: 26 },
  subtitle: { fontSize: 15, fontWeight: "500" as const, lineHeight: 22 },
  label: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 1.1, textTransform: "uppercase" as const },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: "500" as const, lineHeight: 18 },
};

export const Touch = {
  minHeight: 48,
  buttonHeight: 52,
  inputHeight: 52,
  iconButton: 44,
};

export function getShadow(colors: ThemeColors, isDark: boolean) {
  return {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: isDark ? 10 : 4 },
      shadowOpacity: isDark ? 0.38 : 0.07,
      shadowRadius: isDark ? 20 : 12,
      elevation: isDark ? 10 : 4,
    },
    glow: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isDark ? 0.4 : 0.22,
      shadowRadius: 22,
      elevation: 12,
    },
    glowStrong: {
      shadowColor: colors.accent,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: isDark ? 0.55 : 0.28,
      shadowRadius: 28,
      elevation: 16,
    },
  };
}

/** @deprecated Use getShadow(useTheme().colors) in themed components. */
export const Shadow = getShadow(ColorsDark, true);

export const Layout = {
  screenPadding: Spacing.screen,
  tabBarHeight: 62,
  tabBarBottom: 10,
  tabBarClearance: 96,
  sectionGap: Spacing.lg,
  cardGap: Spacing.md,
  maxContentWidth: 440,
  fabSize: 56,
  fabLift: 20,
};

export function getGradients(colors: ThemeColors) {
  return {
    accent: [colors.accentGlow, colors.accentSoft] as const,
    hero: [colors.accentSoft, "rgba(79,142,247,0.08)", "transparent"] as const,
    card: [colors.cardElevated, colors.card] as const,
  };
}

export const Gradients = getGradients(ColorsDark);
