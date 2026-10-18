import type { Prisma, PrismaClient } from "@prisma/client";
import type { DisputeRecord, DisputeStatus } from "../../marketplace/types.ts";

/**
 * Dispute repository (kind: disputes).
 *
 * Insert-as-upsert. Ids are deterministic (`dsp_<transactionId>`), so
 * open then resolve reuses the same row. The `customer_id` column is a
 * real FK; the repository does not fabricate or default it — the caller
 * supplies the transaction's customer.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class DisputeRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: DisputeRecord): Promise<DisputeRecord> {
    await this.client.dispute.upsert({
      where: { id: record.id },
      create: toPrismaDispute(record),
      update: toPrismaDispute(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<DisputeRecord | null> {
    const row = await this.client.dispute.findUnique({ where: { id } });
    return row === null ? null : fromPrismaDispute(row);
  }

  async list(): Promise<DisputeRecord[]> {
    const rows = await this.client.dispute.findMany({
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaDispute);
  }
}

interface DisputeRow {
  readonly id: string;
  readonly transactionId: string;
  readonly customerId: string;
  readonly reason: string;
  readonly status: string;
  readonly message: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly resolutionNote: string | null;
}

function toPrismaDispute(
  record: DisputeRecord,
): Prisma.DisputeUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    customerId: record.customerId,
    reason: record.reason,
    status: record.status,
    message: record.message,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
    resolutionNote: record.resolutionNote,
  };
}

function fromPrismaDispute(row: DisputeRow): DisputeRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    customerId: row.customerId,
    reason: row.reason,
    status: row.status as DisputeStatus,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    resolutionNote: row.resolutionNote,
    simulated: true,
  };
}
