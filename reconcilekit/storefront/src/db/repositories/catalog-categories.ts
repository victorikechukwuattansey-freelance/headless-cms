import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CatalogGroup,
  ComplianceStatus,
  MarketplaceCategory,
} from "../../marketplace/types.ts";

/**
 * Catalog category repository (kind: catalog_categories).
 *
 * Read-mostly reference data. `list()` replaces the JSONL readAll: Prisma
 * ids are the PK, so findMany is inherently deduplicated. Ordered by
 * `displayOrder` ascending — the domain array is authored in that order
 * and the catalog UI depends on it.
 *
 * Json-free: all fields are scalar columns.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class CatalogCategoryRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MarketplaceCategory): Promise<MarketplaceCategory> {
    await this.client.catalogCategory.upsert({
      where: { id: record.id },
      create: toPrismaCategory(record),
      update: toPrismaCategory(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplaceCategory | null> {
    const row = await this.client.catalogCategory.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaCategory(row);
  }

  async list(): Promise<MarketplaceCategory[]> {
    const rows = await this.client.catalogCategory.findMany({
      orderBy: { displayOrder: "asc" },
    });
    return rows.map(fromPrismaCategory);
  }
}

interface CatalogCategoryRow {
  readonly id: string;
  readonly group: string;
  readonly name: string;
  readonly description: string;
  readonly complianceStatus: string;
  readonly displayOrder: number;
}

function toPrismaCategory(
  record: MarketplaceCategory,
): Prisma.CatalogCategoryUncheckedCreateInput {
  return {
    id: record.id,
    group: record.group,
    name: record.name,
    description: record.description,
    complianceStatus: record.complianceStatus,
    displayOrder: record.displayOrder,
  };
}

function fromPrismaCategory(row: CatalogCategoryRow): MarketplaceCategory {
  return {
    id: row.id,
    group: row.group as CatalogGroup,
    name: row.name,
    description: row.description,
    complianceStatus: row.complianceStatus as ComplianceStatus,
    displayOrder: row.displayOrder,
    simulated: true,
  };
}
