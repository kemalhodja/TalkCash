import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";

const TOKEN_KEY = "talkcash_token";
const USER_KEY = "talkcash_user";

export interface AuthUser {
  userId: string;
  fullName: string;
  token: string;
  biometricEnabled: boolean;
  hasPin: boolean;
}

export const auth = {
  async save(user: AuthUser) {
    await SecureStore.setItemAsync(TOKEN_KEY, user.token);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  },

  async getToken(): Promise<string | null> {
    return SecureStore.getItemAsync(TOKEN_KEY);
  },

  async getUser(): Promise<AuthUser | null> {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  },

  async clear() {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
  },

  async authenticateBiometric(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "TalkCash'e giriş yap",
      fallbackLabel: "PIN kullan",
    });
    return result.success;
  },
};
