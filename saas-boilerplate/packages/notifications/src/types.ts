export type NotificationChannel = "billing" | "product" | "marketing" | "system" | "team";

export type NotificationDeliveryType = "in_app" | "email" | "webhook";

export interface NotificationPayload {
  userId: string;
  type: NotificationDeliveryType;
  channel: NotificationChannel;
  title: string;
  message?: string;
  link?: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationDeliveryType;
  channel: NotificationChannel;
  title: string;
  message: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export class NotificationError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "NotificationError";
  }
}
