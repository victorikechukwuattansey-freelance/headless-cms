import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import type {
  PaymentEvent,
  PaymentEventType,
  PaymentSource,
  SourceConfidence,
} from "../../marketplace/payment-sources/types.ts";

/**
 * Payment event repository (kind: payment_events).
 *
 * TIMESTAMP SHAPE — the only kind in the codebase where times are NOT ISO
 * strings. The domain type stores `occurred_at` and `observed_at` as epoch
 * milliseconds (number); the schema columns are DateTime. The mapper does
 * number ↔ Date in both directions, and `.getTime()` on read preserves
 * millisecond precision exactly (Postgres timestamptz(6) stores micros,
 * but the domain never carries sub-millisecond values, so the round-trip
 * is lossless by construction).
 *
 * `occurred_at` is nullable; `new Date(null)` would silently coerce to
 * epoch 0, so the write side uses an explicit ternary. `observed_at` is
 * non-nullable in the domain and the schema — no such guard needed.
 *
 * Idempotency: ids are deterministic (`pevt_<stableToken(idempotency_key)>`)
 * and `event_id` and `idempotency_key` are each `@unique`. `insert` is an
 * upsert so a racing caller that bypasses ingest.ts's existence check
 * cannot double-insert — the JSONL store tolerated the race (latest write
 * wins); Postgres would have thrown on the unique constraint without the
 * upsert.
 *
 * No `simulated` field — this is the only record type in the domain
 * without one, matching the schema (no column). Deliberate: payment-source
 * events carry evidence an external source produced.
 *
 * `list()` replaces `listPaymentEvents` (ingest.ts:81). Ordering:
 * `(observedAt asc, id asc)` — `observedAt` comes from `Date.now()` at
 * ingest, so ties are possible; the id carries no ordering signal beyond
 * the idempotency key hash. Ordering is documented best-effort, not a
 * correctness property, and no current caller depends on it.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class PaymentEventRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: PaymentEvent): Promise<PaymentEvent> {
    await this.client.paymentEvent.upsert({
      where: { id: record.id },
      create: toPrismaEvent(record),
      update: toPrismaEvent(record),
    });
    return record;
  }

  async getById(id: string): Promise<PaymentEvent | null> {
    const row = await this.client.paymentEvent.findUnique({ where: { id } });
    return row === null ? null : fromPrismaEvent(row);
  }

  async list(): Promise<PaymentEvent[]> {
    const rows = await this.client.paymentEvent.findMany({
      orderBy: [{ observedAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaEvent);
  }
}

interface PaymentEventRow {
  readonly id: string;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly transactionId: string | null;
  readonly merchantReference: string | null;
  readonly paymentSource: string;
  readonly paymentSourceReference: string | null;
  readonly sourceEventId: string | null;
  readonly eventType: string;
  readonly amount: number;
  readonly currency: string;
  readonly status: string | null;
  readonly occurredAt: Date | null;
  readonly sourceConfidence: string;
  readonly sourceAttributes: Prisma.JsonValue;
  readonly observedAt: Date;
}

function toPrismaEvent(
  record: PaymentEvent,
): Prisma.PaymentEventUncheckedCreateInput {
  return {
    id: record.id,
    eventId: record.event_id,
    idempotencyKey: record.idempotency_key,
    transactionId: record.transaction_id,
    merchantReference: record.merchant_reference,
    paymentSource: record.payment_source,
    paymentSourceReference: record.payment_source_reference,
    sourceEventId: record.source_event_id,
    eventType: record.event_type,
    amount: record.amount,
    currency: record.currency,
    status: record.status,
    occurredAt:
      record.occurred_at === null ? null : new Date(record.occurred_at),
    sourceConfidence: record.source_confidence,
    sourceAttributes:
      record.source_attributes as unknown as Prisma.InputJsonValue,
    observedAt: new Date(record.observed_at),
  };
}

function fromPrismaEvent(row: PaymentEventRow): PaymentEvent {
  return {
    id: row.id,
    event_id: row.eventId,
    idempotency_key: row.idempotencyKey,
    transaction_id: row.transactionId,
    merchant_reference: row.merchantReference,
    payment_source: row.paymentSource as PaymentSource,
    payment_source_reference: row.paymentSourceReference,
    source_event_id: row.sourceEventId,
    event_type: row.eventType as PaymentEventType,
    amount: row.amount,
    currency: row.currency,
    status: row.status as CanonicalPaymentStatus | null,
    occurred_at: row.occurredAt === null ? null : row.occurredAt.getTime(),
    source_confidence: row.sourceConfidence as SourceConfidence,
    source_attributes: row.sourceAttributes as unknown as SourceAttributes,
    observed_at: row.observedAt.getTime(),
  };
}
