import type { Prisma, PrismaClient } from "@prisma/client";
import type { MarketplaceCustomer } from "../../marketplace/types.ts";

/**
 * Marketplace customer repository (kind: marketplace_customers).
 *
 * The tenant boundary lives here: `org_id` is required on every row.
 * The wallet-evidence invariant (§4.5/§7) means no org column exists on
 * wallet_ledger or evidence_packs; tenancy flows through this table.
 *
 * listByOrg replaces the JSONL readAll + filter in tenancy.ts; ordered
 * by id ascending because the JSONL version's Map-iteration order was
 * incidental and no caller depends on it.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MarketplaceCustomerRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MarketplaceCustomer): Promise<MarketplaceCustomer> {
    await this.client.marketplaceCustomer.upsert({
      where: { id: record.id },
      create: toPrismaCustomer(record),
      update: toPrismaCustomer(record),
    });
    return record;
  }

  async readLatestById(
    id: string,
  ): Promise<MarketplaceCustomer | null> {
    const row = await this.client.marketplaceCustomer.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaCustomer(row);
  }

  async listByOrg(orgId: string): Promise<MarketplaceCustomer[]> {
    const rows = await this.client.marketplaceCustomer.findMany({
      where: { orgId },
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaCustomer);
  }
}

interface MarketplaceCustomerRow {
  readonly id: string;
  readonly orgId: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string | null;
  readonly isDemo: boolean;
  readonly createdAt: Date;
}

function toPrismaCustomer(
  record: MarketplaceCustomer,
): Prisma.MarketplaceCustomerUncheckedCreateInput {
  return {
    id: record.id,
    orgId: record.org_id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    isDemo: record.isDemo,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaCustomer(
  row: MarketplaceCustomerRow,
): MarketplaceCustomer {
  return {
    id: row.id,
    org_id: row.orgId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
  };
}