export type AnalyticsProvider = "posthog" | "plausible" | "google-analytics";

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, string | number | boolean | null>;
}

export interface IdentifyPayload {
  userId: string;
  traits?: Record<string, string | number | boolean>;
}

export interface PageViewPayload {
  page: string;
  title?: string;
  properties?: Record<string, string | number | boolean | null>;
}

export class AnalyticsError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "AnalyticsError";
  }
}
