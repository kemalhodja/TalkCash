import { ApiError } from "@/services/api";

export type ApiErrorKind = "network" | "timeout" | "auth" | "validation" | "server" | "unknown";

function readStatus(err: unknown): number | null {
  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    return (err as { status: number }).status;
  }
  return null;
}

export function classifyApiError(err: unknown): ApiErrorKind {
  const status = readStatus(err);
  if (status !== null) {
    if (status === 0) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("abort") || msg.includes("timeout")) return "timeout";
      return "network";
    }
    if (status === 401 || status === 403) return "auth";
    if (status >= 400 && status < 500) return "validation";
    if (status >= 500) return "server";
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch")) return "network";
    if (msg.includes("abort") || msg.includes("timeout")) return "timeout";
  }
  return "unknown";
}

type ErrorCopy = {
  network: string;
  timeout: string;
  auth: string;
  validation: string;
  server: string;
  unknown: string;
};

export function getApiErrorMessage(err: unknown, copy: ErrorCopy): string {
  const kind = classifyApiError(err);
  if (kind === "validation") {
    if (err instanceof ApiError && err.message) return err.message;
    if (err instanceof Error && err.message) return err.message;
  }
  return copy[kind];
}

export function isRetryableApiError(err: unknown): boolean {
  const kind = classifyApiError(err);
  return kind === "network" || kind === "timeout" || kind === "server";
}
