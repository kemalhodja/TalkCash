import { Platform } from "react-native";

type ImpactStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

function getHaptics() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-haptics") as typeof import("expo-haptics");
  } catch {
    return null;
  }
}

export async function hapticImpact(style: ImpactStyle = "light"): Promise<void> {
  if (Platform.OS === "web") return;
  const Haptics = getHaptics();
  if (!Haptics) return;
  try {
    if (style === "success") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (style === "warning") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (style === "error") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      const map = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      } as const;
      await Haptics.impactAsync(map[style] ?? Haptics.ImpactFeedbackStyle.Light);
    }
  } catch {
    /* optional */
  }
}

export async function hapticSelection(): Promise<void> {
  if (Platform.OS === "web") return;
  const Haptics = getHaptics();
  if (!Haptics) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    /* optional */
  }
}

/** Soft click when the mic button is pressed — premium tactile start cue. */
export async function hapticRecordTap(): Promise<void> {
  await hapticSelection();
  await hapticImpact("light");
}

/** Double light tap when an expense is saved successfully. */
export async function hapticSuccessDouble(): Promise<void> {
  await hapticImpact("light");
  await new Promise((resolve) => setTimeout(resolve, 85));
  await hapticImpact("medium");
}
