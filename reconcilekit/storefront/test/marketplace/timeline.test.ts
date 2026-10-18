import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import {
  seedCustomer,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../db/fixtures.ts";
import { withRollback } from "../db/helpers.ts";
import {
  TransactionEventType,
  appendTransactionEvent,
  listTransactionEvents,
  sourceAttributes,
} from "../../src/marketplace/timeline.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";

const prisma = getPrismaClient();

const TX_INPUT = {
  transactionId: "txn_demo_a",
  actor: "SYSTEM" as const,
  source: "MARKETPLACE" as const,
};

async function seedTransactionContext(
  tx: Prisma.TransactionClient,
  transactionId: string,
): Promise<void> {
  await seedOrg(tx, "org_timeline");
  await seedCustomer(tx, { id: "cus_timeline", orgId: "org_timeline" });
  await seedOrder(tx, { id: "ord_timeline", customerId: "cus_timeline" });
  await seedTransaction(tx, {
    id: transactionId,
    orderId: "ord_timeline",
    customerId: "cus_timeline",
    reference: `ref_${transactionId}`,
  });
}

test("appendTransactionEvent writes an ordered, deterministic timeline for one transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx, TX_INPUT.transactionId);

    await appendTransactionEvent(repos, {
      transactionId: TX_INPUT.transactionId,
      type: TransactionEventType.OrderCreated,
      label: "Order created",
      description: "The order was created.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });
    await appendTransactionEvent(repos, {
      transactionId: TX_INPUT.transactionId,
      type: TransactionEventType.PaymentAuthorized,
      label: "Payment authorized",
      description: "The payment was authorized.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: { paymentId: "mkpay_1" },
      occurredAt: WALLET_FIXED_TIMESTAMP,
    });

    const events = await listTransactionEvents(repos, TX_INPUT.transactionId);
    assert.equal(events.length, 2);
    assert.equal(events[0]?.type, TransactionEventType.OrderCreated);
    assert.equal(events[0]?.id.startsWith("evt_"), true);
    assert.equal(events[0]?.occurredAt, WALLET_FIXED_TIMESTAMP);
    assert.equal(events[0]?.simulated, true);
    assert.equal(events[1]?.type, TransactionEventType.PaymentAuthorized);
    assert.equal(events[1]?.id.startsWith("evt_"), true);
  });
});

test("listTransactionEvents returns chronological order even when appended out of order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx, TX_INPUT.transactionId);
    const TAIL = "2026-01-01T12:00:00.000Z";
    const HEAD = "2026-01-01T12:05:00.000Z";

    await appendTransactionEvent(repos, {
      transactionId: TX_INPUT.transactionId,
      type: TransactionEventType.ProviderResponseReceived,
      label: "Provider responded",
      description: "Out of order.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
      occurredAt: HEAD,
    });
    await appendTransactionEvent(repos, {
      transactionId: TX_INPUT.transactionId,
      type: TransactionEventType.PaymentInitiated,
      label: "Payment initiated",
      description: "Earlier, appended later.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
      occurredAt: TAIL,
    });

    const events = await listTransactionEvents(repos, TX_INPUT.transactionId);
    assert.equal(events.length, 2);
    assert.equal(events[0]?.type, TransactionEventType.PaymentInitiated);
    assert.equal(events[0]?.occurredAt, TAIL);
    assert.equal(
      events[1]?.type,
      TransactionEventType.ProviderResponseReceived,
    );
    assert.equal(events[1]?.occurredAt, HEAD);

    assert.notEqual(events[0]?.id, events[1]?.id);
  });
});

test("listTransactionEvents isolates transactions from one another", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx, "txn_demo_a");
    await seedTransactionContext(tx, "txn_demo_b");
    await appendTransactionEvent(repos, {
      transactionId: "txn_demo_a",
      type: TransactionEventType.OrderCreated,
      label: "Order created",
      description: "Transaction A.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });
    await appendTransactionEvent(repos, {
      transactionId: "txn_demo_b",
      type: TransactionEventType.TransactionFulfilled,
      label: "Fulfilled",
      description: "Transaction B.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });

    assert.equal((await listTransactionEvents(repos, "txn_demo_a")).length, 1);
    assert.equal((await listTransactionEvents(repos, "txn_demo_b")).length, 1);
    const both = await repos.transactionEvents.list();
    assert.equal(both.length, 2);
  });
});

test("appendTransactionEvent sequences per transaction, not globally", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx, "txn_demo_a");
    await seedTransactionContext(tx, "txn_demo_b");
    await appendTransactionEvent(repos, {
      transactionId: "txn_demo_a",
      type: TransactionEventType.OrderCreated,
      label: "Order created",
      description: "A first.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });
    await appendTransactionEvent(repos, {
      transactionId: "txn_demo_b",
      type: TransactionEventType.OrderCreated,
      label: "Order created",
      description: "B first.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });
    await appendTransactionEvent(repos, {
      transactionId: "txn_demo_a",
      type: TransactionEventType.PaymentInitiated,
      label: "Payment initiated",
      description: "A second.",
      actor: TX_INPUT.actor,
      source: TX_INPUT.source,
      metadata: {},
    });

    const a = await listTransactionEvents(repos, "txn_demo_a");
    const b = await listTransactionEvents(repos, "txn_demo_b");
    assert.equal(a.length, 2);
    assert.equal(b.length, 1);
    assert.equal(a[0]?.type, TransactionEventType.OrderCreated);
    assert.equal(a[1]?.type, TransactionEventType.PaymentInitiated);
  });
});

test("sourceAttributes drops null and undefined values but keeps empty strings", () => {
  const attrs = sourceAttributes({
    paymentId: "mkpay_1",
    providerReference: null,
    quoteId: undefined,
    note: "",
  });
  assert.deepEqual(attrs, { paymentId: "mkpay_1", note: "" });
});

test("the full event catalogue is exported and stable", () => {
  const expected = [
    "ORDER_CREATED",
    "QUOTE_RECORDED",
    "PAYMENT_INITIATED",
    "PAYMENT_AUTHORIZED",
    "PAYMENT_PENDING",
    "PAYMENT_FAILED",
    "PROVIDER_REQUEST_SENT",
    "PROVIDER_RESPONSE_RECEIVED",
    "PROVIDER_TIMEOUT",
    "PROVIDER_FAILED",
    "DUPLICATE_PROVIDER_RESPONSE",
    "PROVIDER_AMOUNT_MISMATCH",
    "PROVIDER_PARTIAL_FULFILLMENT",
    "TICKET_RESERVED",
    "TICKET_ISSUED",
    "TICKET_CANCELLED",
    "GIFT_CARD_DELIVERED",
    "GIFT_CARD_FULFILLMENT_FAILED",
    "REVERSAL_INITIATED",
    "REVERSAL_COMPLETED",
    "REFUND_INITIATED",
    "REFUND_PENDING",
    "REFUND_COMPLETED",
    "DISPUTE_OPENED",
    "DISPUTE_RESOLVED",
    "MANUAL_REVIEW_REQUESTED",
    "MANUAL_REVIEW_RESOLVED",
    "TRANSACTION_FULFILLED",
    "TRANSACTION_FAILED",
    "TRANSACTION_PENDING",
    "TRANSACTION_REQUIRES_REVIEW",
    "TRANSACTION_REPLAYED",
    "RECONCILE_INPUT_BUILT",
    "RECONCILE_DETERMINED",
    "RECONCILE_REQUIRES_REVIEW",
  ];
  assert.deepEqual(Object.values(TransactionEventType), expected);
});
