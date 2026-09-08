import type {
  CanonicalPaymentStatus,
  SourceAttributes,
} from "../../../../../src/domain/model.ts";
import type { WalletLedgerEntry } from "../../types.ts";
import { DEFAULT_EVENT_TYPE, type PaymentEventInput } from "../types.ts";

/**
 * Ledger types that settle to a definitive `SUCCESS`-class payment outcome.
 * `DUPLICATE_DEBIT` is a success-class duplicate signal: the movement is real
 * and must not be dropped, while reconciling it against the same anchor will
 * surface as an ambiguity the engine arbitrates.
 */
const SUCCESS_LEDGER_TYPES: ReadonlySet<string> = new Set([
  "FUNDING_SUCCESS",
  "DEBIT_SUCCESS",
  "REVERSAL_COMPLETED",
  "REFUND_COMPLETED",
  "SETTLEMENT_MATCHED",
  "DUPLICATE_DEBIT",
]);

const FAILED_LEDGER_TYPES: ReadonlySet<string> = new Set([
  "FUNDING_FAILED",
  "DEBIT_FAILED",
  "AUTHORIZATION_FAILED",
]);

/**
 * Ledger type → canonical payment status. Everything not definitively
 * successful or failed (initiated/pending/settlement-mismatch) is `PENDING`;
 * a non-final ledger observation must not be presented as success.
 */
export function walletLedgerTypeToCanonical(
  type: WalletLedgerEntry["type"],
): CanonicalPaymentStatus {
  if (SUCCESS_LEDGER_TYPES.has(type)) {
    return "SUCCESS";
  }
  if (FAILED_LEDGER_TYPES.has(type)) {
    return "FAILED";
  }
  return "PENDING";
}

/**
 * Internal-wallet evidence normalizer. `OPENING_BALANCE` has no payment
 * semantics and yields no event. Every other movement keeps its ledger
 * reference as evidence (`payment_source_reference`), its ledger id as the
 * source identity (`source_event_id`), and the caller-supplied transaction
 * anchor as the only join surface.
 */
export function walletLedgerToPaymentEvent(
  entry: WalletLedgerEntry,
): PaymentEventInput | null {
  if (entry.type === "OPENING_BALANCE") {
    return null;
  }
  const occurredAt = Date.parse(entry.occurredAt);
  return {
    transaction_id: entry.transactionId,
    merchant_reference: entry.transactionId,
    payment_source: "INTERNAL_WALLET",
    payment_source_reference: entry.reference,
    source_event_id: entry.id,
    event_type: DEFAULT_EVENT_TYPE,
    amount: entry.amountMinor,
    currency: entry.currency,
    status: walletLedgerTypeToCanonical(entry.type),
    occurred_at: Number.isNaN(occurredAt) ? null : occurredAt,
    source_confidence: "OBSERVED",
    source_attributes: {
      wallet_id: entry.walletId,
      wallet_ledger_reference: entry.reference,
      wallet_ledger_type: entry.type,
      wallet_ledger_status: entry.status,
      ...entry.metadata,
    } satisfies SourceAttributes,
  };
}
