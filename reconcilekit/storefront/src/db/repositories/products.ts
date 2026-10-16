import type { Prisma, PrismaClient } from "@prisma/client";
import type { Product } from "../../domain/types.ts";

/**
 * Legacy product repository (kind: products). Phase 2C acquisition surface.
 *
 * Method surface from server.ts: `insert` (handleCreateProduct:238),
 * `readLatestById` (handleCreateOrder:297). No `list`.
 *
 * FK note: `businessId` is a hard FK. The repository does not create the
 * business — server.ts checks existence first (handleCreateProduct:222).
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class ProductRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: Product): Promise<Product> {
    await this.client.product.upsert({
      where: { id: record.id },
      create: toPrismaProduct(record),
      update: toPrismaProduct(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<Product | null> {
    const row = await this.client.product.findUnique({ where: { id } });
    return row === null ? null : fromPrismaProduct(row);
  }
}

interface ProductRow {
  readonly id: string;
  readonly businessId: string;
  readonly name: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly createdAt: Date;
}

function toPrismaProduct(
  record: Product,
): Prisma.ProductUncheckedCreateInput {
  return {
    id: record.id,
    businessId: record.businessId,
    name: record.name,
    priceMinor: record.priceMinor,
    currency: record.currency,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaProduct(row: ProductRow): Product {
  return {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    priceMinor: row.priceMinor,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
  };
}