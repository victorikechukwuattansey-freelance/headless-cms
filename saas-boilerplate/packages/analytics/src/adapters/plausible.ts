import { getClientEnv } from "@saas/config";
import type { AnalyticsService } from "../service";
import type { AnalyticsEvent, IdentifyPayload, PageViewPayload } from "../types";

export class PlausibleAdapter implements AnalyticsService {
  private env = getClientEnv();

  private getDomain(): string {
    return this.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? window.location.hostname;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    if (typeof window === "undefined") return;
    window.plausible?.(event.name, {
      props: event.properties as Record<string, string | number | boolean>,
    });
  }

  async identify(_payload: IdentifyPayload): Promise<void> {
    // Plausible doesn't support user identification
  }

  async pageView(payload: PageViewPayload): Promise<void> {
    if (typeof window === "undefined") return;
    window.plausible?.("pageview", {
      u: payload.page,
      props: payload.properties as Record<string, string | number | boolean>,
    });
  }
}
