import type { JsonlStore } from "../store/jsonl-store.ts";
import type { Repositories } from "../db/repositories/index.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import {
  completeRefund,
  findWalletByCustomer,
  initiateRefund,
  reverseDebit,
} from "./wallet.ts";
import {
  appendTransactionEvent,
  sourceAttributes,
  TransactionEventType,
} from "./timeline.ts";
import type {
  DisputeRecord,
  MarketplacePaymentRecord,
  MarketplaceTransaction,
  MarketplaceWallet,
  ManualReviewRecord,
  RefundRecord,
  ResolutionStatus,
  ReversalRecord,
  TransactionEvent,
  WalletLedgerEntry,
} from "./types.ts";

/**
 * Phase 2G resolution surface.
 *
 * Operator- and customer-driven resolution transitions (refund, reversal,
 * dispute, manual review) on top of the existing wallet ledger and timeline.
 * Every transition:
 * - performs the wallet ledger change through the existing wallet module
 *   (initiateRefund / completeRefund / reverseDebit — never a bespoke ledger),
 * - persists the matching record (refunds / reversals / disputes / manual
 *   reviews),
 * - updates `marketplace_transactions.resolutionStatus` (single source of the
 *   resolution truth that `truth.ts` already consumes),
 * - appends the corresponding timeline event(s).
 *
 * Guards guarantee that in-flight and terminal money states cannot be repeated
 * or retrofitted: a refund cannot complete before it is initiated, a reversal
 * cannot follow a refund, and closed states cannot be re-opened.
 */

export class ResolutionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ResolutionError";
    this.code = code;
  }
}

const MONEY_OPEN_STATES: readonly ResolutionStatus[] = [
  "NONE",
  "MANUAL_REVIEW",
];

const TERMINAL_STATES: ReadonlySet<ResolutionStatus> = new Set([
  "REFUNDED",
  "REVERSED",
]);

async function requireTransaction(
  repos: Repositories,
  transactionId: string,
): Promise<MarketplaceTransaction> {
  const transaction =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  if (transaction === null) {
    throw new ResolutionError(
      "TRANSACTION_NOT_FOUND",
      `transaction ${transactionId} not found`,
    );
  }
  return transaction;
}

async function requirePayment(
  repos: Repositories,
  orderId: string,
): Promise<MarketplacePaymentRecord> {
  const payment = await repos.marketplacePayments.findByOrderId(orderId);
  if (payment === null) {
    throw new ResolutionError(
      "PAYMENT_NOT_FOUND",
      `no payment record for order ${orderId}`,
    );
  }
  return payment;
}

async function requireWallet(
  repos: Repositories,
  customerId: string,
): Promise<MarketplaceWallet> {
  const wallet = await findWalletByCustomer(repos, customerId);
  if (wallet === null) {
    throw new ResolutionError(
      "WALLET_NOT_FOUND",
      `no wallet for customer ${customerId}`,
    );
  }
  return wallet;
}

function assertMoneyOpen(state: ResolutionStatus, action: string): void {
  if (state === "NONE" || state === "MANUAL_REVIEW") {
    return;
  }
  if (state === "REFUND_PENDING" && action === "complete_refund") {
    return;
  }
  throw new ResolutionError(
    "INVALID_RESOLUTION_TRANSITION",
    `cannot ${action} from resolution state ${state}`,
  );
}

async function updateResolutionStatus(
  repos: Repositories,
  transaction: MarketplaceTransaction,
  resolutionStatus: ResolutionStatus,
  now: string,
): Promise<MarketplaceTransaction> {
  const updated: MarketplaceTransaction = {
    ...transaction,
    resolutionStatus,
    updatedAt: now,
  };
  await repos.marketplaceTransactions.insert(updated);
  return updated;
}

export interface RefundActionOutcome {
  readonly transactionId: string;
  readonly resolutionStatus: ResolutionStatus;
  readonly refund: RefundRecord;
  readonly ledger: readonly WalletLedgerEntry[];
  readonly events: readonly TransactionEvent[];
}

/**
 * Operator-initiated refund of a transaction's captured payment. Moves the
 * transaction to REFUND_PENDING (awaiting the provider/ledger completion).
 * Rejects when the resolution state is closed or a refund is already in
 * flight or completed.
 */
