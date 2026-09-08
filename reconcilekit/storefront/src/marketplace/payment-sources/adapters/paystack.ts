import {
  mapPaystackResponse,
  type PaystackAdapterOptions,
  type PaystackResponse,
} from "../../../../../src/adapters/providers/paystack/paystack.ts";
import {
  DEFAULT_EVENT_TYPE,
  type PaymentEventInput,
  type PaymentSource,
  type SourceConfidence,
} from "../types.ts";

/**
 * Paystack evidence normalizer. Defers every field decision to the root
 * Paystack adapter (`mapPaystackResponse`) so there is exactly one Paystack →
 * canonical mapping in the codebase: abandoned/reversed → `UNKNOWN`, missing
 * status → `null`, missing reference → `null`. The marketplace anchor and
 * merchant reconcile reference are host context, never guessed from the raw
 * payload.
 */
export function paystackPaymentEvent(
  response: PaystackResponse,
  options: PaystackAdapterOptions,
  context: {
    /** Marketplace anchor (`mk_txn_…`). `null` when unknown. */
    readonly transactionId: string | null;
    /** Merchant-side reconciliation matching key when present. The layer
     *  itself never correlates it; exact matching is the engine's job. */
    readonly merchantReference: string | null;
    readonly sourceConfidence?: SourceConfidence;
  },
): PaymentEventInput {
  const mapped = mapPaystackResponse(response, options);
  const data = response.data ?? null;
  const sourceEventId =
    data !== null && data.id !== null && data.id !== undefined
      ? String(data.id)
      : null;
  return {
    transaction_id: context.transactionId,
    merchant_reference: context.merchantReference,
    payment_source: "PAYSTACK" satisfies PaymentSource,
    payment_source_reference: mapped.payment.reference,
    source_event_id: sourceEventId,
    event_type: DEFAULT_EVENT_TYPE,
    amount: mapped.payment.amount,
    currency: mapped.payment.currency,
    status: mapped.payment.status,
    occurred_at: mapped.payment.occurred_at,
    source_confidence: context.sourceConfidence ?? "OBSERVED",
    source_attributes: mapped.source_attributes,
  };
}
