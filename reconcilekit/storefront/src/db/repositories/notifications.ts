import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  NotificationRecord,
  NotificationStatus,
} from "../../marketplace/types.ts";

/**
 * Notification repository (kind: notifications).
 *
 * Insert-as-upsert. Ids are deterministic per
 * (customer, kind, transaction), so a replayed emission updates the
 * same row instead of duplicating it. This is why `listByCustomer`
 * does NOT collapse by id the way the JSONL version does: there is
 * only ever one row per id to begin with.
 *
 * Ordering: newest first — (createdAt desc, id desc). This matches
 * listNotificationsByCustomer in notifications.ts.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class NotificationRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: NotificationRecord): Promise<NotificationRecord> {
    await this.client.notification.upsert({
      where: { id: record.id },
      create: toPrismaNotification(record),
      update: toPrismaNotification(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<NotificationRecord | null> {
    const row = await this.client.notification.findUnique({ where: { id } });
    return row === null ? null : fromPrismaNotification(row);
  }

  async listByCustomer(customerId: string): Promise<NotificationRecord[]> {
    const rows = await this.client.notification.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(fromPrismaNotification);
  }
}

interface NotificationRow {
  readonly id: string;
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: Date;
}

function toPrismaNotification(
  record: NotificationRecord,
): Prisma.NotificationUncheckedCreateInput {
  return {
    id: record.id,
    customerId: record.customerId,
    transactionId: record.transactionId,
    title: record.title,
    body: record.body,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    transactionId: row.transactionId,
    title: row.title,
    body: row.body,
    status: row.status as NotificationStatus,
    createdAt: row.createdAt.toISOString(),
    simulated: true,
  };
}
