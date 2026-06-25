jest.mock("expo-secure-store", () => {
  const store: Record<string, string> = {};
  return {
    getItemAsync: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItemAsync: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    deleteItemAsync: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
  };
});

jest.mock("@react-native-async-storage/async-storage", () => {
  const store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      Object.keys(store).forEach((k) => delete store[k]);
      return Promise.resolve();
    }),
  };
});

jest.mock("@/services/localData", () => ({
  clearLocalUserData: jest.fn(() => Promise.resolve()),
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { auth } from "@/services/auth";

describe("auth session persistence", () => {
  beforeEach(async () => {
    auth.setUnlocked(false);
    await AsyncStorage.clear();
    await SecureStore.deleteItemAsync("talkcash_session_unlocked");
    await auth.setRememberMe(true);
  });

  it("persists unlocked state when remember-me is on", async () => {
    auth.setUnlocked(true);
    await auth.persistSessionIfRemembered();

    auth.clearSessionMemory();
    await auth.restoreSessionState();
    expect(auth.isUnlocked()).toBe(true);
  });

  it("does not restore session when remember-me is off", async () => {
    await auth.setRememberMe(false);
    auth.setUnlocked(true);
    await auth.persistSessionIfRemembered();

    auth.clearSessionMemory();
    await auth.restoreSessionState();
    expect(auth.isUnlocked()).toBe(false);
  });

  it("defaults remember-me to true", async () => {
    expect(await auth.getRememberMe()).toBe(true);
    expect(await auth.keepStoredSession()).toBe(true);
  });
});
