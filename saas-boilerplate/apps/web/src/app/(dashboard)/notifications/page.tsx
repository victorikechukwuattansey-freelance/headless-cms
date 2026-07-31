import { auth } from "@saas/auth";
import { prisma } from "@saas/database";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@saas/ui";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
        <p className="text-muted-foreground">Stay updated with your activity.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Notifications</CardTitle>
          <CardDescription>
            You have {notifications.filter((n) => !n.readAt).length} unread notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-3 rounded-lg border p-4 ${!n.readAt ? "bg-muted/50" : ""}`}
            >
              <Bell className="text-muted-foreground mt-0.5 h-5 w-5" />
              <div className="flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.message && <p className="text-muted-foreground mt-1 text-sm">{n.message}</p>}
                <p className="text-muted-foreground mt-1 text-xs">{n.createdAt.toLocaleString()}</p>
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
              No notifications yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
