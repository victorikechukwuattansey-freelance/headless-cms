import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AvailabilityStatus,
  ComplianceStatus,
  FulfillmentType,
  MarketplaceService,
  MarketplaceServiceKind,
  ServiceInputDescriptor,
} from "../../marketplace/types.ts";

/**
 * Catalog service repository (kind: catalog_services).
 *
 * `inputSchema` is stored as JSONB. The domain type is
 * `readonly ServiceInputDescriptor[]`; the mapper casts through
 * `unknown` because Prisma's `JsonValue` is a wider union that does not
 * narrow to the array-of-records shape directly. The writer
 * (`CatalogServiceRepository.insert`) only ever stores a value produced
 * from that same type, so the cast is honest about a known invariant,
 * not a guess.
 *
 * `list()` ordered by `id` ascending — services have no authored display
 * order, and no caller depends on insertion order.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class CatalogServiceRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MarketplaceService): Promise<MarketplaceService> {
    await this.client.catalogService.upsert({
      where: { id: record.id },
      create: toPrismaService(record),
      update: toPrismaService(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplaceService | null> {
    const row = await this.client.catalogService.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaService(row);
  }

  async list(): Promise<MarketplaceService[]> {
    const rows = await this.client.catalogService.findMany({
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaService);
  }
}

interface CatalogServiceRow {
  readonly id: string;
  readonly categoryId: string;
  readonly providerId: string;
  readonly kind: string;
  readonly name: string;
  readonly description: string;
  readonly currency: string;
  readonly baseAmountMinor: number;
  readonly complianceStatus: string;
  readonly fulfillmentType: string;
  readonly availability: string;
  readonly inputSchema: Prisma.JsonValue;
}

function toPrismaService(
  record: MarketplaceService,
): Prisma.CatalogServiceUncheckedCreateInput {
  return {
    id: record.id,
    categoryId: record.categoryId,
    providerId: record.providerId,
    kind: record.kind,
    name: record.name,
    description: record.description,
    currency: record.currency,
    baseAmountMinor: record.baseAmountMinor,
    complianceStatus: record.complianceStatus,
    fulfillmentType: record.fulfillmentType,
    availability: record.availability,
    inputSchema: record.inputSchema as unknown as Prisma.InputJsonValue,
  };
}

function fromPrismaService(row: CatalogServiceRow): MarketplaceService {
  return {
    id: row.id,
    categoryId: row.categoryId,
    providerId: row.providerId,
    kind: row.kind as MarketplaceServiceKind,
    name: row.name,
    description: row.description,
    currency: row.currency,
    baseAmountMinor: row.baseAmountMinor,
    complianceStatus: row.complianceStatus as ComplianceStatus,
    fulfillmentType: row.fulfillmentType as FulfillmentType,
    availability: row.availability as AvailabilityStatus,
    inputSchema:
      row.inputSchema as unknown as readonly ServiceInputDescriptor[],
    simulated: true,
  };
}