export async function initiateTransactionRefund(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly reason?: string;
    readonly now?: string;
  },
): Promise<RefundActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  if (TERMINAL_STATES.has(transaction.resolutionStatus)) {
    throw new ResolutionError(
      "INVALID_RESOLUTION_TRANSITION",
      `cannot initiate a refund from resolution state ${transaction.resolutionStatus}`,
    );
  }
  const existing = await store.readLatestById<RefundRecord>(
    "refunds",
    `ref_${input.transactionId}`,
  );
  if (existing !== null && existing.status !== "FAILED_REVIEW") {
    throw new ResolutionError(
      "REFUND_ALREADY_IN_FLIGHT",
      `refund for transaction ${input.transactionId} already ${existing.status}`,
    );
  }

  const payment = await requirePayment(repos, transaction.orderId);
  const wallet = await requireWallet(repos, transaction.customerId);
  const reason = input.reason ?? "OPERATOR_INITIATED_REFUND";
  const outcome = await initiateRefund(repos, {
    walletId: wallet.id,
    transactionId: input.transactionId,
    amountMinor: payment.expectedAmountMinor,
    currency: payment.currency,
    reason,
    now,
  });
  const ledgerReference =
    outcome.ledgerEntries.find((entry) => entry.type === "REFUND_PENDING")
      ?.reference ?? null;

  const refund: RefundRecord = {
    id: `ref_${input.transactionId}`,
    transactionId: input.transactionId,
    amountMinor: payment.expectedAmountMinor,
    currency: payment.currency,
    status: "PENDING",
    reason,
    initiatedAt: now,
    completedAt: null,
    ledgerReference,
    simulated: true,
  };
  await store.insert("refunds", refund);
  await updateResolutionStatus(repos, transaction, "REFUND_PENDING", now);

  const eventInitiated = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.RefundInitiated,
    label: "Refund initiated",
    description: `Refund initiated (${reason}).`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      reason,
      amount_minor: String(payment.expectedAmountMinor),
      currency: payment.currency,
      refund_id: refund.id,
    }),
    occurredAt: now,
  });
  const eventPending = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.RefundPending,
    label: "Refund pending",
    description: `Refund pending (${ledgerReference ?? ""}).`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      ledger_reference: ledgerReference,
      amount_minor: String(payment.expectedAmountMinor),
      currency: payment.currency,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: "REFUND_PENDING",
    refund,
    ledger: outcome.ledgerEntries,
    events: [eventInitiated, eventPending],
  };
}

/**
 * Completes a pending refund (provider/ledger posted the money back). Moves
 * the transaction to REFUNDED. Requires a PENDING refund record — a refund can
 * never complete before it was initiated.
 */
export async function completeTransactionRefund(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly now?: string;
  },
): Promise<RefundActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  assertMoneyOpen(transaction.resolutionStatus, "complete_refund");

  const refund = await store.readLatestById<RefundRecord>(
    "refunds",
    `ref_${input.transactionId}`,
  );
  if (refund === null || refund.status !== "PENDING") {
    throw new ResolutionError(
      "REFUND_NOT_PENDING",
      `refund for transaction ${input.transactionId} is not pending`,
    );
  }

  const wallet = await requireWallet(repos, transaction.customerId);
  const outcome = await completeRefund(repos, {
    walletId: wallet.id,
    transactionId: input.transactionId,
    amountMinor: refund.amountMinor,
    currency: refund.currency,
    reason: refund.reason,
    now,
  });
  const ledgerReference =
    outcome.ledgerEntries.find((entry) => entry.type === "REFUND_COMPLETED")
      ?.reference ?? null;

  const completed: RefundRecord = {
    ...refund,
    status: "COMPLETED",
    completedAt: now,
    ledgerReference,
  };
  await store.insert("refunds", completed);
  await updateResolutionStatus(repos, transaction, "REFUNDED", now);

  const event = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.RefundCompleted,
    label: "Refund completed",
    description: `Refund completed (${ledgerReference ?? ""}).`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      ledger_reference: ledgerReference,
      amount_minor: String(refund.amountMinor),
      currency: refund.currency,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: "REFUNDED",
    refund: completed,
    ledger: outcome.ledgerEntries,
    events: [event],
  };
}

export interface ReversalActionOutcome {
  readonly transactionId: string;
  readonly resolutionStatus: ResolutionStatus;
  readonly reversal: ReversalRecord;
  readonly ledger: readonly WalletLedgerEntry[];
  readonly events: readonly TransactionEvent[];
}

/**
 * Reverses the captured debit and posts the money back to the wallet ledger.
 * This is a reversal of the payment movement itself, distinct from a refund of
 * a completed sale. Rejects when any refund/reversal state is already open or
 * closed.
 */
