import { PrismaClient, NotificationType, NotificationChannel } from "@prisma/client";
import type { User } from "@prisma/client";

export async function seedNotifications(prisma: PrismaClient, users: Record<string, User>) {
  console.log("\n── Notifications ──");

  const count = await prisma.notification.count();
  if (count > 0) {
    console.log("  ↳ Notifications already exist");
    return;
  }

  const notifications = [
    {
      user: users.user,
      type: NotificationType.IN_APP,
      channel: NotificationChannel.BILLING,
      title: "Invoice available",
      message: "Your invoice for Pro plan is ready.",
    },
    {
      user: users.user,
      type: NotificationType.IN_APP,
      channel: NotificationChannel.SYSTEM,
      title: "Account verified",
      message: "Your email has been verified.",
    },
    {
      user: users.user,
      type: NotificationType.EMAIL,
      channel: NotificationChannel.PRODUCT,
      title: "New feature released",
      message: "Check out our new analytics dashboard.",
    },
    {
      user: users.jane,
      type: NotificationType.IN_APP,
      channel: NotificationChannel.TEAM,
      title: "Team member joined",
      message: "Bob Tester has joined your organization.",
    },
  ];

  for (const n of notifications) {
    await prisma.notification.create({
      data: {
        userId: n.user.id,
        type: n.type,
        channel: n.channel,
        title: n.title,
        message: n.message,
      },
    });
  }
  console.log(`  ✓ Created ${notifications.length} notifications`);
}
