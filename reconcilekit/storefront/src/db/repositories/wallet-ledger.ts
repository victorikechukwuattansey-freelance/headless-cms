import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  WalletLedgerEntry,
  WalletLedgerStatus,
  WalletLedgerType,
} from "../../marketplace/types.ts";

/**
 * Wallet ledger repository (kind: wallet_ledger).
 *
 * Append-many kind: no upsert-over-a-single-id semantics to preserve here
 * beyond the generic "latest write for an id wins" (which is still honoured
 * via upsert, matching the JSONL store's readLatestById behaviour).
 *
 * Ordering note:
 *   Every entry produced by a single wallet flow shares `occurredAt`
 *   (WALLET_FIXED_TIMESTAMP). The id's trailing seq sits behind a
 *   type-prefixed token, so lexicographic `id asc` does NOT reproduce
 *   insertion order for mixed-type flows — e.g. REVERSAL_COMPLETED sorts
 *   before REVERSAL_INITIATED, REFUND_COMPLETED before REFUND_PENDING.
 *   We order by (occurredAt asc, id asc) for determinism only. Consumers
 *   of these reads MUST be order-independent across same-timestamp rows.
 *   deriveWalletBalance and checkLedgerConsistency already are.
 *
 *   If a future caller needs true insertion order, add a `seq Int` column
 *   to WalletLedgerEntry — a real migration, not a heuristic.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class WalletLedgerRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: WalletLedgerEntry): Promise<WalletLedgerEntry> {
    await this.client.walletLedgerEntry.upsert({
      where: { id: record.id },
      create: toPrismaEntry(record),
      update: toPrismaEntry(record),
    });
    return record;
  }

  async listByWallet(walletId: string): Promise<WalletLedgerEntry[]> {
    const rows = await this.client.walletLedgerEntry.findMany({
      where: { walletId },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaEntry);
  }

  async listByTransaction(
    transactionId: string,
  ): Promise<WalletLedgerEntry[]> {
    const rows = await this.client.walletLedgerEntry.findMany({
      where: { transactionId },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaEntry);
  }
}

interface WalletLedgerRow {
  readonly id: string;
  readonly walletId: string;
  readonly transactionId: string | null;
  readonly type: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly reference: string;
  readonly occurredAt: Date;
  readonly metadata: Prisma.JsonValue;
}

function toPrismaEntry(
  record: WalletLedgerEntry,
): Prisma.WalletLedgerEntryUncheckedCreateInput {
  return {
    id: record.id,
    walletId: record.walletId,
    transactionId: record.transactionId,
    type: record.type,
    amountMinor: record.amountMinor,
    currency: record.currency,
    status: record.status,
    reference: record.reference,
    occurredAt: new Date(record.occurredAt),
    metadata: record.metadata,
  };
}

function fromPrismaEntry(row: WalletLedgerRow): WalletLedgerEntry {
  return {
    id: row.id,
    walletId: row.walletId,
    transactionId: row.transactionId,
    type: row.type as WalletLedgerType,
    amountMinor: row.amountMinor,
    currency: row.currency,
    status: row.status as WalletLedgerStatus,
    reference: row.reference,
    occurredAt: row.occurredAt.toISOString(),
    metadata: row.metadata as WalletLedgerEntry["metadata"],
    simulated: true,
  };
}