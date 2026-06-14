import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { clearLocalUserData } from "./localData";

const TOKEN_KEY = "talkcash_token";
const REFRESH_KEY = "talkcash_refresh";
const USER_KEY = "talkcash_user";

export interface AuthUser {
  userId: string;
  fullName: string;
  token: string;
  refreshToken?: string;
  biometricEnabled: boolean;
  hasPin: boolean;
}

let sessionUnlocked = false;

export const auth = {
  isUnlocked(): boolean {
    return sessionUnlocked;
  },

  setUnlocked(value: boolean) {
    sessionUnlocked = value;
  },

  async save(user: AuthUser) {
    await SecureStore.setItemAsync(TOKEN_KEY, user.token);
    if (user.refreshToken) {
      await SecureStore.setItemAsync(REFRESH_KEY, user.refreshToken);
    }
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },

  async getUser(): Promise<AuthUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async updateTokens(token: string, refreshToken: string) {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
    const user = await this.getUser();
    if (user) {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ ...user, token, refreshToken }));
    }
  },

  async clear(options?: { preserveOffline?: boolean }) {
    sessionUnlocked = false;
    if (!options?.preserveOffline) {
      await clearLocalUserData();
    }
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  async updateUser(partial: Partial<AuthUser>) {
    const user = await this.getUser();
    if (!user) return;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify({ ...user, ...partial }));
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
