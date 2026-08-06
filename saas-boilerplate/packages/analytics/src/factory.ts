import { getEnv } from "@saas/config";
import type { AnalyticsService } from "./service";

let instance: AnalyticsService | null = null;
let loadPromise: Promise<AnalyticsService> | null = null;

export function createAnalyticsService(): Promise<AnalyticsService> {
  if (instance) return Promise.resolve(instance);
  if (loadPromise) return loadPromise;

  const env = getEnv();
  const provider = env.ANALYTICS_PROVIDER ?? "posthog";

  loadPromise = (async () => {
    let adapter: AnalyticsService;
    switch (provider) {
      case "plausible": {
        const { PlausibleAdapter } = await import("./adapters/plausible");
        adapter = new PlausibleAdapter();
        break;
      }
      case "google-analytics": {
        const { GoogleAnalyticsAdapter } = await import("./adapters/google-analytics");
        adapter = new GoogleAnalyticsAdapter();
        break;
      }
      default: {
        const { PostHogAdapter } = await import("./adapters/posthog");
        adapter = new PostHogAdapter();
      }
    }
    instance = adapter;
    return adapter;
  })();

  return loadPromise;
}

export function getAnalyticsService(): Promise<AnalyticsService> {
  return createAnalyticsService();
}
