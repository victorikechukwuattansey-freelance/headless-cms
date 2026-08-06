"use client";

import { useEffect, useState } from "react";
import { getAnalyticsService } from "@saas/analytics";
import type { AnalyticsService } from "@saas/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";

export function AnalyticsPanel() {
  const [analytics, setAnalytics] = useState<AnalyticsService | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getAnalyticsService().then((svc) => {
      if (cancelled) return;
      setAnalytics(svc);
      void svc.pageView({ page: "/dashboard/analytics", title: "Analytics" });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function sendTestEvent() {
    const run = (svc: AnalyticsService) => {
      void svc.track({ name: "test_event", properties: { source: "analytics_page" } });
      setSent(true);
    };
    if (analytics) run(analytics);
    else void getAnalyticsService().then(run);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event Tracking</CardTitle>
        <CardDescription>Track custom events across your application.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium">Track a Test Event</h3>
          <p className="text-muted-foreground mb-3 text-sm">
            Click below to send a test event to your analytics provider.
          </p>
          <button
            onClick={sendTestEvent}
            disabled={!analytics}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {sent ? "Test event sent" : "Send Test Event"}
          </button>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 text-sm font-medium">Identify User</h3>
          <p className="text-muted-foreground text-sm">
            Call <code className="bg-muted rounded px-1.5 py-0.5 text-xs">identify()</code> after
            login to associate events with user traits.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
