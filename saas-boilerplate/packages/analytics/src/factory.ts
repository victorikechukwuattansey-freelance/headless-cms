import { getEnv } from "@saas/config";
import type { AnalyticsService } from "./service";
import { PostHogAdapter } from "./adapters/posthog";
import { PlausibleAdapter } from "./adapters/plausible";
import { GoogleAnalyticsAdapter } from "./adapters/google-analytics";

let instance: AnalyticsService | null = null;

export function createAnalyticsService(): AnalyticsService {
  if (instance) return instance;

  const env = getEnv();
  const provider = env.ANALYTICS_PROVIDER ?? "posthog";

  switch (provider) {
    case "posthog":
      instance = new PostHogAdapter();
      break;
    case "plausible":
      instance = new PlausibleAdapter();
      break;
    case "google-analytics":
      instance = new GoogleAnalyticsAdapter();
      break;
    default:
      instance = new PostHogAdapter();
  }

  return instance;
}

export function getAnalyticsService(): AnalyticsService {
  return createAnalyticsService();
}
