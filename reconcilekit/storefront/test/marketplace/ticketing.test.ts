import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  executeMarketplaceTransaction,
  type ExecuteTransactionInput,
} from "../../src/marketplace/transactions.ts";
import {
  listTransactionEvents,
  TransactionEventType,
} from "../../src/marketplace/timeline.ts";
import {
  cancelTicketTransaction,
  searchTicketAvailability,
  TicketFlowError,
} from "../../src/marketplace/ticketing.ts";
import { ticketArtifactId } from "../../src/marketplace/artifacts.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import { reconcileMarketplaceTransaction } from "../../src/marketplace/reconcile.ts";
import { issueReceipt } from "../../src/marketplace/receipts.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { truncateCommittedState } from "../db/isolation.ts";
import type {
  MarketplaceTransaction,
  TicketArtifact,
} from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

before(async () => {
  await seedDemoCustomer(prisma);
});

after(async () => {
  await truncateCommittedState(prisma);
});

const NOW = WALLET_FIXED_TIMESTAMP;

const FULL_TICKET_CODE_PATTERN = /TKT-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}/;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-tkts-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function cinemaInput(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_cinema_filmhouse",
    scenario: "SUCCESS",
    inputs: {
      venue: "Filmhouse IMAX",
      movie: "Oppenheimer",
      screening: "2026-02-01T19:00:00.000Z",
      seats: "A1",
    },
    now: NOW,
    ...overrides,
  };
}

function airtimeInput(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
    ...overrides,
  };
}

async function ticketLatest(
  store: JsonlStore,
  transactionId: string,
): Promise<TicketArtifact | null> {
  return store.readLatestById<TicketArtifact>(
    "ticket_artifacts",
    ticketArtifactId(transactionId),
  );
}

async function attemptCount(
  store: JsonlStore,
  transactionId: string,
): Promise<number> {
  return (await store.readAll("marketplace_provider_attempts")).filter(
    (row) => (row as { transactionId: string }).transactionId === transactionId,
  ).length;
}

test("cinema SUCCESS reserves and issues a ticket with a deterministic evidence facet", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "SUCCESS" }),
  );

  assert.equal(result.replayed, false);
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
  assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
  assert.equal(result.transaction.customerStatus, "CONFIRMED");
  assert.equal(result.transaction.adminStatus, "HEALTHY");
  assert.equal(result.transaction.resolutionStatus, "NONE");

  assert.ok(result.evidence !== null);
  const facet = result.evidence.ticket;
  assert.ok(facet !== undefined);
  assert.equal(facet.ticketKind, "CINEMA");
  assert.match(facet.reservationReference ?? "", /^res_/);
  assert.match(facet.issueReference ?? "", /^iss_/);
  assert.equal(facet.status, "ISSUED");
  assert.equal(facet.routeOrVenue, "Filmhouse IMAX to Oppenheimer");
  assert.equal(facet.seat, "A1");
  assert.ok(facet.issuedAt !== null);
  assert.match(facet.maskedCode ?? "", /^TKT-[a-z0-9_]{4}-\*{4}$/);

  const artifact = await ticketLatest(store, result.transaction.id);
  assert.ok(artifact !== null);
  assert.equal(artifact.status, "ISSUED");
  assert.equal(artifact.issueReference, facet.issueReference);
  assert.equal(artifact.cancellationReference, null);
  assert.equal(artifact.cancelledAt, null);

  const events = await listTransactionEvents(store, result.transaction.id);
  assert.ok(
    events.some((event) => event.type === TransactionEventType.TicketReserved),
  );
  assert.ok(
    events.some((event) => event.type === TransactionEventType.TicketIssued),
  );
  assert.ok(
    !events.some(
      (event) => event.type === TransactionEventType.TicketCancelled,
    ),
  );
});

test("cinema PENDING holds a reservation but never issues the ticket", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "PENDING" }),
  );

  assert.equal(result.transaction.paymentStatus, "PENDING");
  assert.equal(result.transaction.fulfillmentStatus, "PENDING");
  assert.ok(result.evidence !== null);
  assert.ok(result.evidence.ticket !== undefined);
  assert.match(result.evidence.ticket.reservationReference ?? "", /^res_/);
  assert.equal(result.evidence.ticket.issueReference, null);
  assert.equal(result.evidence.ticket.status, "PENDING");
  assert.equal(result.evidence.ticket.maskedCode, null);

  const artifact = await ticketLatest(store, result.transaction.id);
  assert.ok(artifact !== null);
  assert.equal(artifact.status, "PENDING");
  assert.ok(artifact.reservationReference !== null);
  assert.equal(artifact.issueReference, null);

  const events = await listTransactionEvents(store, result.transaction.id);
  assert.ok(
    events.some((event) => event.type === TransactionEventType.TicketReserved),
  );
  assert.ok(
    !events.some((event) => event.type === TransactionEventType.TicketIssued),
  );
});

