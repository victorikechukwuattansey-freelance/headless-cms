import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  MarketplaceOrder,
  MarketplaceOrderStatus,
} from "../../marketplace/types.ts";

/**
 * Marketplace order repository (kind: marketplace_orders).
 *
 * Writes are upserts: `persistOrderStatus` reads the current order and
 * re-inserts it with a new status + updatedAt, which under JSONL was
 * "latest write for an id wins". Under Prisma the same shape is one row
 * per id, updated in place.
 *
 * `inputs` is a JSON column; cast through `unknown` because Prisma's
 * InputJsonValue is wider than Readonly<Record<string, string>>.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MarketplaceOrderRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MarketplaceOrder): Promise<MarketplaceOrder> {
    await this.client.marketplaceOrder.upsert({
      where: { id: record.id },
      create: toPrismaOrder(record),
      update: toPrismaOrder(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplaceOrder | null> {
    const row = await this.client.marketplaceOrder.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaOrder(row);
  }

  async listByCustomer(customerId: string): Promise<MarketplaceOrder[]> {
    const rows = await this.client.marketplaceOrder.findMany({
      where: { customerId },
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaOrder);
  }
}

interface MarketplaceOrderRow {
  readonly id: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly inputs: Prisma.JsonValue;
  readonly quotedAmountMinor: number;
  readonly currency: string;
  readonly customerReference: string;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toPrismaOrder(
  record: MarketplaceOrder,
): Prisma.MarketplaceOrderUncheckedCreateInput {
  return {
    id: record.id,
    customerId: record.customerId,
    serviceId: record.serviceId,
    inputs: record.inputs as unknown as Prisma.InputJsonValue,
    quotedAmountMinor: record.quotedAmountMinor,
    currency: record.currency,
    customerReference: record.customerReference,
    status: record.status,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function fromPrismaOrder(row: MarketplaceOrderRow): MarketplaceOrder {
  return {
    id: row.id,
    customerId: row.customerId,
    serviceId: row.serviceId,
    inputs: row.inputs as unknown as Readonly<Record<string, string>>,
    quotedAmountMinor: row.quotedAmountMinor,
    currency: row.currency,
    customerReference: row.customerReference,
    status: row.status as MarketplaceOrderStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    simulated: true,
  };
}
