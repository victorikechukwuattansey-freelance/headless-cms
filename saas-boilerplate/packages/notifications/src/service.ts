import type {
  NotificationChannel,
  NotificationDeliveryType,
  NotificationPayload,
  NotificationRecord,
} from "./types";

export interface NotificationService {
  send(payload: NotificationPayload): Promise<void>;
  sendBulk(payloads: NotificationPayload[]): Promise<void>;
  getNotifications(userId: string, limit?: number): Promise<NotificationRecord[]>;
  getUnreadCount(userId: string): Promise<number>;
  markAsRead(notificationId: string): Promise<void>;
  markAllAsRead(userId: string): Promise<void>;
  getUserPreferences(
    userId: string,
  ): Promise<Record<NotificationChannel, NotificationDeliveryType[]>>;
  updateUserPreferences(
    userId: string,
    channel: NotificationChannel,
    types: NotificationDeliveryType[],
  ): Promise<void>;
}
