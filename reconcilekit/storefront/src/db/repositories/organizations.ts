import type { Prisma, PrismaClient } from "@prisma/client";
import type { OrganizationRecord } from "../../marketplace/types.ts";

/**
 * Organization repository (kind: organizations).
 *
 * `list()` replaces the JSONL "readAll + collapse by id" pattern. Prisma
 * ids are the PK, so findMany is inherently deduplicated; no Map pass
 * needed. Ordered by id ascending for determinism — organizations are a
 * reference set, not a sequenced stream, and no caller depends on
 * insertion order.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class OrganizationRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: OrganizationRecord): Promise<OrganizationRecord> {
    await this.client.organization.upsert({
      where: { id: record.id },
      create: toPrismaOrganization(record),
      update: toPrismaOrganization(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<OrganizationRecord | null> {
    const row = await this.client.organization.findUnique({ where: { id } });
    return row === null ? null : fromPrismaOrganization(row);
  }

  async list(): Promise<OrganizationRecord[]> {
    const rows = await this.client.organization.findMany({
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaOrganization);
  }
}

interface OrganizationRow {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

function toPrismaOrganization(
  record: OrganizationRecord,
): Prisma.OrganizationUncheckedCreateInput {
  return {
    id: record.id,
    name: record.name,
    createdAt: new Date(record.created_at),
  };
}

function fromPrismaOrganization(row: OrganizationRow): OrganizationRecord {
  return {
    id: row.id,
    name: row.name,
    created_at: row.createdAt.toISOString(),
    simulated: true,
  };
}
