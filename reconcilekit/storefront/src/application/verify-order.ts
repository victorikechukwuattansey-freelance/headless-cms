import type { CanonicalPaymentStatus } from "../../../src/domain/model.ts";
import { PaystackAdapterError } from "../../../src/adapters/providers/paystack/paystack.ts";
import { PaystackClientError } from "../paystack/client.ts";
import type { PaystackGateway } from "../paystack/gateway.ts";
import type { PaymentRecord } from "../domain/types.ts";
import type { Repositories } from "../db/repositories/index.ts";

export type IntegrityStatus =
  | "OK"
  | "AMOUNT_MISMATCH"
  | "CURRENCY_MISMATCH"
  | "AMOUNT_MISMATCH,CURRENCY_MISMATCH";

export type VerifyOrderResult =
  | {
      readonly kind: "verified";
      readonly payment: PaymentRecord;
      readonly changed: boolean;
    }
  | { readonly kind: "order_not_found" }
  | { readonly kind: "not_initialized" }
  | { readonly kind: "reference_mismatch" }
  | { readonly kind: "verify_failed"; readonly causeCode: string | null };

/**
 * Verifies the persisted order's Paystack reference and, if the effective
 * payment state changed, writes an updated PaymentRecord (latest wins).
 *
 * Data integrity rules:
 * - The persisted order owns the reference; a client-supplied reference is
 *   never used to decide which transaction to verify.
 * - If Paystack's returned reference differs from the persisted one, the
 *   result is a REFERENCE_MISMATCH and nothing is recorded.
 * - A Paystack transaction only becomes a SUCCESS PaymentRecord when the
 *   Paystack amount and currency equal the persisted expected amount and
 *   currency, and the canonical status is SUCCESS. Any integrity difference
 *   records the payment as UNKNOWN with the raw facts preserved in metadata.
 * - Transient provider failures (network, HTTP, malformed payloads) leave
 *   the effective PaymentRecord untouched.
 *
 * Idempotency:
 * - The candidate record is compared against the current effective record
 *   on (status, paidAt). Identical states are not rewritten, so repeated
 *   verification never creates contradictory records or duplicate effects.
 */
export async function verifyOrder(
  repos: Repositories,
  gateway: PaystackGateway,
  orderId: string,
): Promise<VerifyOrderResult> {
  const order = await repos.orders.readLatestById(orderId);
  if (order === null) {
    return { kind: "order_not_found" };
  }
  const expectedReference = order.paystackReference;
  if (expectedReference === null) {
    return { kind: "not_initialized" };
  }

  let mapped;
  try {
    mapped = await gateway.verifyTransaction({
      reference: expectedReference,
      supportedCurrencies: [order.currency],
    });
  } catch (error) {
    const causeCode =
      error instanceof PaystackClientError ||
      error instanceof PaystackAdapterError
        ? error.code
        : null;
    return { kind: "verify_failed", causeCode };
  }

  if (mapped.payment.reference !== expectedReference) {
    return { kind: "reference_mismatch" };
  }

  const paystackStatus: CanonicalPaymentStatus =
    mapped.payment.status ?? "UNKNOWN";
  const amountOk = mapped.payment.amount === order.expectedAmountMinor;
  const currencyOk = mapped.payment.currency === order.currency;
  const integrity: IntegrityStatus =
    !amountOk && !currencyOk
      ? "AMOUNT_MISMATCH,CURRENCY_MISMATCH"
      : !amountOk
        ? "AMOUNT_MISMATCH"
        : !currencyOk
          ? "CURRENCY_MISMATCH"
          : "OK";

  const current = await repos.payments.readLatestById(orderId);
  const baseMetadata: Readonly<Record<string, string>> =
    current?.metadata ?? {};

  const cleanSuccess = paystackStatus === "SUCCESS" && integrity === "OK";
  const effectiveStatus: CanonicalPaymentStatus = cleanSuccess
    ? "SUCCESS"
    : paystackStatus === "SUCCESS"
      ? "UNKNOWN"
      : paystackStatus;
  const paidAt =
    cleanSuccess && mapped.payment.occurred_at !== null
      ? new Date(mapped.payment.occurred_at).toISOString()
      : null;

  const verifiedAt = new Date().toISOString();
  const candidate: PaymentRecord = {
    id: order.id,
    businessId: order.businessId,
    orderId: order.id,
    expectedAmount: order.expectedAmountMinor,
    currency: order.currency,
    paystackReference: expectedReference,
    status: effectiveStatus,
    paidAt,
    refundStatus: "NONE",
    metadata: {
      ...baseMetadata,
      verified_at: verifiedAt,
      paystack_canonical_status: paystackStatus,
      integrity,
      paystack_amount: String(mapped.payment.amount),
      paystack_currency: mapped.payment.currency,
      ...(mapped.payment.occurred_at !== null
        ? {
            paystack_paid_at: new Date(
              mapped.payment.occurred_at,
            ).toISOString(),
          }
        : {}),
    },
    recordedAt: verifiedAt,
  };

  if (
    current !== null &&
    current.status === candidate.status &&
    current.paidAt === candidate.paidAt
  ) {
    return { kind: "verified", payment: current, changed: false };
  }

  await repos.payments.insert(candidate);
  return { kind: "verified", payment: candidate, changed: true };
}
