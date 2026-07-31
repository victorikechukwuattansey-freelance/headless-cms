"use client";

import { useEffect, useState } from "react";
import { getAnalyticsService } from "@saas/analytics";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { BarChart3, TrendingUp, Users, Eye } from "lucide-react";

export default function AnalyticsPage() {
  const [analytics] = useState(() => getAnalyticsService());

  useEffect(() => {
    analytics.pageView({ page: "/dashboard/analytics", title: "Analytics" });
  }, [analytics]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Track your application metrics and user activity.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Page Views</CardTitle>
            <Eye className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-muted-foreground text-xs">Tracking via analytics provider</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-muted-foreground text-xs">Real-time data</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--</div>
            <p className="text-muted-foreground text-xs">Tracked events today</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Analytics Provider</CardTitle>
            <BarChart3 className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Active</div>
            <p className="text-muted-foreground text-xs">View full dashboard &rarr;</p>
          </CardContent>
        </Card>
      </div>

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
              onClick={() =>
                analytics.track({ name: "test_event", properties: { source: "analytics_page" } })
              }
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
            >
              Send Test Event
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
    </div>
  );
}
