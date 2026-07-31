import type { AnalyticsEvent, IdentifyPayload, PageViewPayload } from "./types";

export interface AnalyticsService {
  track(event: AnalyticsEvent): Promise<void>;
  identify(payload: IdentifyPayload): Promise<void>;
  pageView(payload: PageViewPayload): Promise<void>;
}
