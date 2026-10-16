import type { Prisma, PrismaClient } from "@prisma/client";
import type { Order, OrderStatus } from "../../domain/types.ts";

/**
 * Legacy order repository (kind: orders). Phase 2C acquisition surface.
 *
 * `insert` is an upsert. server.ts writes the same order id twice in the
 * failure path? No — it writes an INITIALIZATION_FAILED order and returns;
 * the success path writes one order. Under JSONL both would still be
 * "one row per id, latest wins"; under Prisma, upsert.
 *
 * `paystackReference` and `authorizationUrl` are nullable in both domain
 * and schema — direct pass, no coercion.
 *
 * Method surface: `insert` (server.ts:handleCreateOrder), `readLatestById`
 * (server.ts + verify-order.ts). No `list` — no caller reads all orders.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class OrderRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: Order): Promise<Order> {
    await this.client.order.upsert({
      where: { id: record.id },
      create: toPrismaOrder(record),
      update: toPrismaOrder(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<Order | null> {
    const row = await this.client.order.findUnique({ where: { id } });
    return row === null ? null : fromPrismaOrder(row);
  }
}

interface OrderRow {
  readonly id: string;
  readonly businessId: string;
  readonly productId: string;
  readonly customerEmail: string;
  readonly expectedAmountMinor: number;
  readonly currency: string;
  readonly status: string;
  readonly paystackReference: string | null;
  readonly authorizationUrl: string | null;
  readonly createdAt: Date;
}

function toPrismaOrder(record: Order): Prisma.OrderUncheckedCreateInput {
  return {
    id: record.id,
    businessId: record.businessId,
    productId: record.productId,
    customerEmail: record.customerEmail,
    expectedAmountMinor: record.expectedAmountMinor,
    currency: record.currency,
    status: record.status,
    paystackReference: record.paystackReference,
    authorizationUrl: record.authorizationUrl,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaOrder(row: OrderRow): Order {
  return {
    id: row.id,
    businessId: row.businessId,
    productId: row.productId,
    customerEmail: row.customerEmail,
    expectedAmountMinor: row.expectedAmountMinor,
    currency: row.currency,
    status: row.status as OrderStatus,
    paystackReference: row.paystackReference,
    authorizationUrl: row.authorizationUrl,
    createdAt: row.createdAt.toISOString(),
  };
}
