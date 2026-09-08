import type {
  MerchantPayment,
  ProviderPayment,
} from "../../../src/domain/model.ts";
import { CANONICAL_STATUSES } from "../../../src/domain/validation.ts";
import type { PaymentRecord } from "../domain/types.ts";

/**
 * ReconcileKit bridge: transforms storefront PaymentRecords into the frozen
 * reconciliation engine's two input sides without touching the core.
 *
 * - Merchant side (expected): the storefront's own ledger view. amount comes
 *   from the persisted product price (PaymentRecord.expectedAmount), never
 *   from a request. The Paystack reference is the join key.
 * - Provider side (received): the Paystack facts captured at verification
 *   time, persisted in PaymentRecord.metadata (paystack_amount,
 *   paystack_currency, paystack_canonical_status, paystack_paid_at).
 *   Records that were never verified (PENDING) produce no provider row.
 */
export interface ReconcileBridgeInput {
  readonly merchantPayments: readonly MerchantPayment[];
  readonly providerPayments: readonly ProviderPayment[];
}

interface Identified {
  readonly id: string;
}

/**
 * Latest record per id, in persistent append order (newest line wins),
 * matching readLatestById semantics across all PaymentRecord versions.
 */
export function effectivePaymentRecords<T extends Identified>(
  records: readonly T[],
): T[] {
  const latestByKey = new Map<string, T>();
  for (const record of records) {
    latestByKey.set(record.id, record);
  }
  const seen = new Set<string>();
  const effective: T[] = [];
  for (const record of records) {
    if (latestByKey.get(record.id) === record && !seen.has(record.id)) {
      effective.push(record);
      seen.add(record.id);
    }
  }
  return effective;
}

export function paymentRecordToMerchantPayment(
  record: PaymentRecord,
): MerchantPayment {
  return {
    merchant_reference: record.paystackReference,
    amount: record.expectedAmount,
    currency: record.currency,
    status: record.status,
    occurred_at: merchantOccurredAt(record),
    merchant_record_id: record.orderId,
  };
}

export function paymentRecordToProviderPayment(
  record: PaymentRecord,
): ProviderPayment | null {
  const amount = asPresent(record.metadata.paystack_amount);
  const currency = asPresent(record.metadata.paystack_currency);
  if (amount === null || currency === null) {
    return null;
  }
  const rawStatus = asPresent(record.metadata.paystack_canonical_status);
  return {
    reference: record.paystackReference,
    amount: Number(amount),
    currency,
    status:
      rawStatus !== null &&
      CANONICAL_STATUSES.includes(
        rawStatus as MerchantPayment["status"] & string,
      )
        ? (rawStatus as MerchantPayment["status"])
        : null,
    occurred_at: parseEpochMillis(asPresent(record.metadata.paystack_paid_at)),
    provider_id: null,
  };
}

export function buildReconcileBridgeInput(
  records: readonly PaymentRecord[],
): ReconcileBridgeInput {
  return {
    merchantPayments: records.map(paymentRecordToMerchantPayment),
    providerPayments: records
      .map(paymentRecordToProviderPayment)
      .filter((provider): provider is ProviderPayment => provider !== null),
  };
}

function merchantOccurredAt(record: PaymentRecord): number | null {
  const raw =
    asPresent(record.metadata.paystack_paid_at) ??
    record.paidAt ??
    record.recordedAt;
  return parseEpochMillis(raw);
}

function asPresent(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

function parseEpochMillis(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}
