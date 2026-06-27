import { createContext, ReactNode, useContext, useMemo } from "react";
import { useColorScheme } from "react-native";
import { getColors, getGradients, getShadow, ThemeColors } from "@/constants/theme";

type ThemeContextValue = {
  colors: ThemeColors;
  shadow: ReturnType<typeof getShadow>;
  gradients: ReturnType<typeof getGradients>;
  isDark: boolean;
  scheme: "light" | "dark";
};

const ThemeContext = createContext<ThemeContextValue>({
  colors: getColors("dark"),
  shadow: getShadow(getColors("dark")),
  gradients: getGradients(getColors("dark")),
  isDark: true,
  scheme: "dark",
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const scheme: "light" | "dark" = systemScheme === "light" ? "light" : "dark";

  const value = useMemo(() => {
    const colors = getColors(scheme);
    return {
      colors,
      shadow: getShadow(colors),
      gradients: getGradients(colors),
      isDark: scheme === "dark",
      scheme,
    };
  }, [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
