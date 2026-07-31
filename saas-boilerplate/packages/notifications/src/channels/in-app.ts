import { prisma } from "@saas/database";
import type { NotificationPayload, NotificationRecord } from "../types";

export class InAppChannel {
  async send(payload: NotificationPayload): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: payload.type.toUpperCase() as any,
        channel: payload.channel.toUpperCase() as any,
        title: payload.title,
        message: payload.message,
        link: payload.link,
      },
    });
  }

  async sendBulk(payloads: NotificationPayload[]): Promise<void> {
    await prisma.notification.createMany({
      data: payloads.map((p) => ({
        userId: p.userId,
        type: p.type.toUpperCase() as any,
        channel: p.channel.toUpperCase() as any,
        title: p.title,
        message: p.message,
        link: p.link,
      })),
    });
  }

  async getNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
    const records = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return records.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type.toLowerCase() as any,
      channel: r.channel.toLowerCase() as any,
      title: r.title,
      message: r.message,
      link: r.link,
      readAt: r.readAt,
      createdAt: r.createdAt,
    }));
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  async markAsRead(notificationId: string): Promise<void> {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
