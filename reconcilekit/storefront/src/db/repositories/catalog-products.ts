import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AvailabilityStatus,
  CatalogProduct,
  FulfillmentType,
  MarketplaceServiceKind,
  ProductPricing,
} from "../../marketplace/types.ts";

/**
 * Catalog product repository (kind: catalog_products).
 *
 * `pricing` and `attributes` are stored as JSONB. Both casts go through
 * `unknown` because Prisma's `JsonValue` is wider than the domain shapes
 * (ProductPricing has optional numeric fields; attributes is a string
 * record). The writer only ever stores values produced from those same
 * types, so the invariant holds.
 *
 * `list()` ordered by `id` ascending, matching catalog-services.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class CatalogProductRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: CatalogProduct): Promise<CatalogProduct> {
    await this.client.catalogProduct.upsert({
      where: { id: record.id },
      create: toPrismaProduct(record),
      update: toPrismaProduct(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<CatalogProduct | null> {
    const row = await this.client.catalogProduct.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaProduct(row);
  }

  async list(): Promise<CatalogProduct[]> {
    const rows = await this.client.catalogProduct.findMany({
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaProduct);
  }
}

interface CatalogProductRow {
  readonly id: string;
  readonly serviceId: string;
  readonly categoryId: string;
  readonly providerId: string;
  readonly name: string;
  readonly description: string;
  readonly kind: string;
  readonly fulfillmentType: string;
  readonly pricing: Prisma.JsonValue;
  readonly availability: string;
  readonly attributes: Prisma.JsonValue;
}

function toPrismaProduct(
  record: CatalogProduct,
): Prisma.CatalogProductUncheckedCreateInput {
  return {
    id: record.id,
    serviceId: record.serviceId,
    categoryId: record.categoryId,
    providerId: record.providerId,
    name: record.name,
    description: record.description,
    kind: record.kind,
    fulfillmentType: record.fulfillmentType,
    pricing: record.pricing as unknown as Prisma.InputJsonValue,
    availability: record.availability,
    attributes: record.attributes as unknown as Prisma.InputJsonValue,
  };
}

function fromPrismaProduct(row: CatalogProductRow): CatalogProduct {
  return {
    id: row.id,
    serviceId: row.serviceId,
    categoryId: row.categoryId,
    providerId: row.providerId,
    name: row.name,
    description: row.description,
    kind: row.kind as MarketplaceServiceKind,
    fulfillmentType: row.fulfillmentType as FulfillmentType,
    pricing: row.pricing as unknown as ProductPricing,
    availability: row.availability as AvailabilityStatus,
    attributes: row.attributes as unknown as Readonly<Record<string, string>>,
    simulated: true,
  };
}
