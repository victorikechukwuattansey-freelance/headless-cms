import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  ReversalLifecycleStatus,
  ReversalRecord,
} from "../../marketplace/types.ts";

/**
 * Reversal repository (kind: reversals).
 *
 * Insert-as-upsert. Ids are deterministic (`rev_<transactionId>`), so
 * reversal records behave like refunds: latest write for an id wins,
 * never duplicated.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class ReversalRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: ReversalRecord): Promise<ReversalRecord> {
    await this.client.reversal.upsert({
      where: { id: record.id },
      create: toPrismaReversal(record),
      update: toPrismaReversal(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<ReversalRecord | null> {
    const row = await this.client.reversal.findUnique({ where: { id } });
    return row === null ? null : fromPrismaReversal(row);
  }
}

interface ReversalRow {
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

function toPrismaReversal(
  record: ReversalRecord,
): Prisma.ReversalUncheckedCreateInput {
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

function fromPrismaReversal(row: ReversalRow): ReversalRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as ReversalLifecycleStatus,
    reason: row.reason,
    initiatedAt: row.initiatedAt.toISOString(),
    completedAt:
      row.completedAt === null ? null : row.completedAt.toISOString(),
    ledgerReference: row.ledgerReference,
    simulated: true,
  };
}