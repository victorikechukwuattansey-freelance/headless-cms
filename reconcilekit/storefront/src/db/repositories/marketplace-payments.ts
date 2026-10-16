import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type { MarketplacePaymentRecord } from "../../marketplace/types.ts";

/**
 * Marketplace payment repository (kind: marketplace_payments).
 *
 * NOTE — new kind, not yet in StoreKind. This repo targets the
 * `marketplace_payments` Prisma table (created by the addendum migration)
 * while the JSONL store still writes to the legacy `payments` kind. The
 * repoint of the five marketplace call sites (`resolution.ts:87`,
 * `transactions.ts:2400/2455`, `client.ts:654`, plus the write at
 * `transactions.ts:656`) is 5B.1c / 5B.1e. This repo can land now;
 * tests target its own table and the collision is invisible to them.
 *
 * The legacy `Payment` model is a different shape and keeps the `payments`
 * table. Do not merge the two.
 *
 * `findByOrderId` replaces the readAll + .find pattern used by
 * marketplaceTransactionFacts, replayResult, and requirePayment. It
 * orders by recordedAt desc so the "latest write wins" contract carries
 * over even though `order_id` is not unique in the schema — the write
 * path (`toWalletPaymentRecord` with `orderId ?? transactionId`) produces
 * one row per id, and the id is stable per transaction, so in practice
 * there is at most one row per orderId.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MarketplacePaymentRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(
    record: MarketplacePaymentRecord,
  ): Promise<MarketplacePaymentRecord> {
    await this.client.marketplacePayment.upsert({
      where: { id: record.id },
      create: toPrismaPayment(record),
      update: toPrismaPayment(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplacePaymentRecord | null> {
    const row = await this.client.marketplacePayment.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaPayment(row);
  }

  async findByOrderId(
    orderId: string,
  ): Promise<MarketplacePaymentRecord | null> {
    const row = await this.client.marketplacePayment.findFirst({
      where: { orderId },
      orderBy: { recordedAt: "desc" },
    });
    return row === null ? null : fromPrismaPayment(row);
  }
}

interface MarketplacePaymentRow {
  readonly id: string;
  readonly transactionId: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly walletReference: string;
  readonly providerReference: string | null;
  readonly expectedAmountMinor: number;
  readonly actualAmountMinor: number | null;
  readonly currency: string;
  readonly status: string;
  readonly paidAt: Date | null;
  readonly metadata: Prisma.JsonValue;
  readonly recordedAt: Date;
}

function toPrismaPayment(
  record: MarketplacePaymentRecord,
): Prisma.MarketplacePaymentUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    orderId: record.orderId,
    customerId: record.customerId,
    walletReference: record.walletReference,
    providerReference: record.providerReference,
    expectedAmountMinor: record.expectedAmountMinor,
    actualAmountMinor: record.actualAmountMinor,
    currency: record.currency,
    status: record.status,
    paidAt: record.paidAt === null ? null : new Date(record.paidAt),
    metadata: record.metadata as unknown as Prisma.InputJsonValue,
    recordedAt: new Date(record.recordedAt),
  };
}

function fromPrismaPayment(
  row: MarketplacePaymentRow,
): MarketplacePaymentRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    orderId: row.orderId,
    customerId: row.customerId,
    walletReference: row.walletReference,
    providerReference: row.providerReference,
    expectedAmountMinor: row.expectedAmountMinor,
    actualAmountMinor: row.actualAmountMinor,
    currency: row.currency,
    status: row.status as CanonicalPaymentStatus,
    paidAt: row.paidAt === null ? null : row.paidAt.toISOString(),
    metadata: row.metadata as unknown as SourceAttributes,
    recordedAt: row.recordedAt.toISOString(),
    simulated: true,
  };
}
