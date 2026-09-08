import type { SourceAttributes } from "../../../src/domain/model.ts";
import type { JsonlStore } from "../store/jsonl-store.ts";
import { buildEventId } from "../ids.ts";
import { WALLET_FIXED_TIMESTAMP } from "./wallet.ts";
import type {
  TransactionEvent,
  TransactionEventActor,
  TransactionEventSource,
} from "./types.ts";

/**
 * Canonical marketplace transaction event catalogue. Every state change in the
 * orchestrator appends exactly one timeline record; nothing is overwritten.
 * Phase 2F/2G consumers (truth derivation, evidence packs, receipts) read this
 * timeline as the source of "what happened, in order".
 */
export const TransactionEventType = {
  OrderCreated: "ORDER_CREATED",
  QuoteRecorded: "QUOTE_RECORDED",
  PaymentInitiated: "PAYMENT_INITIATED",
  PaymentAuthorized: "PAYMENT_AUTHORIZED",
  PaymentPending: "PAYMENT_PENDING",
  PaymentFailed: "PAYMENT_FAILED",
  ProviderRequestSent: "PROVIDER_REQUEST_SENT",
  ProviderResponseReceived: "PROVIDER_RESPONSE_RECEIVED",
  ProviderTimeout: "PROVIDER_TIMEOUT",
  ProviderFailed: "PROVIDER_FAILED",
  DuplicateProviderResponse: "DUPLICATE_PROVIDER_RESPONSE",
  ProviderAmountMismatch: "PROVIDER_AMOUNT_MISMATCH",
  ProviderPartialFulfillment: "PROVIDER_PARTIAL_FULFILLMENT",
  TicketReserved: "TICKET_RESERVED",
  TicketIssued: "TICKET_ISSUED",
  TicketCancelled: "TICKET_CANCELLED",
  GiftCardDelivered: "GIFT_CARD_DELIVERED",
  GiftCardFulfillmentFailed: "GIFT_CARD_FULFILLMENT_FAILED",
  ReversalInitiated: "REVERSAL_INITIATED",
  ReversalCompleted: "REVERSAL_COMPLETED",
  RefundInitiated: "REFUND_INITIATED",
  RefundPending: "REFUND_PENDING",
  RefundCompleted: "REFUND_COMPLETED",
  DisputeOpened: "DISPUTE_OPENED",
  DisputeResolved: "DISPUTE_RESOLVED",
  ManualReviewRequested: "MANUAL_REVIEW_REQUESTED",
  ManualReviewResolved: "MANUAL_REVIEW_RESOLVED",
  TransactionFulfilled: "TRANSACTION_FULFILLED",
  TransactionFailed: "TRANSACTION_FAILED",
  TransactionPending: "TRANSACTION_PENDING",
  TransactionRequiresReview: "TRANSACTION_REQUIRES_REVIEW",
  TransactionReplayed: "TRANSACTION_REPLAYED",
  ReconcileInputBuilt: "RECONCILE_INPUT_BUILT",
  ReconcileDetermined: "RECONCILE_DETERMINED",
  ReconcileRequiresReview: "RECONCILE_REQUIRES_REVIEW",
} as const;

export type TransactionEventType =
  (typeof TransactionEventType)[keyof typeof TransactionEventType];

export interface AppendTransactionEventInput {
  readonly transactionId: string;
  readonly type: TransactionEventType;
  readonly label: string;
  readonly description: string;
  readonly actor: TransactionEventActor;
  readonly source: TransactionEventSource;
  readonly metadata: SourceAttributes;
  readonly occurredAt?: string;
}

export async function appendTransactionEvent(
  store: JsonlStore,
  input: AppendTransactionEventInput,
): Promise<TransactionEvent> {
  const occurredAt = input.occurredAt ?? WALLET_FIXED_TIMESTAMP;
  const existing = await listTransactionEvents(store, input.transactionId);
  const seq = existing.length + 1;
  const event: TransactionEvent = {
    id: buildEventId(input.transactionId, seq),
    transactionId: input.transactionId,
    type: input.type,
    label: input.label,
    description: input.description,
    occurredAt,
    actor: input.actor,
    source: input.source,
    metadata: input.metadata,
    simulated: true,
  };
  await store.insert("transaction_events", event);
  return event;
}

/** Chronological, deterministic timeline for one transaction (oldest first). */
export async function listTransactionEvents(
  store: JsonlStore,
  transactionId: string,
): Promise<readonly TransactionEvent[]> {
  const events = await store.readAll<TransactionEvent>("transaction_events");
  return events
    .filter((event) => event.transactionId === transactionId)
    .slice()
    .sort((a, b) => {
      const byTime = a.occurredAt.localeCompare(b.occurredAt);
      return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
}

export function sourceAttributes(input: {
  readonly [key: string]: string | null | undefined;
}): SourceAttributes {
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string] =>
        entry[1] !== null && entry[1] !== undefined,
    ),
  );
}
