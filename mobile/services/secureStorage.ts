import { Platform } from "react-native";

const PREFIX = "talkcash_secure:";

function keyFor(key: string): string {
  return `${PREFIX}${key}`;
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(keyFor(key));
  }
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  return SecureStore.getItemAsync(key);
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(keyFor(key), value);
    return;
  }
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  if (Platform.OS === "web") {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(keyFor(key));
    return;
  }
  const SecureStore = require("expo-secure-store") as typeof import("expo-secure-store");
  await SecureStore.deleteItemAsync(key);
}
