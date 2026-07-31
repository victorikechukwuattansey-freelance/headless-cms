import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@saas/ui";
import { Megaphone } from "lucide-react";

export default function AdminAnnouncementsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Platform Announcements</CardTitle>
          <CardDescription>
            Broadcast announcements to all users or specific segments.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Megaphone className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="mb-2 text-lg font-medium">No announcements yet</h3>
          <p className="text-muted-foreground mb-6 max-w-md text-sm">
            Announcement management is coming soon. You&apos;ll be able to create targeted
            announcements with scheduling, segmentation, and read tracking.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
