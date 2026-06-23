/** Public URLs for in-app links (Play Store compliance). */
import { getApiBaseUrl } from "@/services/config";

function apiSiteRoot(): string {
  return getApiBaseUrl().replace(/\/api\/v1\/?$/, "");
}

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL || `${apiSiteRoot()}/privacy`;

export const TERMS_OF_SERVICE_URL =
  process.env.EXPO_PUBLIC_TERMS_URL || `${apiSiteRoot()}/terms`;

export const SUPPORT_EMAIL = "ozyurtkemal35@gmail.com";

export const FEEDBACK_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=TalkCash%20Feedback`;
