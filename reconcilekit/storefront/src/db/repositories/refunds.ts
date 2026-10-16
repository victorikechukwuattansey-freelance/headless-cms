import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  RefundLifecycleStatus,
  RefundRecord,
} from "../../marketplace/types.ts";

/**
 * Refund repository (kind: refunds).
 *
 * Ids are deterministic (`ref_<transactionId>`), so insert-as-upsert
 * preserves the JSONL "latest write for an id wins" semantics: initiate
 * then complete reuses the same row, never duplicates it.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class RefundRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: RefundRecord): Promise<RefundRecord> {
    await this.client.refund.upsert({
      where: { id: record.id },
      create: toPrismaRefund(record),
      update: toPrismaRefund(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<RefundRecord | null> {
    const row = await this.client.refund.findUnique({ where: { id } });
    return row === null ? null : fromPrismaRefund(row);
  }
}

interface RefundRow {
  readonly id: string;
  readonly transactionId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly reason: string;
  readonly initiatedAt: Date;
  readonly completedAt: Date | null;
  readonly ledgerReference: string | null;
}

function toPrismaRefund(
  record: RefundRecord,
): Prisma.RefundUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: record.status,
    reason: record.reason,
    initiatedAt: new Date(record.initiatedAt),
    completedAt:
      record.completedAt === null ? null : new Date(record.completedAt),
    ledgerReference: record.ledgerReference,
  };
}

function fromPrismaRefund(row: RefundRow): RefundRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as RefundLifecycleStatus,
    reason: row.reason,
    initiatedAt: row.initiatedAt.toISOString(),
    completedAt:
      row.completedAt === null ? null : row.completedAt.toISOString(),
    ledgerReference: row.ledgerReference,
    simulated: true,
  };
}