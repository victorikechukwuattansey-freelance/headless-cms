import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ManualReviewRecord,
  ManualReviewStatus,
} from "../../marketplace/types.ts";

/**
 * Manual review repository (kind: manual_reviews).
 *
 * Insert-as-upsert. Ids are deterministic (`mr_<transactionId>`). Note
 * that `assignedTo` and `operatorNote` are nullable; the domain type
 * carries the same nullability, so no coercion happens in the mapper.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class ManualReviewRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: ManualReviewRecord): Promise<ManualReviewRecord> {
    await this.client.manualReview.upsert({
      where: { id: record.id },
      create: toPrismaReview(record),
      update: toPrismaReview(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<ManualReviewRecord | null> {
    const row = await this.client.manualReview.findUnique({ where: { id } });
    return row === null ? null : fromPrismaReview(row);
  }
}

interface ManualReviewRow {
  readonly id: string;
  readonly transactionId: string;
  readonly reason: string;
  readonly status: string;
  readonly assignedTo: string | null;
  readonly createdAt: Date;
  readonly resolvedAt: Date | null;
  readonly operatorNote: string | null;
}

function toPrismaReview(
  record: ManualReviewRecord,
): Prisma.ManualReviewUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    reason: record.reason,
    status: record.status,
    assignedTo: record.assignedTo,
    createdAt: new Date(record.createdAt),
    resolvedAt:
      record.resolvedAt === null ? null : new Date(record.resolvedAt),
    operatorNote: record.operatorNote,
  };
}

function fromPrismaReview(row: ManualReviewRow): ManualReviewRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    reason: row.reason,
    status: row.status as ManualReviewStatus,
    assignedTo: row.assignedTo,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt === null ? null : row.resolvedAt.toISOString(),
    operatorNote: row.operatorNote,
    simulated: true,
  };
}