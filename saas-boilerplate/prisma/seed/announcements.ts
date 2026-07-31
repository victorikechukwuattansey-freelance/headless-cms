import { PrismaClient, AnnouncementChannel } from "@prisma/client";
import type { User } from "@prisma/client";

export async function seedAnnouncements(prisma: PrismaClient, users: Record<string, User>) {
  console.log("\n── Announcements ──");

  const count = await prisma.announcement.count();
  if (count > 0) {
    console.log("  ↳ Announcements already exist");
    return;
  }

  await prisma.announcement.create({
    data: {
      title: "Welcome to the new dashboard",
      body: "We've updated the dashboard with new analytics features. Check out the Analytics page to track your metrics.",
      channel: AnnouncementChannel.IN_APP,
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      createdById: users.admin.id,
    },
  });

  await prisma.announcement.create({
    data: {
      title: "Scheduled maintenance",
      body: "We'll be performing maintenance on Sunday, August 10th. Expected downtime: 30 minutes.",
      channel: AnnouncementChannel.BOTH,
      targetRole: "ADMIN",
      scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdById: users.admin.id,
    },
  });

  console.log("  ✓ Created 2 announcements");
}
