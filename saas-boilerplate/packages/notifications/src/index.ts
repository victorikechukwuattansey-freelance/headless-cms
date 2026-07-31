import { prisma } from "@saas/database";
import { InAppChannel } from "./channels/in-app";
import { EmailChannel } from "./channels/email";
import type {
  NotificationChannel,
  NotificationDeliveryType,
  NotificationPayload,
  NotificationRecord,
} from "./types";
import type { NotificationService } from "./service";

export type { NotificationService };
export type {
  NotificationChannel,
  NotificationDeliveryType,
  NotificationPayload,
  NotificationRecord,
};
export { NotificationError } from "./types";

const inApp = new InAppChannel();
const email = new EmailChannel();

const channelMap: Partial<Record<NotificationDeliveryType, InAppChannel | EmailChannel>> = {
  in_app: inApp,
  email: email,
};

async function send(payload: NotificationPayload): Promise<void> {
  const channel = channelMap[payload.type];
  if (channel) {
    await channel.send(payload);
  }
}

async function sendBulk(payloads: NotificationPayload[]): Promise<void> {
  const grouped: Record<string, NotificationPayload[]> = {};
  for (const p of payloads) {
    (grouped[p.type] ??= []).push(p);
  }

  await Promise.all(
    Object.entries(grouped).map(([type, group]) => {
      const channel = channelMap[type as keyof typeof channelMap];
      return channel ? channel.sendBulk(group) : Promise.resolve();
    }),
  );
}

export const notificationService: NotificationService = {
  send,
  sendBulk,

  async getNotifications(userId: string, limit = 50): Promise<NotificationRecord[]> {
    return inApp.getNotifications(userId, limit);
  },

  async getUnreadCount(userId: string): Promise<number> {
    return inApp.getUnreadCount(userId);
  },

  async markAsRead(notificationId: string): Promise<void> {
    return inApp.markAsRead(notificationId);
  },

  async markAllAsRead(userId: string): Promise<void> {
    return inApp.markAllAsRead(userId);
  },

  async getUserPreferences(_userId: string) {
    return {} as Record<NotificationChannel, NotificationDeliveryType[]>;
  },

  async updateUserPreferences() {},
};
