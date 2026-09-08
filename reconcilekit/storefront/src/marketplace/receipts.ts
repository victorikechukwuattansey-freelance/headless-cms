import type { Outcome } from "../../../src/domain/model.ts";
import type { JsonlStore } from "../store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import type { ReceiptRecord } from "./types.ts";

/**
 * Phase 2G receipt surface.
 *
 * A receipt is the customer-facing, presentation-safe voucher for a
 * marketplace transaction. It derives strictly from facts already proven by
 * the orchestrator (amount, currency, references, reconcile outcome) and links
 * back to the transaction's Phase 2F evidence pack by deterministic id
 * (`rcpt_<transactionId>` / `evp_<transactionId>`), so no account or
 * reconciliation detail is recomputed here.
 */

export interface BuildReceiptInput {
  readonly transactionId: string;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly label: string;
  readonly reconciliationOutcome: Outcome | null;
  readonly issuedAt: string;
}

export function buildReceipt(input: BuildReceiptInput): ReceiptRecord {
  return {
    id: `rcpt_${input.transactionId}`,
    transactionId: input.transactionId,
    evidencePackId: `evp_${input.transactionId}`,
    amountMinor: input.amountMinor,
    currency: input.currency,
    issuedAt: input.issuedAt,
    simulated: true,
  };
}

export interface IssueReceiptInput {
  readonly transactionId: string;
  readonly customerReference: string;
  readonly providerReference: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly label: string;
  readonly reconciliationOutcome: Outcome | null;
  readonly issuedAt?: string;
}

/**
 * Persist a receipt. Idempotent by id (`rcpt_<transactionId>`): issuing again
 * for the same transaction updates the same record rather than duplicating it.
 */
export async function issueReceipt(
  store: JsonlStore,
  input: IssueReceiptInput,
): Promise<ReceiptRecord> {
  const issuedAt = input.issuedAt ?? WALLET_FIXED_TIMESTAMP;
  const record = buildReceipt({ ...input, issuedAt });
  await store.insert("receipts", record);
  return record;
}

/**
 * Plain-text rendering of a receipt's proven facts. Used for the human-readable
 * receipt surface; never touches provider source attributes or raw codes.
 */
export function renderReceipt(input: BuildReceiptInput): string {
  const reconcileLine =
    input.reconciliationOutcome === null
      ? "Reconcile Kit: not yet reconciled"
      : `Reconcile Kit: ${input.reconciliationOutcome}`;
  return [
    `Receipt ${input.transactionId}`,
    `Description: ${input.label}`,
    `Amount: ${input.amountMinor} ${input.currency}`,
    `Provider reference: ${input.providerReference ?? "not available"}`,
    reconcileLine,
    `Issued: ${input.issuedAt}`,
  ].join("\n");
}
