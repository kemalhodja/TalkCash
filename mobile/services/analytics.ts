import { api } from "./api";

export function track(eventName: string, properties?: Record<string, unknown>) {
  api.trackEvent(eventName, properties).catch(() => {});
}
