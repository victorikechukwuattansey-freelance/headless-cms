import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../../src/domain/model.ts";
import {
  DEFAULT_EVENT_TYPE,
  type PaymentEventInput,
  type SourceConfidence,
} from "../types.ts";
import { isoToEpochMs } from "./bank-transfer.ts";

/** A row from a merchant-side import file (e.g. a CSV export). */
export interface ManualCsvRow {
  /** Merchant reconcile reference carried by the file, if any. */
  readonly reference: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly occurredAt: string | null;
  readonly status: CanonicalPaymentStatus | null;
  /** Source-owned row reference (e.g. an external ledger id). */
  readonly sourceReference?: string | null;
  /** Source-owned import identity (e.g. a row/import id). */
  readonly sourceEventId?: string | null;
  readonly sourceAttributes?: SourceAttributes;
}

/**
 * Manual-import evidence normalizer. Confidence is `IMPORTED` by default and
 * survives into source attributes so a human-entered reconciliation can be
 * traced back to its batch — provenance metadata only, never a matcher input.
 */
export function manualCsvPaymentEvent(
  row: ManualCsvRow,
  context: {
    readonly transactionId?: string | null;
    readonly sourceConfidence?: SourceConfidence;
  },
): PaymentEventInput {
  return {
    transaction_id: context.transactionId ?? null,
    merchant_reference: row.reference,
    payment_source: "MANUAL_CSV",
    payment_source_reference: row.sourceReference ?? null,
    source_event_id: row.sourceEventId ?? null,
    event_type: DEFAULT_EVENT_TYPE,
    amount: row.amountMinor,
    currency: row.currency,
    status: row.status,
    occurred_at: isoToEpochMs(row.occurredAt),
    source_confidence: context.sourceConfidence ?? "IMPORTED",
    source_attributes: row.sourceAttributes ?? {},
  };
}
