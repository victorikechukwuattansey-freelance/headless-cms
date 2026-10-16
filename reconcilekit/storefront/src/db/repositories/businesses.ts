import type { Prisma, PrismaClient } from "@prisma/client";
import type { Business } from "../../domain/types.ts";

/**
 * Legacy business repository (kind: businesses).
 *
 * This is the Phase 2C Paystack acquisition surface, distinct from the
 * marketplace catalog. Both `Business` and the marketplace's
 * `MarketplaceCustomer` exist in the schema; they are not merged.
 *
 * Method surface from server.ts: `insert` (handleCreateBusiness:206),
 * `readLatestById` (handleCreateProduct:224, handleCreateOrder:290). No
 * `list` — no caller in the source reads all businesses.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class BusinessRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: Business): Promise<Business> {
    await this.client.business.upsert({
      where: { id: record.id },
      create: toPrismaBusiness(record),
      update: toPrismaBusiness(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<Business | null> {
    const row = await this.client.business.findUnique({ where: { id } });
    return row === null ? null : fromPrismaBusiness(row);
  }
}

interface BusinessRow {
  readonly id: string;
  readonly name: string;
  readonly createdAt: Date;
}

function toPrismaBusiness(
  record: Business,
): Prisma.BusinessUncheckedCreateInput {
  return {
    id: record.id,
    name: record.name,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaBusiness(row: BusinessRow): Business {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
  };
}
