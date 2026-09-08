export type CanonicalPaymentStatus =
  "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED" | "UNKNOWN";

export type CurrencyCode = string;

export type Timestamp = number;

export type SourceAttributes = Readonly<Record<string, string>>;

export type PaymentSide = "merchant" | "provider";

export interface MerchantPayment {
  readonly merchant_reference: string | null;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: CanonicalPaymentStatus | null;
  readonly occurred_at: Timestamp | null;
  readonly merchant_record_id: string | null;
}

export interface ProviderPayment {
  readonly reference: string | null;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: CanonicalPaymentStatus | null;
  readonly occurred_at: Timestamp | null;
  readonly provider_id: string | null;
}

export interface NormalizedPayment {
  readonly reference: string | null;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: CanonicalPaymentStatus | null;
  readonly occurred_at: Timestamp | null;
  readonly source: PaymentSide;
  readonly source_id: string | null;
  readonly source_attributes: SourceAttributes;
}

export interface MatchCandidate {
  readonly merchant_payment: MerchantPayment;
  readonly provider_payment: ProviderPayment;
}

export type Outcome =
  | "MATCH"
  | "DISCREPANCY"
  | "UNRESOLVED"
  | "HELD_AMBIGUOUS"
  | "INPUT_ERROR"
  | "MISSING_PROVIDER_RECORD"
  | "UNMATCHED_PROVIDER_RECORD"
  | "MISSING_REFERENCE";

export type DiscrepancyCode =
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "STATUS_MISMATCH"
  | "TEMPORAL_ANOMALY"
  | "DUPLICATE_MERCHANT_RECORD"
  | "DUPLICATE_PROVIDER_RECORD"
  | "CONFLICTING_ATTRIBUTES";

export type ValidationCode = "STATUS_UNRESOLVED";

export type ReconciliationCode = DiscrepancyCode | ValidationCode;

export interface MatchResult {
  readonly outcome: Outcome;
  readonly merchant_record: MerchantPayment | null;
  readonly provider_record: ProviderPayment | null;
  readonly discrepancy_codes: readonly ReconciliationCode[];
  readonly validation_notes: readonly string[];
  readonly source_attributes: SourceAttributes;
}

export interface ReconciliationSummary {
  readonly totalRecords: number;
  readonly matched: number;
  readonly discrepancies: number;
  readonly unresolved: number;
  readonly heldAmbiguous: number;
  readonly inputErrors: number;
  readonly missingProviderRecords: number;
  readonly unmatchedProviderRecords: number;
  readonly missingReference: number;
  readonly countsByDiscrepancyCode: Readonly<
    Record<ReconciliationCode, number>
  >;
}

export interface ReconciliationReport {
  readonly summary: ReconciliationSummary;
  readonly results: readonly MatchResult[];
}

export type TimestampValidationConfig =
  | { readonly enabled: false }
  | { readonly enabled: true; readonly toleranceMs: number };

export interface ReconciliationConfig {
  readonly timestampValidation: TimestampValidationConfig;
  readonly supportedCurrencies: readonly CurrencyCode[];
}

export interface ValidationResult {
  readonly applicable: boolean;
  readonly passed: boolean;
  readonly code: ReconciliationCode | null;
  readonly note: string | null;
}

export type InputValidation =
  { readonly valid: true } | { readonly valid: false; readonly note: string };

export function normalizePayment(
  payment: MerchantPayment | ProviderPayment,
  side: PaymentSide,
  sourceAttributes: SourceAttributes = {},
): NormalizedPayment {
  const reference =
    "merchant_reference" in payment
      ? payment.merchant_reference
      : payment.reference;
  const sourceId =
    "merchant_record_id" in payment
      ? payment.merchant_record_id
      : payment.provider_id;
  return {
    reference,
    amount: payment.amount,
    currency: payment.currency,
    status: payment.status,
    occurred_at: payment.occurred_at,
    source: side,
    source_id: sourceId,
    source_attributes: sourceAttributes,
  };
}
