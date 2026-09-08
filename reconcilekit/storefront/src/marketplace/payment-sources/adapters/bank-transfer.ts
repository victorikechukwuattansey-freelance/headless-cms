import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../../src/domain/model.ts";
import {
  DEFAULT_EVENT_TYPE,
  type PaymentEventInput,
  type SourceConfidence,
} from "../types.ts";

/** Raw bank-statement/import row. Field mapping is explicit, never guessed. */
export interface BankTransferRow {
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: string | null;
  /** Canonical status assigned by the importing party. Defaults to null. */
  readonly status?: CanonicalPaymentStatus | null;
  /** Source-owned row reference (e.g. a statement narative token). */
  readonly sourceReference?: string | null;
  /** Source-owned import identity (e.g. a row/import id). */
  readonly sourceEventId?: string | null;
  readonly sourceAttributes?: SourceAttributes;
}

export function isoToEpochMs(value: string | null): number | null {
  if (value === null || value === "") {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Bank-transfer evidence normalizer. Status is taken verbatim from the import
 * row and defaults to missing — a credit line asserting success is the
 * importer's job, never synthesized here. With no anchor and no merchant
 * reference the event reaches the engine as `MISSING_REFERENCE`; it is never
 * auto-correlated by amount or timing.
 */
export function bankTransferPaymentEvent(
  row: BankTransferRow,
  context: {
    readonly transactionId: string | null;
    readonly merchantReference: string | null;
    readonly sourceConfidence?: SourceConfidence;
  },
): PaymentEventInput {
  return {
    transaction_id: context.transactionId,
    merchant_reference: context.merchantReference,
    payment_source: "BANK_TRANSFER",
    payment_source_reference: row.sourceReference ?? null,
    source_event_id: row.sourceEventId ?? null,
    event_type: DEFAULT_EVENT_TYPE,
    amount: row.amountMinor,
    currency: row.currency,
    status: row.status ?? null,
    occurred_at: isoToEpochMs(row.occurredAt),
    source_confidence: context.sourceConfidence ?? "OBSERVED",
    source_attributes: row.sourceAttributes ?? {},
  };
}
