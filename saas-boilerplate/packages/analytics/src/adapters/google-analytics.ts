import type { AnalyticsService } from "../service";
import type { AnalyticsEvent, IdentifyPayload, PageViewPayload } from "../types";

export class GoogleAnalyticsAdapter implements AnalyticsService {
  private getGtag(): any {
    return typeof window !== "undefined" ? (window as any).gtag : null;
  }

  async track(event: AnalyticsEvent): Promise<void> {
    const gtag = this.getGtag();
    if (!gtag) return;
    gtag("event", event.name, event.properties ?? {});
  }

  async identify(payload: IdentifyPayload): Promise<void> {
    const gtag = this.getGtag();
    if (!gtag) return;
    gtag("set", "user_properties", payload.traits ?? {});
    gtag("config", payload.userId, { user_id: payload.userId });
  }

  async pageView(payload: PageViewPayload): Promise<void> {
    const gtag = this.getGtag();
    if (!gtag) return;
    gtag("event", "page_view", {
      page_title: payload.title,
      page_location: payload.page,
      ...payload.properties,
    });
  }
}
