import * as SecureStore from "@/services/secureStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { clearLocalUserData } from "./localData";
import { setObservabilityUser } from "./observability";

const TOKEN_KEY = "talkcash_token";
const REFRESH_KEY = "talkcash_refresh";
const USER_KEY = "talkcash_user";
const REMEMBER_ME_KEY = "talkcash_remember_me";
const REMEMBER_EMAIL_KEY = "talkcash_remember_email";
const SESSION_UNLOCKED_KEY = "talkcash_session_unlocked";
const LAST_BACKGROUND_AT_KEY = "talkcash_last_background_at";

/** Re-lock PIN after this long in background (while app process stays alive). */
export const RELOCK_AFTER_MS = 60_000;

export interface AuthUser {
  userId: string;
  fullName: string;
  token: string;
  refreshToken?: string;
  biometricEnabled: boolean;
  hasPin: boolean;
  assistantPersona?: "default" | "angry_mom" | "street_smart" | "wall_street" | "zen_guru";
}

let sessionUnlocked = false;

export const auth = {
  isUnlocked(): boolean {
    return sessionUnlocked;
  },

  /** Clears in-memory unlock flag without touching persisted session (cold start). */
  clearSessionMemory() {
    sessionUnlocked = false;
  },

  setUnlocked(value: boolean) {
    sessionUnlocked = value;
    void this.persistSessionIfRemembered();
  },

  async persistSessionIfRemembered(): Promise<void> {
    if (!(await this.getRememberMe())) return;
    if (sessionUnlocked) {
      await SecureStore.setItemAsync(SESSION_UNLOCKED_KEY, "1");
    } else {
      await SecureStore.deleteItemAsync(SESSION_UNLOCKED_KEY);
    }
  },

  async restoreSessionState(): Promise<void> {
    if (!(await this.getRememberMe())) {
      sessionUnlocked = false;
      return;
    }
    const raw = await SecureStore.getItemAsync(SESSION_UNLOCKED_KEY);
    sessionUnlocked = raw === "1";
  },

  async recordBackgroundAt(): Promise<void> {
    await AsyncStorage.setItem(LAST_BACKGROUND_AT_KEY, String(Date.now()));
  },

  async shouldRelockAfterResume(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(LAST_BACKGROUND_AT_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) >= RELOCK_AFTER_MS;
  },

  async clearBackgroundTimestamp(): Promise<void> {
    await AsyncStorage.removeItem(LAST_BACKGROUND_AT_KEY);
  },

  /** Returns false when stored session should be discarded (remember-me off). */
  async keepStoredSession(): Promise<boolean> {
    return this.getRememberMe();
  },

  async save(user: AuthUser) {
    await SecureStore.setItemAsync(TOKEN_KEY, user.token);
    if (user.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, user.refreshToken);
    }
    const { token: _token, refreshToken: _refresh, ...profile } = user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile));
    setObservabilityUser({ id: user.userId, name: user.fullName });
    try {
      const { identifyRevenueCatUser, isRevenueCatConfigured } = await import("./revenueCat");
      if (isRevenueCatConfigured()) {
        await identifyRevenueCatUser(user.userId);
      }
    } catch (err) {
      const { captureError } = await import("./observability");
      captureError(err, { feature: "revenuecat", stage: "identify_on_save" });
    }
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async getUser(): Promise<AuthUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    if (!raw) return null;
    try {
      const profile = JSON.parse(raw) as Omit<AuthUser, "token" | "refreshToken">;
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) return null;
      const refreshToken = (await SecureStore.getItemAsync(REFRESH_KEY)) || undefined;
      return { ...profile, token, refreshToken };
    } catch {
      await SecureStore.deleteItemAsync(USER_KEY);
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(REFRESH_KEY);
      return null;
    }
  },

  async updateTokens(token: string, refreshToken: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },

  async clear(options?: { preserveOffline?: boolean }) {
    sessionUnlocked = false;
    if (!options?.preserveOffline) {
      await clearLocalUserData();
    }
    try {
      const { logoutRevenueCat } = await import("./revenueCat");
      await logoutRevenueCat();
    } catch {
      /* RC optional */
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    await SecureStore.deleteItemAsync(SESSION_UNLOCKED_KEY);
    await AsyncStorage.removeItem(LAST_BACKGROUND_AT_KEY);
    setObservabilityUser(null);
  },

  async updateUser(partial: Partial<AuthUser>) {
    const user = await this.getUser();
    if (!user) return;
    const { token: _token, refreshToken: _refresh, ...profile } = { ...user, ...partial };
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(profile));
  },

  async getRememberMe(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(REMEMBER_ME_KEY);
    return raw !== "0";
  },

  async setRememberMe(value: boolean): Promise<void> {
    await AsyncStorage.setItem(REMEMBER_ME_KEY, value ? "1" : "0");
    if (!value) {
      await AsyncStorage.removeItem(REMEMBER_EMAIL_KEY);
    }
  },

  async getRememberedEmail(): Promise<string | null> {
    if (!(await this.getRememberMe())) return null;
    const email = await AsyncStorage.getItem(REMEMBER_EMAIL_KEY);
    return email?.trim() || null;
  },

  async setRememberedEmail(email: string): Promise<void> {
    await AsyncStorage.setItem(REMEMBER_EMAIL_KEY, email.trim().toLowerCase());
  },

  async authenticateBiometric(promptMessage = "TalkCash"): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "PIN",
    });
    return result.success;
  },
};
