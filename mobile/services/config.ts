import Constants from "expo-constants";
import { Platform } from "react-native";

/** API base URL baked in at build time (EAS) or from .env in dev. */
export function getApiBaseUrl(): string {
  const direct =
    process.env.EXPO_PUBLIC_API_URL
    || (Constants.expoConfig?.extra?.apiUrl as string | undefined)
    || "http://localhost:8000/api/v1";

  if (Platform.OS === "web" && typeof window !== "undefined" && !usesLocalhostApiFromUrl(direct)) {
    return `${window.location.origin}/__api/api/v1`;
  }
  return direct;
}

function usesLocalhostApiFromUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("localhost") || lower.includes("127.0.0.1");
}

export function healthUrlFromApiBase(apiBase: string): string {
  const root = apiBase.replace(/\/api\/v1\/?$/, "");
  return `${root}/health`;
}

export function getHealthUrl(): string {
  const direct =
    process.env.EXPO_PUBLIC_API_URL
    || (Constants.expoConfig?.extra?.apiUrl as string | undefined)
    || "http://localhost:8000/api/v1";
  if (Platform.OS === "web" && typeof window !== "undefined" && !usesLocalhostApiFromUrl(direct)) {
    return `${window.location.origin}/__api/health`;
  }
  return healthUrlFromApiBase(getApiBaseUrl());
}

export function isMobileDevice(): boolean {
  return Platform.OS === "android" || Platform.OS === "ios";
}

export function usesLocalhostApi(): boolean {
  const direct =
    process.env.EXPO_PUBLIC_API_URL
    || (Constants.expoConfig?.extra?.apiUrl as string | undefined)
    || "http://localhost:8000/api/v1";
  return usesLocalhostApiFromUrl(direct);
}

export function getAppEnv(): "development" | "staging" | "production" {
  const env = process.env.EXPO_PUBLIC_APP_ENV || Constants.expoConfig?.extra?.appEnv;
  if (env === "production" || env === "staging" || env === "development") return env;
  const url = getApiBaseUrl().toLowerCase();
  if (url.includes("localhost") || url.includes("127.0.0.1")) return "development";
  if (url.includes("talkcash-api-prod") || url.includes("api.talkcash")) return "production";
  return "staging";
}

export type ApiHealthResult = { ok: true; status: string } | { ok: false; error: string };

export async function checkApiHealth(timeoutMs = 8000): Promise<ApiHealthResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(getHealthUrl(), { signal: controller.signal });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, status: String(data.status || "ok") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "network";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