test("cinema TIMEOUT produces no reservation and stays in manual review", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "TIMEOUT" }),
  );

  assert.equal(result.transaction.fulfillmentStatus, "PENDING");
  assert.equal(result.transaction.adminStatus, "UNRESOLVED");
  assert.equal(result.order.status, "MANUAL_REVIEW");

  const artifact = await ticketLatest(store, result.transaction.id);
  assert.ok(artifact !== null);
  assert.equal(artifact.status, "PENDING");
  assert.equal(artifact.reservationReference, null);
  assert.equal(artifact.issueReference, null);

  const events = await listTransactionEvents(store, result.transaction.id);
  assert.ok(
    !events.some((event) => event.type === TransactionEventType.TicketReserved),
  );
  assert.ok(
    !events.some((event) => event.type === TransactionEventType.TicketIssued),
  );
});

test("searchTicketAvailability enumerates read-only options pre-checkout", async (t) => {
  const store = tempStore(t);
  const availabilities = await searchTicketAvailability(
    demoDeps(store, repos),
    {
      serviceId: "svc_cinema_filmhouse",
      inputs: {
        venue: "Filmhouse IMAX",
        movie: "Oppenheimer",
        screening: "2026-02-01",
      },
    },
  );

  assert.equal(availabilities.length, 2);
  assert.match(availabilities[0].id, /^avail_.*_1$/);
  assert.match(availabilities[1].id, /^avail_.*_2$/);
  for (const availability of availabilities) {
    assert.equal(availability.ticketKind, "CINEMA");
    assert.equal(availability.routeOrVenue, "Filmhouse IMAX to Oppenheimer");
    assert.ok(availability.availableSeats.length > 0);
  }
  assert.deepEqual(availabilities[0].availableSeats, ["A1", "A2", "A3"]);
  assert.equal(availabilities[0].amountMinor, 0);
  assert.equal(availabilities[1].amountMinor, 500);

  const untouched = await store.readAll("marketplace_transactions");
  assert.equal(untouched.length, 0);
});

test("searchTicketAvailability rejects non-ticketing and unknown services", async (t) => {
  const store = tempStore(t);
  await assert.rejects(
    searchTicketAvailability(demoDeps(store, repos), {
      serviceId: "svc_giftcard_amazon",
      inputs: {
        brand: "Amazon",
        region: "US",
        denomination: "$25",
        quantity: "1",
      },
    }),
    (error: unknown) =>
      error instanceof TicketFlowError &&
      error.code === "NOT_TICKETING_SERVICE",
  );
  await assert.rejects(
    searchTicketAvailability(demoDeps(store, repos), {
      serviceId: "svc_none",
      inputs: {},
    }),
    (error: unknown) =>
      error instanceof TicketFlowError && error.code === "SERVICE_NOT_FOUND",
  );
});

test("cancel invalidates the ticket without touching money or resolution state", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "SUCCESS" }),
  );
  const eventsBefore = await listTransactionEvents(
    store,
    result.transaction.id,
  );
  const attemptsBefore = await attemptCount(store, result.transaction.id);
  assert.equal(attemptsBefore, 2);

  const outcome = await cancelTicketTransaction(store, demoDeps(store, repos), {
    transactionId: result.transaction.id,
    reason: "Duplicate booking",
    now: NOW,
  });

  assert.equal(outcome.replayed, false);
  assert.match(outcome.cancellationReference, /^cnx_/);
  assert.equal(outcome.ticket.status, "CANCELLED");
  assert.equal(outcome.ticket.cancelledAt, NOW);
  assert.equal(
    outcome.ticket.cancellationReference,
    outcome.cancellationReference,
  );
  assert.ok(outcome.event !== null);
  assert.equal(outcome.event.type, TransactionEventType.TicketCancelled);
  assert.equal(outcome.event.source, "MARKETPLACE");

  const artifact = await ticketLatest(store, result.transaction.id);
  assert.ok(artifact !== null);
  assert.equal(artifact.status, "CANCELLED");
  assert.equal(artifact.cancelledAt, NOW);
  assert.equal(artifact.cancellationReference, outcome.cancellationReference);

  const events = await listTransactionEvents(store, result.transaction.id);
  assert.equal(events.length, eventsBefore.length + 1);
  assert.equal(
    events[events.length - 1].type,
    TransactionEventType.TicketCancelled,
  );

  assert.equal(
    await attemptCount(store, result.transaction.id),
    attemptsBefore,
    "provider cancellation must not create a reconcile-attempt row",
  );

  const latest = await store.readLatestById<MarketplaceTransaction>(
    "marketplace_transactions",
    result.transaction.id,
  );
  assert.ok(latest !== null);
  assert.equal(latest.resolutionStatus, "NONE");
  assert.equal(latest.paymentStatus, "SUCCESS");
  assert.equal(
    (await store.readAll("refunds")).filter(
      (row) =>
        (row as { transactionId: string }).transactionId ===
        result.transaction.id,
    ).length,
    0,
  );
  assert.equal(
    (await store.readAll("reversals")).filter(
      (row) =>
        (row as { transactionId: string }).transactionId ===
        result.transaction.id,
    ).length,
    0,
  );
});