export async function reverseTransactionDebit(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly reason?: string;
    readonly now?: string;
  },
): Promise<ReversalActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  assertMoneyOpen(transaction.resolutionStatus, "reverse_debit");

  const payment = await requirePayment(repos, transaction.orderId);
  const wallet = await requireWallet(repos, transaction.customerId);
  const reason = input.reason ?? "OPERATOR_INITIATED_REVERSAL";
  const outcome = await reverseDebit(repos, {
    walletId: wallet.id,
    transactionId: input.transactionId,
    amountMinor: payment.expectedAmountMinor,
    currency: payment.currency,
    reason,
    now,
  });
  const ledgerReference =
    outcome.ledgerEntries.find((entry) => entry.type === "REVERSAL_COMPLETED")
      ?.reference ?? null;

  const reversal: ReversalRecord = {
    id: `rev_${input.transactionId}`,
    transactionId: input.transactionId,
    amountMinor: payment.expectedAmountMinor,
    currency: payment.currency,
    status: "COMPLETED",
    reason,
    initiatedAt: now,
    completedAt: now,
    ledgerReference,
    simulated: true,
  };
  await store.insert("reversals", reversal);
  await updateResolutionStatus(repos, transaction, "REVERSED", now);

  const eventInitiated = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.ReversalInitiated,
    label: "Reversal initiated",
    description: `Reversal initiated (${reason}).`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      reason,
      amount_minor: String(payment.expectedAmountMinor),
      currency: payment.currency,
      reversal_id: reversal.id,
    }),
    occurredAt: now,
  });
  const eventCompleted = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.ReversalCompleted,
    label: "Reversal completed",
    description: `Reversal ${ledgerReference ?? ""} posted to the wallet ledger.`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      ledger_reference: ledgerReference,
      amount_minor: String(payment.expectedAmountMinor),
      currency: payment.currency,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: "REVERSED",
    reversal,
    ledger: outcome.ledgerEntries,
    events: [eventInitiated, eventCompleted],
  };
}

export interface DisputeActionOutcome {
  readonly transactionId: string;
  readonly resolutionStatus: ResolutionStatus;
  readonly dispute: DisputeRecord;
  readonly event: TransactionEvent;
}

/**
 * Customer-side dispute. A closed money loop (refunded or reversed) cannot be
 * disputed; otherwise the transaction moves to DISPUTED. A second open dispute
 * for the same transaction is rejected.
 */
export async function openDispute(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly reason: string;
    readonly message?: string;
    readonly now?: string;
  },
): Promise<DisputeActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  if (TERMINAL_STATES.has(transaction.resolutionStatus)) {
    throw new ResolutionError(
      "INVALID_RESOLUTION_TRANSITION",
      `cannot open a dispute from resolution state ${transaction.resolutionStatus}`,
    );
  }
  const existing = await store.readLatestById<DisputeRecord>(
    "disputes",
    `dsp_${input.transactionId}`,
  );
  if (
    existing !== null &&
    (existing.status === "OPEN" || existing.status === "UNDER_REVIEW")
  ) {
    throw new ResolutionError(
      "DUPLICATE_DISPUTE",
      `transaction ${input.transactionId} already has an ${existing.status} dispute`,
    );
  }

  const dispute: DisputeRecord = {
    id: `dsp_${input.transactionId}`,
    transactionId: input.transactionId,
    customerId: transaction.customerId,
    reason: input.reason,
    status: "OPEN",
    message: input.message ?? "",
    createdAt: now,
    updatedAt: now,
    resolutionNote: null,
    simulated: true,
  };
  await store.insert("disputes", dispute);
  await updateResolutionStatus(repos, transaction, "DISPUTED", now);

  const event = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.DisputeOpened,
    label: "Dispute opened",
    description: `Dispute opened: ${input.reason}.`,
    actor: "CUSTOMER",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      reason: input.reason,
      dispute_id: dispute.id,
      message: input.message,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: "DISPUTED",
    dispute,
    event,
  };
}

/**
 * Closes an open or in-review dispute. The transaction returns to NONE unless a
 * refund/reversal already changed it (material state is never erased).
 */
