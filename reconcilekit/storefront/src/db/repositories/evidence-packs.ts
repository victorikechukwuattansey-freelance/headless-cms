import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import type {
  ReconciliationCode,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type {
  EvidencePack,
  MarketplaceService,
  ReconciliationSnapshot,
  ResolutionStatus,
} from "../../marketplace/types.ts";

/**
 * Evidence pack repository (kind: evidence_packs).
 *
 * The pack id is deterministic (`evp_<transactionId>`) and
 * `transactionId` is `@unique` — one pack per transaction, updated in
 * place when reconciliation re-runs. Insert-as-upsert preserves this
 * exactly: same id, later write wins.
 *
 * No org column on this table (§4.5/§7). Tenancy is transitive via the
 * transaction's customer; the freeze invariant is enforced by schema
 * shape, not by this repository.
 *
 * JSON columns: serviceSnapshot, providerFacts, reconciliation. The
 * `null` case for reconciliation must be `Prisma.DbNull` (SQL NULL),
 * not the JSON literal `null` — the domain's `| null` means "no
 * snapshot", and the two are distinguishable under a read-mode-aware
 * query.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class EvidencePackRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: EvidencePack): Promise<EvidencePack> {
    await this.client.evidencePack.upsert({
      where: { id: record.id },
      create: toPrismaPack(record),
      update: toPrismaPack(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<EvidencePack | null> {
    const row = await this.client.evidencePack.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaPack(row);
  }

  async list(): Promise<EvidencePack[]> {
    const rows = await this.client.evidencePack.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaPack);
  }
}

interface EvidencePackRow {
  readonly id: string;
  readonly transactionId: string;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly paymentReference: string | null;
  readonly serviceSnapshot: Prisma.JsonValue;
  readonly amountMinor: number;
  readonly currency: string;
  readonly timelineEventIds: string[];
  readonly providerFacts: Prisma.JsonValue;
  readonly reconciliation: Prisma.JsonValue | null;
  readonly mismatchFlags: string[];
  readonly resolutionStatus: string;
  readonly auditEventIds: string[];
  readonly createdAt: Date;
}

function toPrismaPack(
  record: EvidencePack,
): Prisma.EvidencePackUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    customerReference: record.customerReference,
    providerReference: record.providerReference,
    paymentReference: record.paymentReference,
    serviceSnapshot: record.serviceSnapshot as unknown as Prisma.InputJsonValue,
    amountMinor: record.amountMinor,
    currency: record.currency,
    timelineEventIds: [...record.timelineEventIds],
    providerFacts: record.providerFacts as unknown as Prisma.InputJsonValue,
    reconciliation:
      record.reconciliation === null
        ? Prisma.DbNull
        : (record.reconciliation as unknown as Prisma.InputJsonValue),
    mismatchFlags: [...record.mismatchFlags],
    resolutionStatus: record.resolutionStatus,
    auditEventIds: [...record.auditEventIds],
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaPack(row: EvidencePackRow): EvidencePack {
  return {
    id: row.id,
    transactionId: row.transactionId,
    customerReference: row.customerReference,
    providerReference: row.providerReference,
    paymentReference: row.paymentReference,
    serviceSnapshot: row.serviceSnapshot as unknown as MarketplaceService,
    amountMinor: row.amountMinor,
    currency: row.currency,
    timelineEventIds: row.timelineEventIds,
    providerFacts: row.providerFacts as unknown as SourceAttributes,
    reconciliation:
      row.reconciliation === null
        ? null
        : (row.reconciliation as unknown as ReconciliationSnapshot),
    mismatchFlags: row.mismatchFlags as readonly ReconciliationCode[],
    resolutionStatus: row.resolutionStatus as ResolutionStatus,
    auditEventIds: row.auditEventIds,
    createdAt: row.createdAt.toISOString(),
    simulated: true,
  };
}
