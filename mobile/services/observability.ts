import Constants from "expo-constants";

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown) => void;
};

let sentry: SentryModule | null = null;

function loadSentry(): SentryModule | null {
  if (sentry) return sentry;
  try {
    // Optional dependency — install @sentry/react-native for production crash reporting.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    sentry = require("@sentry/react-native") as SentryModule;
    return sentry;
  } catch {
    return null;
  }
}

export function initObservability(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN || (Constants.expoConfig?.extra?.sentryDsn as string | undefined);
  if (!dsn) return;

  const sdk = loadSentry();
  if (!sdk) return;

  sdk.init({
    dsn,
    environment: process.env.EXPO_PUBLIC_APP_ENV || "development",
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
}

export function captureError(error: unknown): void {
  const sdk = loadSentry();
  if (sdk) {
    sdk.captureException(error);
    return;
  }
  console.error(error);
}
