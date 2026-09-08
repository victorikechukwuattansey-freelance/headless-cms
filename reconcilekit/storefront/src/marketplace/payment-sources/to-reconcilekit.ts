import type {
  MerchantPayment,
  ProviderPayment,
  ReconciliationConfig,
  ReconciliationReport,
  SourceAttributes,
} from "../../../../src/domain/model.ts";
import { reconcileRecords } from "../../../../src/application/reconcile-records.ts";
import type { ReconcileRecordsRequest } from "../../../../src/application/reconcile-records.ts";
import { DEFINITIVE_SOURCE_STATUSES, type PaymentEvent } from "./types.ts";

/**
 * Feed ingested payment events into the (unchanged) core reconciliation
 * engine. Each event contributes one merchant-side row and, when it carries an
 * anchor and a definitive status, one provider-side row.
 *
 * Identifier semantics (non-negotiable):
 * - `merchant_reference` is `event.merchant_reference ?? event.transaction_id`
 *   — the anchor is an acceptable merchant reference fallback, mirroring
 *   `buildMarketplaceReconcileInput` semantics.
 * - `merchant_record_id` is the transaction anchor (`mk_txn_…`).
 * - `ProviderPayment.reference` is the reconciliation-side join reference —
 *   the engine's provider-side matching key. In this marketplace projection it
 *   carries the marketplace transaction anchor (`mk_txn_…`), exactly like the
 *   bridge. The actual external provider/payment-source reference is preserved
 *   separately as source evidence (`payment_source_reference` and source
 *   attributes) and is never the reconciliation anchor or join key.
 * - `provider_id` is the payment source label.
 */
export function toReconcileKitRequest(
  events: readonly PaymentEvent[],
  config: ReconciliationConfig,
): ReconcileRecordsRequest {
  const merchantPayments: MerchantPayment[] = [];
  const providerPayments: ProviderPayment[] = [];
  const providerSourceAttributes: SourceAttributes[] = [];

  for (const event of events) {
    merchantPayments.push({
      merchant_reference: event.merchant_reference ?? event.transaction_id,
      amount: event.amount,
      currency: event.currency,
      status: event.status,
      occurred_at: event.occurred_at,
      merchant_record_id: event.transaction_id,
    });
    if (
      event.transaction_id !== null &&
      event.status !== null &&
      DEFINITIVE_SOURCE_STATUSES.has(event.status)
    ) {
      providerPayments.push({
        reference: event.transaction_id,
        amount: event.amount,
        currency: event.currency,
        status: event.status,
        occurred_at: event.occurred_at,
        provider_id: event.payment_source,
      });
      providerSourceAttributes.push({
        event_id: event.event_id,
        idempotency_key: event.idempotency_key,
        source_confidence: event.source_confidence,
        observed_at: String(event.observed_at),
        ...(event.payment_source_reference !== null
          ? { payment_source_reference: event.payment_source_reference }
          : {}),
        ...event.source_attributes,
      });
    }
  }

  return {
    merchantPayments,
    providerPayments,
    config,
    providerSourceAttributes:
      providerSourceAttributes.length === 0
        ? undefined
        : providerSourceAttributes,
  };
}

export function reconcilePaymentEvents(
  events: readonly PaymentEvent[],
  config: ReconciliationConfig,
): ReconciliationReport {
  return reconcileRecords(toReconcileKitRequest(events, config));
}
