import { getClientEnv } from "@saas/config";
import type { AnalyticsService } from "../service";
import type { AnalyticsEvent, IdentifyPayload, PageViewPayload } from "../types";

export class PostHogAdapter implements AnalyticsService {
  private client: any = null;
  private env = getClientEnv();

  private getClient(): any {
    if (this.client) return this.client;
    if (typeof window !== "undefined" && this.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const posthog = require("posthog-js");
      this.client = posthog.init(this.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: this.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
        loaded: (ph: any) => {
          if (process.env.NODE_ENV !== "production") ph.opt_out_capturing();
        },
      });
      return posthog;
    }
    return null;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    client.capture(event.name, event.properties ?? {});
  }

  async identify(payload: IdentifyPayload): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    client.identify(payload.userId, payload.traits ?? {});
  }

  async pageView(payload: PageViewPayload): Promise<void> {
    const client = this.getClient();
    if (!client) return;
    client.capture("$pageview", {
      $current_url: payload.page,
      $title: payload.title,
      ...payload.properties,
    });
  }
}
