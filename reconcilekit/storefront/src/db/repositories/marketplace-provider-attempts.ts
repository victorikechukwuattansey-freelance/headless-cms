import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type {
  MockProviderScenario,
  ProviderAttempt,
  ProviderAttemptStatus,
} from "../../marketplace/types.ts";

/**
 * Marketplace provider attempt repository (kind: marketplace_provider_attempts).
 *
 * Attempts from a single flow share `attemptedAt` (all carry the flow's
 * `now`). Order by (attemptedAt asc, id asc) — for the 1/2/3 attempt
 * numbers in scope this matches insertion order because the id embeds
 * the attempt number as its trailing token. A flow with >9 attempts
 * would need a `seq` column; flagged, not solved here.
 *
 * `listByTransaction` replaces the readAll + filter pattern used by
 * reconcile.ts, transactions.ts, and marketplaceTransactionFacts.
 *
 * `sourceAttributes` is stored as JSONB; cast through `unknown` because
 * Prisma's JsonValue is wider than SourceAttributes.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MarketplaceProviderAttemptRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: ProviderAttempt): Promise<ProviderAttempt> {
    await this.client.marketplaceProviderAttempt.upsert({
      where: { id: record.id },
      create: toPrismaAttempt(record),
      update: toPrismaAttempt(record),
    });
    return record;
  }

  async listByTransaction(transactionId: string): Promise<ProviderAttempt[]> {
    const rows = await this.client.marketplaceProviderAttempt.findMany({
      where: { transactionId },
      orderBy: [{ attemptedAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaAttempt);
  }

  async findByProviderRequestId(
    requestId: string,
  ): Promise<ProviderAttempt | null> {
    const row = await this.client.marketplaceProviderAttempt.findFirst({
      where: { requestReference: requestId },
      orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
    });
    return row === null ? null : fromPrismaAttempt(row);
  }

  async updateStatus(
    id: string,
    patch: {
      readonly status: ProviderAttemptStatus;
      readonly canonicalStatus: CanonicalPaymentStatus | null;
    },
  ): Promise<ProviderAttempt | null> {
    const result = await this.client.marketplaceProviderAttempt.updateMany({
      where: { id },
      data: { status: patch.status, canonicalStatus: patch.canonicalStatus },
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.client.marketplaceProviderAttempt.findUniqueOrThrow({
      where: { id },
    });
    return fromPrismaAttempt(row);
  }

  async list(): Promise<ProviderAttempt[]> {
    const rows = await this.client.marketplaceProviderAttempt.findMany({
      orderBy: [{ attemptedAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaAttempt);
  }
}

interface MarketplaceProviderAttemptRow {
  readonly id: string;
  readonly transactionId: string;
  readonly providerId: string;
  readonly serviceId: string;
  readonly scenario: string;
  readonly requestReference: string;
  readonly providerReference: string | null;
  readonly status: string;
  readonly canonicalStatus: string | null;
  readonly amountMinor: number | null;
  readonly currency: string | null;
  readonly latencyMs: number;
  readonly sourceAttributes: Prisma.JsonValue;
  readonly attemptedAt: Date;
  readonly simulated: boolean;
}

function toPrismaAttempt(
  record: ProviderAttempt,
): Prisma.MarketplaceProviderAttemptUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    providerId: record.providerId,
    serviceId: record.serviceId,
    scenario: record.scenario,
    requestReference: record.requestReference,
    providerReference: record.providerReference,
    status: record.status,
    canonicalStatus: record.canonicalStatus,
    amountMinor: record.amountMinor,
    currency: record.currency,
    latencyMs: record.latencyMs,
    sourceAttributes:
      record.sourceAttributes as unknown as Prisma.InputJsonValue,
    attemptedAt: new Date(record.attemptedAt),
  };
}

function fromPrismaAttempt(
  row: MarketplaceProviderAttemptRow,
): ProviderAttempt {
  return {
    id: row.id,
    transactionId: row.transactionId,
    providerId: row.providerId,
    serviceId: row.serviceId,
    scenario: row.scenario as MockProviderScenario,
    requestReference: row.requestReference,
    providerReference: row.providerReference,
    status: row.status as ProviderAttemptStatus,
    canonicalStatus: row.canonicalStatus as CanonicalPaymentStatus | null,
    amountMinor: row.amountMinor,
    currency: row.currency,
    latencyMs: row.latencyMs,
    sourceAttributes: row.sourceAttributes as unknown as SourceAttributes,
    attemptedAt: row.attemptedAt.toISOString(),
    simulated: row.simulated,
  };
}
