import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../src/domain/model.ts";

/**
 * Payment source vocabulary. Every value is a structural label: the layer only
 * carries evidence that a source produced. `FLUTTERWAVE` and `FUTURE_PSP` are
 * reserved for structural representation only — no live integration exists for
 * them and none is implied.
 */
export type PaymentSource =
  | "PAYSTACK"
  | "BANK_TRANSFER"
  | "INTERNAL_WALLET"
  | "MANUAL_CSV"
  | "FLUTTERWAVE"
  | "FUTURE_PSP";

/**
 * Provenance of an event, never a reconciliation input. `OBSERVED`/`CONFIRMED`
 * come from a live source, `IMPORTED` from a bulk file, `MANUAL` from a human
 * entry. This is metadata only; the matcher ignores it.
 */
export type SourceConfidence =
  "CONFIRMED" | "OBSERVED" | "IMPORTED" | "MANUAL" | "UNKNOWN";

export type PaymentEventType = "PAYMENT";

export const DEFAULT_EVENT_TYPE: PaymentEventType = "PAYMENT";

/**
 * Statuses that carry transaction-level meaning for reconciliation evidence.
 * PENDING and missing statuses deliberately emit no provider record, mirroring
 * the bridge's `EMITTED_PROVIDER_STATUSES`: a non-final source observation must
 * not be presented as a matched-or-mismatched payment.
 */
export const DEFINITIVE_SOURCE_STATUSES: ReadonlySet<CanonicalPaymentStatus> =
  new Set(["SUCCESS", "FAILED", "CANCELLED", "UNKNOWN"]);

/**
 * Draft event produced by an adapter before ingest. No event_id, idempotency
 * key, or observed_at yet — identity and observation are owned by ingest so
 * that adapter dependencies stay pure.
 */
export interface PaymentEventInput {
  /** Marketplace transaction anchor (`mk_txn_…`). `null` when unknown. */
  readonly transaction_id: string | null;
  /** Merchant-side reconciliation matching key when present (for this
   *  marketplace projection usually the anchor). The layer itself never
   *  correlates or fuzzy-matches; exact matching is the engine's job. */
  readonly merchant_reference: string | null;
  readonly payment_source: PaymentSource;
  /** Source-owned reference (e.g. `ps_…`, `wld_…`). Evidence only. */
  readonly payment_source_reference: string | null;
  /** Source-owned event/ledger identity. Part of the idempotency key. */
  readonly source_event_id: string | null;
  readonly event_type: PaymentEventType;
  readonly amount: number;
  readonly currency: string;
  readonly status: CanonicalPaymentStatus | null;
  /** Epoch milliseconds. `null` preserves "unknown" rather than fabricating. */
  readonly occurred_at: number | null;
  readonly source_confidence: SourceConfidence;
  readonly source_attributes: SourceAttributes;
}

export interface PaymentEvent extends PaymentEventInput {
  /** Durable store identity, always equal to `event_id`. */
  readonly id: string;
  readonly event_id: string;
  readonly idempotency_key: string;
  readonly observed_at: number;
}

export interface IngestOutcome {
  readonly recorded: boolean;
  readonly replay: boolean;
  readonly event: PaymentEvent;
}

export type PaymentSourceErrorCode =
  | "PAYMENT_EVENT_NO_SOURCE_IDENTITY"
  | "PAYMENT_EVENT_INVALID_AMOUNT"
  | "PAYMENT_EVENT_UNSUPPORTED_CURRENCY";

export class PaymentSourceError extends Error {
  readonly code: PaymentSourceErrorCode;

  constructor(
    code: PaymentSourceErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PaymentSourceError";
    this.code = code;
  }
}
