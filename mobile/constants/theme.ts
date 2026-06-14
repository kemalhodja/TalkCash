export const Colors = {
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

export const Shadow = {
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
  },
  glowStrong: {
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 16,
  },
};

export const Layout = {
  screenPadding: Spacing.md,
  tabBarHeight: 68,
  tabBarBottom: 16,
  tabBarClearance: 100,
  sectionGap: Spacing.lg,
  cardGap: Spacing.sm,
  maxContentWidth: 480,
};

export const Gradients = {
  accent: ["rgba(0,212,170,0.35)", "rgba(0,212,170,0.05)"] as const,
  hero: ["rgba(0,212,170,0.18)", "rgba(59,130,246,0.08)", "transparent"] as const,
  card: ["rgba(20,28,43,0.95)", "rgba(15,21,32,0.88)"] as const,
};
