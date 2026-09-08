import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  DEMO_ORDER_SCENARIOS,
  resolveDemoAlias,
} from "../../src/marketplace/demo-scenarios.ts";
import {
  seedDemoData,
  type SeededDemoData,
  type SeededOrderEntry,
} from "../../src/marketplace/seed.ts";
import { listTransactionEvents } from "../../src/marketplace/timeline.ts";
import type {
  EvidencePack,
  GiftCardArtifact,
  MarketplaceOrder,
  TicketArtifact,
  TransactionEvent,
  WalletLedgerEntry,
} from "../../src/marketplace/types.ts";

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-demo-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

async function seededStore(t: {
  after: (fn: () => void) => void;
}): Promise<{ store: JsonlStore; seeded: SeededDemoData }> {
  const store = tempStore(t);
  const seeded = await seedDemoData(store);
  return { store, seeded };
}

function orderEntry(
  seeded: SeededDemoData,
  transactionId: string,
): SeededOrderEntry {
  const entry = seeded.transactions.find(
    (candidate) => candidate.transactionId === transactionId,
  );
  assert.ok(entry && entry.kind === "ORDER", `order entry ${transactionId}`);
  return entry;
}

async function eventsFor(
  store: JsonlStore,
  transactionId: string,
): Promise<readonly TransactionEvent[]> {
  return listTransactionEvents(store, transactionId);
}

async function ledgerFor(
  store: JsonlStore,
  transactionId: string,
): Promise<readonly WalletLedgerEntry[]> {
  return (await store.readAll<WalletLedgerEntry>("wallet_ledger")).filter(
    (entry) => entry.transactionId === transactionId,
  );
}

async function artifactsFor(
  store: JsonlStore,
  transactionId: string,
): Promise<{
  readonly tickets: readonly TicketArtifact[];
  readonly giftCards: readonly GiftCardArtifact[];
}> {
  const tickets = (
    await store.readAll<TicketArtifact>("ticket_artifacts")
  ).filter((artifact) => artifact.transactionId === transactionId);
  const giftCards = (
    await store.readAll<GiftCardArtifact>("gift_card_artifacts")
  ).filter((artifact) => artifact.transactionId === transactionId);
  return { tickets, giftCards };
}

async function orderFor(
  store: JsonlStore,
  orderId: string,
): Promise<MarketplaceOrder | null> {
  return store.readLatestById<MarketplaceOrder>("marketplace_orders", orderId);
}

function outcomeOf(pack: EvidencePack): string | null {
  return pack.reconciliation?.outcome ?? null;
}

test("alias resolution is pure and canonical", async () => {
  const names = new Set<string>();
  for (const scenario of DEMO_ORDER_SCENARIOS) {
    const resolved = resolveDemoAlias(`txn_${scenario.name}`);
    assert.ok(resolved, scenario.name);
    assert.ok(resolved.id.startsWith("mk_txn_"));
    assert.ok(resolved.reference.startsWith("txn_"));
    assert.notEqual(resolved.id, resolved.reference);
    assert.ok(!names.has(resolved.id), `duplicate alias target ${resolved.id}`);
    names.add(resolved.id);
    assert.equal(resolveDemoAlias(`mk_txn_${scenario.name}`), null);
  }
  assert.equal(resolveDemoAlias("txn_wallet_funding_failure"), null);
  assert.equal(resolveDemoAlias("txn_missing_scenario"), null);
  assert.equal(resolveDemoAlias("not-an-alias"), null);
});

test("successful_airtime reconciles to MATCH with fulfilled top-up", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "successful_airtime",
  )!;
  const { transactionId } = seeded.byName[spec.name] as SeededOrderEntry;
  const entry = orderEntry(seeded, transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FULFILLED");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(entry.transaction.customerStatus, "CONFIRMED");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  assert.equal(entry.truth.reconcileOutcome, "MATCH");
  assert.equal(entry.truth.moneyAtRisk, false);
  assert.equal(outcomeOf(entry.pack), "MATCH");
  assert.equal(
    (await orderFor(store, entry.transaction.orderId))?.status,
    "COMPLETED",
  );
  const events = await eventsFor(store, transactionId);
  assert.ok(events.some((event) => event.type === "TRANSACTION_FULFILLED"));
  assert.ok(
    (await ledgerFor(store, transactionId)).some(
      (e) => e.type === "DEBIT_SUCCESS",
    ),
  );
});

