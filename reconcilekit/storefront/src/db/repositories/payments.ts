import type { Prisma, PrismaClient } from "@prisma/client";
import type { CanonicalPaymentStatus } from "../../../../src/domain/model.ts";
import type { PaymentRecord, RefundStatus } from "../../domain/types.ts";

/**
 * Legacy payment repository (kind: payments). Phase 2C Paystack acquisition
 * surface. **Distinct from MarketplacePaymentRepository** — the two share
 * nothing but a naming convention, and this one owns the `payments` table
 * while the marketplace's owns `marketplace_payments`. Do not merge.
 *
 * Idempotency: the payment id is the order id (verify-order.ts:130 and
 * server.ts:handleCreateOrder both write `id: order.id`). Later verification
 * appends a new record with the same id → upsert here, matching "latest
 * write for an id wins".
 *
 * Nullability: after the `payments_reference_not_null` migration, the
 * column is NOT NULL, matching the domain's `paystackReference: string`.
 * Every write path enforces non-null by control flow (verify-order.ts:41-44
 * returns `not_initialized` before any write; handleCreateOrder writes only
 * after a successful initializeTransaction).
 *
 * Method surface:
 *   - `insert` (server.ts:handleCreateOrder, verify-order.ts:145)
 *   - `readLatestById` (verify-order.ts:82)
 *   - `list` (server.ts:handleReconcile:528, handleReconcileCsv:566 —
 *     replaces `readAll<PaymentRecord>("payments")` + the outer
 *     `effectivePaymentRecords` reduction; under Postgres the PK
 *     deduplicates naturally, so the caller's reduction becomes identity)
 *   - `findByOrderId` (server.ts:handleReconcile:530 — replaces the
 *     `readAll + .filter(orderId)` pattern)
 *
 * `metadata` is a JSON column cast through `unknown`. `status` and
 * `refundStatus` are enums-as-strings; direct cast to the domain union.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class PaymentRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: PaymentRecord): Promise<PaymentRecord> {
    await this.client.payment.upsert({
      where: { id: record.id },
      create: toPrismaPayment(record),
      update: toPrismaPayment(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<PaymentRecord | null> {
    const row = await this.client.payment.findUnique({ where: { id } });
    return row === null ? null : fromPrismaPayment(row);
  }

  async list(): Promise<PaymentRecord[]> {
    const rows = await this.client.payment.findMany({
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaPayment);
  }

  async findByOrderId(orderId: string): Promise<PaymentRecord | null> {
    const row = await this.client.payment.findFirst({
      where: { orderId },
      orderBy: { recordedAt: "desc" },
    });
    return row === null ? null : fromPrismaPayment(row);
  }
}

interface PaymentRow {
  readonly id: string;
  readonly orderId: string;
  readonly businessId: string;
  readonly expectedAmount: number;
  readonly currency: string;
  readonly paystackReference: string;
  readonly status: string;
  readonly paidAt: Date | null;
  readonly refundStatus: string;
  readonly metadata: Prisma.JsonValue;
  readonly recordedAt: Date;
}

function toPrismaPayment(
  record: PaymentRecord,
): Prisma.PaymentUncheckedCreateInput {
  return {
    id: record.id,
    orderId: record.orderId,
    businessId: record.businessId,
    expectedAmount: record.expectedAmount,
    currency: record.currency,
    paystackReference: record.paystackReference,
    status: record.status,
    paidAt: record.paidAt === null ? null : new Date(record.paidAt),
    refundStatus: record.refundStatus,
    metadata: record.metadata as unknown as Prisma.InputJsonValue,
    recordedAt: new Date(record.recordedAt),
  };
}

function fromPrismaPayment(row: PaymentRow): PaymentRecord {
  return {
    id: row.id,
    businessId: row.businessId,
    orderId: row.orderId,
    expectedAmount: row.expectedAmount,
    currency: row.currency,
    paystackReference: row.paystackReference,
    status: row.status as CanonicalPaymentStatus,
    paidAt: row.paidAt === null ? null : row.paidAt.toISOString(),
    refundStatus: row.refundStatus as RefundStatus,
    metadata: row.metadata as unknown as Readonly<Record<string, string>>,
    recordedAt: row.recordedAt.toISOString(),
  };
}
