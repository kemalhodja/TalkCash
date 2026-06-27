import Constants from "expo-constants";

type SentryModule = {
  init: (options: Record<string, unknown>) => void;
  captureException: (error: unknown) => void;
  setUser: (user: { id?: string; username?: string } | null) => void;
  addBreadcrumb: (breadcrumb: { category?: string; message?: string; data?: Record<string, unknown>; level?: string }) => void;
  setTag: (key: string, value: string) => void;
};

let sentry: SentryModule | null = null;

function loadSentry(): SentryModule | null {
  if (sentry) return sentry;
  try {
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

  const version = Constants.expoConfig?.version ?? "1.0.0";
  const environment = process.env.EXPO_PUBLIC_APP_ENV || "development";

  sdk.init({
    dsn,
    environment,
    release: `talkcash@${version}`,
    tracesSampleRate: 0.1,
    enableAutoSessionTracking: true,
  });
  sdk.setTag("app_version", version);
}

export function setObservabilityUser(user: { id: string; name?: string } | null): void {
  const sdk = loadSentry();
  if (!sdk) return;
  if (!user) {
    sdk.setUser(null);
    return;
  }
  sdk.setUser({ id: user.id, username: user.name });
}

export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  const sdk = loadSentry();
  if (!sdk) return;
  sdk.addBreadcrumb({ category, message, data, level: "info" });
}

export function captureError(error: unknown, context?: Record<string, unknown>): void {
  const sdk = loadSentry();
  if (sdk) {
    if (context) {
      sdk.addBreadcrumb({ category: "error", message: "captureError context", data: context, level: "error" });
    }
    sdk.captureException(error);
    return;
  }
  console.error(error, context);
}
