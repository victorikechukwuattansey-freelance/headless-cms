import type { Prisma, PrismaClient } from "@prisma/client";
import type { ReceiptRecord } from "../../marketplace/types.ts";

/**
 * Receipt repository (kind: receipts).
 *
 * Insert-as-upsert. Ids are deterministic (`rcpt_<transactionId>`), so
 * `issueReceipt` remains idempotent: issuing twice for the same
 * transaction updates the same row.
 *
 * FK note: `evidencePackId` is a hard FK to evidence_packs. The
 * repository does not create that row — receipts always follow an
 * evidence pack, and the caller is responsible for ordering.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class ReceiptRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: ReceiptRecord): Promise<ReceiptRecord> {
    await this.client.receipt.upsert({
      where: { id: record.id },
      create: toPrismaReceipt(record),
      update: toPrismaReceipt(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<ReceiptRecord | null> {
    const row = await this.client.receipt.findUnique({ where: { id } });
    return row === null ? null : fromPrismaReceipt(row);
  }
}

interface ReceiptRow {
  readonly id: string;
  readonly transactionId: string;
  readonly evidencePackId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly issuedAt: Date;
}

function toPrismaReceipt(
  record: ReceiptRecord,
): Prisma.ReceiptUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    evidencePackId: record.evidencePackId,
    amountMinor: record.amountMinor,
    currency: record.currency,
    issuedAt: new Date(record.issuedAt),
  };
}

function fromPrismaReceipt(row: ReceiptRow): ReceiptRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    evidencePackId: row.evidencePackId,
    amountMinor: row.amountMinor,
    currency: row.currency,
    issuedAt: row.issuedAt.toISOString(),
    simulated: true,
  };
}