test("replaying a cancellation is idempotent and writes nothing new", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "SUCCESS" }),
  );
  const first = await cancelTicketTransaction(store, demoDeps(store, repos), {
    transactionId: result.transaction.id,
    reason: "Duplicate booking",
    now: NOW,
  });
  const eventsAfterFirst = await listTransactionEvents(
    store,
    result.transaction.id,
  );

  const replay = await cancelTicketTransaction(store, demoDeps(store, repos), {
    transactionId: result.transaction.id,
    reason: "Duplicate booking",
    now: NOW,
  });

  assert.equal(replay.replayed, true);
  assert.equal(replay.event, null);
  assert.equal(replay.cancellationReference, first.cancellationReference);
  assert.equal(
    (await listTransactionEvents(store, result.transaction.id)).length,
    eventsAfterFirst.length,
  );
  assert.equal(
    (await store.readAll("ticket_artifacts")).filter(
      (row) =>
        (row as { transactionId: string }).transactionId ===
        result.transaction.id,
    ).length,
    2,
  );
});

test("a refunded or reversed transaction is not cancellable", async (t) => {
  const store = tempStore(t);
  const refunded = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "REFUND_COMPLETED" }),
  );
  assert.equal(refunded.transaction.resolutionStatus, "REFUNDED");
  await assert.rejects(
    cancelTicketTransaction(store, demoDeps(store, repos), {
      transactionId: refunded.transaction.id,
      now: NOW,
    }),
    (error: unknown) =>
      error instanceof TicketFlowError &&
      error.code === "TICKET_NOT_CANCELLABLE",
  );

  const store2 = tempStore(t);
  const reversed = await executeMarketplaceTransaction(
    demoDeps(store2, repos),
    cinemaInput({ scenario: "REVERSED" }),
  );
  assert.equal(reversed.transaction.resolutionStatus, "REVERSED");
  await assert.rejects(
    cancelTicketTransaction(store2, demoDeps(store2, repos), {
      transactionId: reversed.transaction.id,
      now: NOW,
    }),
    (error: unknown) =>
      error instanceof TicketFlowError &&
      error.code === "TICKET_NOT_CANCELLABLE",
  );
});

test("cancellation guards reject unknown transactions and non-ticket transactions", async (t) => {
  const store = tempStore(t);
  await assert.rejects(
    cancelTicketTransaction(store, demoDeps(store, repos), {
      transactionId: "missing_txn",
      now: NOW,
    }),
    (error: unknown) =>
      error instanceof TicketFlowError &&
      error.code === "TRANSACTION_NOT_FOUND",
  );

  const airtime = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    airtimeInput({ scenario: "SUCCESS" }),
  );
  await assert.rejects(
    cancelTicketTransaction(store, demoDeps(store, repos), {
      transactionId: airtime.transaction.id,
      now: NOW,
    }),
    (error: unknown) =>
      error instanceof TicketFlowError &&
      error.code === "TICKET_ARTIFACT_NOT_FOUND",
  );
});

test("cinema SUCCESS reconciles clean and issues an evidence-linked receipt", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "SUCCESS" }),
  );

  const reconcile = await reconcileMarketplaceTransaction(
    { store, catalog: buildDemoCatalog() },
    { transactionId: result.transaction.id, now: NOW },
  );
  assert.equal(reconcile.truth.reconcileOutcome, "MATCH");
  assert.equal(reconcile.truth.customerStatus, "CONFIRMED");
  assert.equal(reconcile.truth.moneyAtRisk, false);
  assert.equal(reconcile.pack.id, `evp_${result.transaction.id}`);
  assert.deepEqual(reconcile.pack.mismatchFlags, []);

  const issuedAt = result.providerResult?.responseTimestamp ?? null;
  const receipt = await issueReceipt(store, {
    transactionId: result.transaction.id,
    customerReference: result.order.customerReference,
    providerReference: result.providerResult?.providerReference ?? null,
    amountMinor: reconcile.pack.amountMinor,
    currency: reconcile.pack.currency,
    label: "cinema_ticket_issued",
    reconciliationOutcome: reconcile.truth.reconcileOutcome,
    issuedAt: issuedAt ?? NOW,
  });
  assert.equal(receipt.id, `rcpt_${result.transaction.id}`);
  assert.equal(receipt.evidencePackId, `evp_${result.transaction.id}`);
});

test("ticket code material is never written in full", async (t) => {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    cinemaInput({ scenario: "SUCCESS" }),
  );
  const events = await listTransactionEvents(store, result.transaction.id);
  const serialized = [
    result,
    await store.readAll("ticket_artifacts"),
    await store.readAll("marketplace_provider_attempts"),
    events,
  ].map((value) => JSON.stringify(value));

  for (const json of serialized) {
    assert.ok(
      !FULL_TICKET_CODE_PATTERN.test(json),
      `full ticket code material leaked into ${json.slice(0, 200)}`,
    );
  }
});
