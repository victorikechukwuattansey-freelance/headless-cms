import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Mail } from "lucide-react";

export default function AdminEmailBroadcastPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Email Broadcast</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Email Campaigns</CardTitle>
          <CardDescription>Send broadcast emails to your user base.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Mail className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">Email broadcasting coming soon</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            You&apos;ll be able to compose and send email campaigns to targeted user segments, track
            open rates, and manage templates.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