export async function resolveDispute(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly resolutionNote: string;
    readonly now?: string;
  },
): Promise<DisputeActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  const dispute = await store.readLatestById<DisputeRecord>(
    "disputes",
    `dsp_${input.transactionId}`,
  );
  if (
    dispute === null ||
    (dispute.status !== "OPEN" && dispute.status !== "UNDER_REVIEW")
  ) {
    throw new ResolutionError(
      "DISPUTE_NOT_OPEN",
      `transaction ${input.transactionId} has no open dispute`,
    );
  }

  const resolved: DisputeRecord = {
    ...dispute,
    status: "RESOLVED",
    updatedAt: now,
    resolutionNote: input.resolutionNote,
  };
  await store.insert("disputes", resolved);
  const nextState: ResolutionStatus =
    transaction.resolutionStatus === "DISPUTED"
      ? "NONE"
      : transaction.resolutionStatus;
  const updated = await updateResolutionStatus(
    repos,
    transaction,
    nextState,
    now,
  );

  const event = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.DisputeResolved,
    label: "Dispute resolved",
    description: input.resolutionNote,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      dispute_id: dispute.id,
      resolution_note: input.resolutionNote,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: updated.resolutionStatus,
    dispute: resolved,
    event,
  };
}

export interface ManualReviewActionOutcome {
  readonly transactionId: string;
  readonly resolutionStatus: ResolutionStatus;
  readonly review: ManualReviewRecord;
  readonly event: TransactionEvent;
}

/**
 * Flags a transaction for manual review (e.g. an unresolved reconciliation).
 * Rejects closed and in-flight money states. Assigning a reviewer is optional.
 */
export async function markManualReview(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly reason: string;
    readonly assignedTo?: string;
    readonly now?: string;
  },
): Promise<ManualReviewActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  if (TERMINAL_STATES.has(transaction.resolutionStatus)) {
    throw new ResolutionError(
      "INVALID_RESOLUTION_TRANSITION",
      `cannot flag for manual review from resolution state ${transaction.resolutionStatus}`,
    );
  }
  const existing = await store.readLatestById<ManualReviewRecord>(
    "manual_reviews",
    `mr_${input.transactionId}`,
  );
  const review: ManualReviewRecord = {
    id: `mr_${input.transactionId}`,
    transactionId: input.transactionId,
    reason: input.reason,
    status: "OPEN",
    assignedTo: input.assignedTo ?? existing?.assignedTo ?? null,
    createdAt: existing?.createdAt ?? now,
    resolvedAt: null,
    operatorNote: null,
    simulated: true,
  };
  await store.insert("manual_reviews", review);
  await updateResolutionStatus(repos, transaction, "MANUAL_REVIEW", now);

  const event = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.ManualReviewRequested,
    label: "Manual review requested",
    description: `Manual review: ${input.reason}.`,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      reason: input.reason,
      review_id: review.id,
      assigned_to: input.assignedTo,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: "MANUAL_REVIEW",
    review,
    event,
  };
}

/**
 * Closes an open manual review. The transaction returns to NONE unless a
 * refund/reversal already changed it.
 */
export async function resolveManualReview(
  store: JsonlStore,
  repos: Repositories,
  input: {
    readonly transactionId: string;
    readonly operatorNote: string;
    readonly now?: string;
  },
): Promise<ManualReviewActionOutcome> {
  const now = input.now ?? WALLET_FIXED_TIMESTAMP;
  const transaction = await requireTransaction(repos, input.transactionId);
  const review = await store.readLatestById<ManualReviewRecord>(
    "manual_reviews",
    `mr_${input.transactionId}`,
  );
  if (
    review === null ||
    (review.status !== "OPEN" && review.status !== "IN_REVIEW")
  ) {
    throw new ResolutionError(
      "REVIEW_NOT_OPEN",
      `transaction ${input.transactionId} has no open manual review`,
    );
  }
  const resolved: ManualReviewRecord = {
    ...review,
    status: "RESOLVED",
    resolvedAt: now,
    operatorNote: input.operatorNote,
  };
  await store.insert("manual_reviews", resolved);
  const nextState: ResolutionStatus =
    transaction.resolutionStatus === "MANUAL_REVIEW"
      ? "NONE"
      : transaction.resolutionStatus;
  const updated = await updateResolutionStatus(
    repos,
    transaction,
    nextState,
    now,
  );

  const event = await appendTransactionEvent(repos, {
    transactionId: input.transactionId,
    type: TransactionEventType.ManualReviewResolved,
    label: "Manual review resolved",
    description: input.operatorNote,
    actor: "OPERATOR",
    source: "RESOLUTION",
    metadata: sourceAttributes({
      review_id: review.id,
      operator_note: input.operatorNote,
    }),
    occurredAt: now,
  });

  return {
    transactionId: input.transactionId,
    resolutionStatus: updated.resolutionStatus,
    review: resolved,
    event,
  };
}