test("failed_data leaves a failed-fulfillment discrepancy", async (t) => {
  const { seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "failed_data",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FAILED");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(entry.transaction.customerStatus, "NEEDS_ATTENTION");
  assert.equal(entry.transaction.adminStatus, "PROVIDER_FAILED");
  assert.equal(entry.truth.moneyAtRisk, true);
  assert.equal(outcomeOf(entry.pack), "DISCREPANCY");
});

test("pending_electricity waits on the provider", async (t) => {
  const { seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "pending_electricity",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "PENDING");
  assert.equal(entry.transaction.fulfillmentStatus, "PENDING");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(entry.transaction.customerStatus, "PENDING");
  assert.equal(entry.transaction.adminStatus, "PENDING_PROVIDER");
  assert.equal(entry.truth.reconcileOutcome, "MISSING_PROVIDER_RECORD");
  assert.equal(entry.truth.moneyAtRisk, true);
});

test("provider_timeout leaves no provider record", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "provider_timeout",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "PENDING");
  assert.equal(entry.transaction.fulfillmentStatus, "PENDING");
  assert.equal(entry.transaction.adminStatus, "PENDING_PROVIDER");
  assert.equal(entry.truth.reconcileOutcome, "MISSING_PROVIDER_RECORD");
  assert.equal(entry.truth.moneyAtRisk, true);
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "PROVIDER_TIMEOUT"));
});

test("duplicate_debit completes cleanly and fires the duplicate marker", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "duplicate_debit",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FULFILLED");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(entry.transaction.customerStatus, "CONFIRMED");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  assert.equal(
    (await orderFor(store, entry.transaction.orderId))?.status,
    "COMPLETED",
  );
  assert.equal(entry.truth.reconcileOutcome, "MATCH");
  assert.equal(entry.truth.moneyAtRisk, false);
  const ledger = await ledgerFor(store, entry.transactionId);
  assert.ok(ledger.some((entry) => entry.type === "DEBIT_SUCCESS"));
  assert.equal(
    ledger.some((entry) => entry.type === "DUPLICATE_DEBIT"),
    false,
    "a provider-duplicate response must not double-debit the wallet",
  );
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(
    events.some((event) => event.type === "DUPLICATE_PROVIDER_RESPONSE"),
  );
});

test("provider_mismatch surfaces an amount mismatch", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "provider_mismatch",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "PENDING");
  assert.equal(entry.transaction.customerStatus, "NEEDS_ATTENTION");
  assert.equal(entry.transaction.adminStatus, "MISMATCH");
  assert.equal(entry.truth.reconcileOutcome, "DISCREPANCY");
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "PROVIDER_AMOUNT_MISMATCH"));
});

test("successful_gift_card delivers a masked code", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "successful_gift_card",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FULFILLED");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  assert.equal(outcomeOf(entry.pack), "MATCH");
  const { giftCards } = await artifactsFor(store, entry.transactionId);
  assert.equal(giftCards.length, 1);
  assert.equal(giftCards[0]?.deliveryStatus, "DELIVERED");
  assert.ok(giftCards[0]?.maskedCodePreview);
  assert.equal(entry.transaction.customerStatus, "CONFIRMED");
});

test("gift_card_fulfillment_failure keeps the code masked and records failure", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "gift_card_fulfillment_failure",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FAILED");
  assert.equal(entry.transaction.customerStatus, "NEEDS_ATTENTION");
  assert.equal(entry.transaction.adminStatus, "PROVIDER_FAILED");
  const { giftCards } = await artifactsFor(store, entry.transactionId);
  assert.equal(giftCards.length, 1);
  assert.equal(giftCards[0]?.deliveryStatus, "FAILED");
  assert.equal(giftCards[0]?.maskedCodePreview, null);
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(
    events.some((event) => event.type === "GIFT_CARD_FULFILLMENT_FAILED"),
  );
});

test("cinema_ticket_success issues a masked ticket artifact", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "cinema_ticket_success",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  assert.equal(entry.transaction.customerStatus, "CONFIRMED");
  assert.equal(outcomeOf(entry.pack), "MATCH");
  const { tickets } = await artifactsFor(store, entry.transactionId);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0]?.status, "ISSUED");
  assert.ok(tickets[0]?.maskedCode);
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "TICKET_ISSUED"));
});

test("bus_ticket_refund completes a wallet refund", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "bus_ticket_refund",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.resolutionStatus, "REFUNDED");
  assert.equal(entry.transaction.customerStatus, "REFUNDED");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  const ledger = await ledgerFor(store, entry.transactionId);
  assert.ok(
    ledger.some((entry) => entry.type === "REFUND_COMPLETED"),
    "completed refund ledger entry expected",
  );
  assert.ok(ledger.some((entry) => entry.type === "DEBIT_SUCCESS"));
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "REFUND_COMPLETED"));
});

test("airline_booking_pending is reserved but not issued", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "airline_booking_pending",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.fulfillmentStatus, "PENDING");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  const { tickets } = await artifactsFor(store, entry.transactionId);
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0]?.status, "PENDING");
  assert.equal(tickets[0]?.maskedCode, null);
  assert.ok(tickets[0]?.reservationReference);
});

test("payment_success_service_failure splits payment truth from fulfillment failure", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "payment_success_service_failure",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "FAILED");
  assert.equal(entry.transaction.customerStatus, "NEEDS_ATTENTION");
  assert.equal(entry.transaction.adminStatus, "MISMATCH");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(entry.truth.reconcileOutcome, "DISCREPANCY");
  assert.equal(entry.truth.moneyAtRisk, true);
  assert.ok(
    (await ledgerFor(store, entry.transactionId)).some(
      (entry) => entry.type === "DEBIT_SUCCESS",
    ),
  );
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "PROVIDER_FAILED"));
  assert.ok(
    events.some((event) => event.type === "GIFT_CARD_FULFILLMENT_FAILED"),
  );
});

test("payment_reversal reverses the wallet debit", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "payment_reversal",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "CANCELLED");
  assert.equal(entry.transaction.resolutionStatus, "REVERSED");
  assert.equal(entry.transaction.customerStatus, "REVERSED");
  assert.equal(entry.transaction.adminStatus, "HEALTHY");
  const ledger = await ledgerFor(store, entry.transactionId);
  assert.ok(ledger.some((entry) => entry.type === "REVERSAL_COMPLETED"));
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "REVERSAL_COMPLETED"));
});

test("refund_pending waits for the refund provider", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "refund_pending",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "PENDING");
  assert.equal(entry.transaction.resolutionStatus, "REFUND_PENDING");
  assert.equal(entry.transaction.customerStatus, "REFUND_PENDING");
  assert.equal(entry.transaction.adminStatus, "REFUND_QUEUE");
  const ledger = await ledgerFor(store, entry.transactionId);
  assert.ok(ledger.some((entry) => entry.type === "REFUND_PENDING"));
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(events.some((event) => event.type === "REFUND_PENDING"));
});

test("manual_review requires operator attention without auto-conclusion", async (t) => {
  const { store, seeded } = await seededStore(t);
  const spec = DEMO_ORDER_SCENARIOS.find(
    (scenario) => scenario.name === "manual_review",
  )!;
  const entry = orderEntry(seeded, seeded.byName[spec.name].transactionId);
  assert.equal(entry.transaction.paymentStatus, "SUCCESS");
  assert.equal(entry.transaction.fulfillmentStatus, "PENDING");
  assert.equal(entry.transaction.customerStatus, "NEEDS_ATTENTION");
  assert.equal(entry.transaction.resolutionStatus, "NONE");
  assert.equal(
    entry.transaction.adminStatus === "UNRESOLVED" ||
      entry.transaction.adminStatus === "MANUAL_REVIEW",
    true,
  );
  assert.equal(entry.truth.moneyAtRisk, true);
  const events = await eventsFor(store, entry.transactionId);
  assert.ok(
    events.some((event) => event.type === "TRANSACTION_REQUIRES_REVIEW"),
  );
});
