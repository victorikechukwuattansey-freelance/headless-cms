import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { seedCustomer, seedOrg } from "../db/fixtures.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import {
  WALLET_FIXED_TIMESTAMP,
  createWallet,
  fundWallet,
  getWalletBalance,
} from "../../src/marketplace/wallet.ts";
import {
  executeMarketplaceTransaction,
  marketplaceTransactionFacts,
  TransactionInputError,
} from "../../src/marketplace/transactions.ts";
import {
  listTransactionEvents,
  TransactionEventType,
} from "../../src/marketplace/timeline.ts";
import { demoDeps } from "./demo-deps.ts";
import type {
  ExecuteTransactionInput,
  ExecuteTransactionResult,
} from "../../src/marketplace/transactions.ts";
import type {
  MarketplaceOrder,
  MarketplacePaymentRecord,
  ProviderAttempt,
  WalletLedgerEntry,
} from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const NOW = WALLET_FIXED_TIMESTAMP;

function input(
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

async function attemptsFor(
  repos: Repositories,
  transactionId: string,
): Promise<readonly ProviderAttempt[]> {
  return repos.marketplaceProviderAttempts.listByTransaction(transactionId);
}

async function ledgerFor(
  repos: Repositories,
  walletId: string,
): Promise<readonly WalletLedgerEntry[]> {
  return repos.walletLedger.listByWallet(walletId);
}

async function orderLatest(
  repos: Repositories,
  orderId: string,
): Promise<MarketplaceOrder | null> {
  return repos.marketplaceOrders.readLatestById(orderId);
}

async function paymentForOrder(
  repos: Repositories,
  orderId: string,
): Promise<MarketplacePaymentRecord | null> {
  return repos.marketplacePayments.findByOrderId(orderId);
}

async function seedDemoCustomer(
  tx: Parameters<typeof seedOrg>[0],
): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_demo", orgId: "org_test" });
}

test("airtime SUCCESS: quote, debit, provider response, and fulfillment share one deterministic trail", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(deps, input());

    assert.equal(result.replayed, false);
    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
    assert.equal(result.transaction.resolutionStatus, "NONE");
    assert.equal(result.transaction.customerStatus, "CONFIRMED");
    assert.equal(result.transaction.adminStatus, "HEALTHY");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "COMPLETED",
    );

    assert.equal(result.facts?.expectedAmountMinor, 1000);
    assert.equal(result.facts?.providerAmountMinor, 1000);
    assert.equal(result.facts?.paymentState, "SUCCESS");
    assert.equal(result.facts?.providerState, "SUCCESS");
    assert.deepEqual(result.facts?.flags, []);

    const payment = await paymentForOrder(repos, result.order.id);
    assert.equal(payment?.status, "SUCCESS");
    assert.equal(payment?.expectedAmountMinor, 1000);
    assert.equal(payment?.actualAmountMinor, 1000);

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList.length, 1);
    assert.equal(attemptList[0]?.status, "SUCCESS");
    assert.equal(attemptList[0]?.canonicalStatus, "SUCCESS");
    assert.match(attemptList[0]?.providerReference ?? "", /^air_/);

    const events = await listTransactionEvents(repos, result.transaction.id);
    const types = events.map((event) => event.type);
    assert.ok(types.includes(TransactionEventType.PaymentAuthorized));
    assert.ok(types.includes(TransactionEventType.ProviderResponseReceived));
    assert.ok(types.includes(TransactionEventType.TransactionFulfilled));
    assert.equal(events[0]?.type, TransactionEventType.OrderCreated);
    assert.equal(
      events[events.length - 1]?.type,
      TransactionEventType.TransactionFulfilled,
    );

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 499_000);
  });
});

test("airtime FAILED: payment settles, provider declines, fulfillment is failed without a double charge", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "FAILED" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "FAILED");
    assert.equal(result.transaction.adminStatus, "PROVIDER_FAILED");
    assert.equal((await orderLatest(repos, result.order.id))?.status, "FAILED");
    assert.deepEqual(result.facts?.flags, ["STATUS_MISMATCH"]);

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList.length, 1);
    assert.equal(attemptList[0]?.status, "FAILED");
    assert.equal(attemptList[0]?.canonicalStatus, "FAILED");

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.ProviderFailed));
    assert.ok(types.includes(TransactionEventType.TransactionFailed));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 499_000);
  });
});

test("electricity PENDING: funds are held while the provider is pending", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_electricity_aedc",
        scenario: "PENDING",
        inputs: {
          provider: "AEDC",
          meterNumber: "23456781",
          meterType: "prepaid",
          amount: "10000",
        },
      }),
    );

    assert.equal(result.transaction.paymentStatus, "PENDING");
    assert.equal(result.transaction.fulfillmentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "PENDING_PROVIDER");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "PROVIDER_PENDING",
    );

    const payment = await paymentForOrder(repos, result.order.id);
    assert.equal(payment?.status, "PENDING");
    assert.equal(payment?.actualAmountMinor, null);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.PaymentPending));
    assert.ok(types.includes(TransactionEventType.TransactionPending));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500_000);
    assert.equal(balance.pendingMinor, 10_000);
    assert.deepEqual(result.facts?.flags, ["STATUS_UNRESOLVED"]);
  });
});

test("electricity TIMEOUT: pending hold, no provider facts, escalated for review", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_electricity_aedc",
        scenario: "TIMEOUT",
        inputs: {
          provider: "AEDC",
          meterNumber: "23456781",
          meterType: "prepaid",
          amount: "10000",
        },
      }),
    );

    assert.equal(result.transaction.paymentStatus, "PENDING");
    assert.equal(result.transaction.fulfillmentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "UNRESOLVED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "MANUAL_REVIEW",
    );

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList[0]?.status, "TIMEOUT");
    assert.equal(attemptList[0]?.canonicalStatus, "UNKNOWN");
    assert.equal(attemptList[0]?.providerReference, null);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.ProviderTimeout));
    assert.ok(types.includes(TransactionEventType.TransactionRequiresReview));
    assert.deepEqual(result.facts?.flags, ["STATUS_UNRESOLVED"]);
  });
});

test("airtime DUPLICATE: a single debit and single fulfillment are preserved", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "DUPLICATE" }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
    assert.equal(result.transaction.adminStatus, "DUPLICATE");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "COMPLETED",
    );
    assert.deepEqual(result.facts?.flags, ["DUPLICATE_PROVIDER_RECORD"]);

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList.length, 1);
    assert.equal(attemptList[0]?.status, "DUPLICATE");
    assert.equal(attemptList[0]?.canonicalStatus, "SUCCESS");

    const ledger = await ledgerFor(repos, "wl_cus_demo_ngn");
    assert.equal(
      ledger.filter((entry) => entry.type === "DEBIT_SUCCESS").length,
      1,
    );

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.DuplicateProviderResponse));
    assert.ok(types.includes(TransactionEventType.TransactionFulfilled));
  });
});

test("airtime MISMATCH: provider amount differs from the quote and is flagged", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "MISMATCH" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "MISMATCH");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "MANUAL_REVIEW",
    );
    assert.equal(result.facts?.providerAmountMinor, 1100);
    assert.deepEqual(result.facts?.flags, ["AMOUNT_MISMATCH"]);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.ProviderAmountMismatch));
    assert.ok(types.includes(TransactionEventType.TransactionRequiresReview));
  });
});

test("airtime PARTIAL_SUCCESS: partial fulfillment is flagged, not silently accepted", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "PARTIAL_SUCCESS" }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "PARTIAL");
    assert.equal(result.transaction.adminStatus, "UNRESOLVED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "MANUAL_REVIEW",
    );
    assert.equal(result.facts?.providerAmountMinor, 500);
    assert.deepEqual(result.facts?.flags, ["AMOUNT_MISMATCH"]);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.ProviderPartialFulfillment));
  });
});

test("airtime REVERSED: the reversal restores the wallet balance", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "REVERSED" }),
    );

    assert.equal(result.transaction.paymentStatus, "CANCELLED");
    assert.equal(result.transaction.fulfillmentStatus, "CANCELLED");
    assert.equal(result.transaction.resolutionStatus, "REVERSED");
    assert.equal(result.transaction.customerStatus, "REVERSED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "CANCELLED",
    );
    assert.equal(result.facts?.reversal.status, "COMPLETED");

    const ledger = await ledgerFor(repos, "wl_cus_demo_ngn");
    assert.ok(ledger.some((entry) => entry.type === "DEBIT_SUCCESS"));
    assert.ok(ledger.some((entry) => entry.type === "REVERSAL_INITIATED"));
    assert.ok(ledger.some((entry) => entry.type === "REVERSAL_COMPLETED"));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500_000);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.ReversalInitiated));
    assert.ok(types.includes(TransactionEventType.ReversalCompleted));
  });
});

test("airtime REFUND_PENDING: refund is queued and funds remain held", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "REFUND_PENDING" }),
    );

    assert.equal(result.transaction.resolutionStatus, "REFUND_PENDING");
    assert.equal(result.transaction.adminStatus, "REFUND_QUEUE");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "PROVIDER_PENDING",
    );
    assert.equal(result.facts?.refund.status, "PENDING");
    assert.equal(result.facts?.paymentState, "PENDING");

    const ledger = await ledgerFor(repos, "wl_cus_demo_ngn");
    assert.ok(ledger.some((entry) => entry.type === "REFUND_INITIATED"));
    assert.ok(ledger.some((entry) => entry.type === "REFUND_PENDING"));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 499_000);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.RefundInitiated));
    assert.ok(types.includes(TransactionEventType.RefundPending));
    assert.ok(types.includes(TransactionEventType.TransactionPending));
  });
});

test("airtime REFUND_COMPLETED: refund restores the balance and closes the transaction", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "REFUND_COMPLETED" }),
    );

    assert.equal(result.transaction.resolutionStatus, "REFUNDED");
    assert.equal(result.transaction.customerStatus, "REFUNDED");
    assert.equal(result.transaction.adminStatus, "HEALTHY");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "CANCELLED",
    );
    assert.equal(result.facts?.refund.status, "COMPLETED");
    assert.equal(result.facts?.paymentState, "SUCCESS");

    const ledger = await ledgerFor(repos, "wl_cus_demo_ngn");
    assert.ok(ledger.some((entry) => entry.type === "REFUND_COMPLETED"));
    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500_000);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.RefundCompleted));
  });
});

test("airtime UNKNOWN: unmapped provider status goes to manual review with facts preserved", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "UNKNOWN" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "MANUAL_REVIEW");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "MANUAL_REVIEW",
    );

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList[0]?.status, "UNKNOWN");
    assert.equal(attemptList[0]?.canonicalStatus, "UNKNOWN");

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.TransactionRequiresReview));
    assert.deepEqual(result.facts?.flags, ["STATUS_UNRESOLVED"]);
  });
});

test("gift card SUCCESS: only a masked code preview is delivered with the artifact", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_giftcard_amazon",
        scenario: "SUCCESS",
        inputs: {
          brand: "Amazon",
          region: "US",
          denomination: "$25",
          quantity: "1",
        },
      }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "COMPLETED",
    );

    const artifacts = await repos.giftCardArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(artifacts.length, 1);
    const artifact = artifacts[0];
    assert.equal(artifact.brand, "Amazon");
    assert.equal(artifact.deliveryStatus, "DELIVERED");
    assert.equal(artifact.redemptionStatus, "UNREDEEMED");
    assert.match(artifact.maskedCodePreview ?? "", /^GC-.*\*{4}$/);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.GiftCardDelivered));

    const balance = await getWalletBalance(repos, "wl_cus_demo_usd", "USD");
    assert.equal(balance.availableMinor, 500_000 - 2_500);
  });
});

test("gift card FAILED: no code is exposed and fulfillment fails", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_giftcard_amazon",
        scenario: "FAILED",
        inputs: {
          brand: "Amazon",
          region: "US",
          denomination: "$25",
          quantity: "1",
        },
      }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "FAILED");
    assert.equal(result.transaction.adminStatus, "PROVIDER_FAILED");

    const artifacts = await repos.giftCardArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(artifacts[0]?.deliveryStatus, "FAILED");
    assert.equal(artifacts[0]?.maskedCodePreview, null);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.GiftCardFulfillmentFailed));
  });
});

test("gift card TIMEOUT: funds held and the gift card is escalated for review", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_giftcard_amazon",
        scenario: "TIMEOUT",
        inputs: {
          brand: "Amazon",
          region: "US",
          denomination: "$25",
          quantity: "1",
        },
      }),
    );

    assert.equal(result.transaction.paymentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "UNRESOLVED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "MANUAL_REVIEW",
    );
    assert.equal(result.facts?.providerReference, null);
    assert.deepEqual(result.facts?.flags, ["STATUS_UNRESOLVED"]);

    const balance = await getWalletBalance(repos, "wl_cus_demo_usd", "USD");
    assert.equal(balance.availableMinor, 500_000);
    assert.equal(balance.pendingMinor, 2_500);
  });
});

test("gift card MISMATCH: the artifact carries a risk flag and the amount is flagged", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_giftcard_amazon",
        scenario: "MISMATCH",
        inputs: {
          brand: "Amazon",
          region: "US",
          denomination: "$25",
          quantity: "1",
        },
      }),
    );

    const artifacts = await repos.giftCardArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.deepEqual(artifacts[0]?.riskFlags, ["AMOUNT_DISCREPANCY"]);
    assert.deepEqual(result.facts?.flags, ["AMOUNT_MISMATCH"]);
  });
});

test("cinema SUCCESS: search, reservation, and issuance leave a two-attempt trail", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_cinema_filmhouse",
        scenario: "SUCCESS",
        inputs: {
          venue: "Filmhouse IMAX",
          movie: "Oppenheimer",
          screening: "2026-02-01T19:00:00.000Z",
          seats: "A1",
        },
      }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "COMPLETED",
    );

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList.length, 2);

    const tickets = await repos.ticketArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(tickets.length, 1);
    const ticket = tickets[0];
    assert.equal(ticket.ticketKind, "CINEMA");
    assert.equal(ticket.status, "ISSUED");
    assert.match(ticket.reservationReference ?? "", /^res_/);
    assert.match(ticket.issueReference ?? "", /^iss_/);
    assert.equal(ticket.routeOrVenue, "Filmhouse IMAX to Oppenheimer");
    assert.match(ticket.maskedCode ?? "", /^TKT-.*\*{4}$/);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.TicketReserved));
    assert.ok(types.includes(TransactionEventType.TicketIssued));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500_000 - 7_500);
  });
});

test("cinema PENDING: reservation is held but issuance has not completed", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_cinema_filmhouse",
        scenario: "PENDING",
        inputs: {
          venue: "Filmhouse IMAX",
          movie: "Oppenheimer",
          screening: "2026-02-01T19:00:00.000Z",
          seats: "A1",
        },
      }),
    );

    assert.equal(result.transaction.paymentStatus, "PENDING");
    assert.equal(result.transaction.adminStatus, "PENDING_PROVIDER");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "PROVIDER_PENDING",
    );

    const tickets = await repos.ticketArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(tickets[0]?.status, "PENDING");
    assert.equal(tickets[0]?.issueReference, null);

    const attemptList = await attemptsFor(repos, result.transaction.id);
    assert.equal(attemptList[1]?.status, "PENDING");

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.TicketReserved));
    assert.ok(!types.includes(TransactionEventType.TicketIssued));
    assert.ok(types.includes(TransactionEventType.TransactionPending));
  });
});

test("bus SUCCESS: route metadata is captured on the issued artifact", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_bus_lagos_abuja",
        scenario: "SUCCESS",
        inputs: {
          origin: "Lagos",
          destination: "Abuja",
          date: "2026-02-10",
          passenger: "Ada Obi",
          seat: "A1",
        },
      }),
    );

    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");

    const tickets = await repos.ticketArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(tickets[0]?.ticketKind, "BUS");
    assert.equal(tickets[0]?.status, "ISSUED");
    assert.equal(tickets[0]?.routeOrVenue, "Lagos to Abuja");
    assert.equal(tickets[0]?.passengerOrAttendee, "Ada Obi");
    assert.equal(tickets[0]?.seat, "A1");
  });
});

test("airline PENDING: a large booking holds funds without issuing", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_airline_los_abv",
        scenario: "PENDING",
        inputs: {
          origin: "LOS",
          destination: "ABV",
          date: "2026-02-10",
          passenger: "Chidi Okafor",
          flight: "Economy",
        },
      }),
    );

    assert.equal(result.transaction.paymentStatus, "PENDING");
    assert.equal(
      (await orderLatest(repos, result.order.id))?.status,
      "PROVIDER_PENDING",
    );

    const tickets = await repos.ticketArtifacts.listByTransaction(
      result.transaction.id,
    );
    assert.equal(tickets[0]?.ticketKind, "AIRLINE");
    assert.equal(tickets[0]?.status, "PENDING");

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.pendingMinor, 180_000);
    assert.equal(balance.availableMinor, 500_000);
  });
});

test("wallet funding then purchase: a pre-funded wallet is reused across transactions", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    await createWallet(repos, {
      id: "wl_cus_demo_ngn",
      customerId: "cus_demo",
      currency: "NGN",
      openingBalanceMinor: 1_000,
      now: NOW,
    });
    await fundWallet(repos, deps.registry.payment, {
      walletId: "wl_cus_demo_ngn",
      customerId: "cus_demo",
      amountMinor: 500_000,
      currency: "NGN",
      scenario: "SUCCESS",
      now: NOW,
    });

    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "SUCCESS" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.facts?.expectedAmountMinor, 1000);
    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500_000);

    const second = await executeMarketplaceTransaction(
      deps,
      input({
        scenario: "SUCCESS",
        inputs: { network: "MTN", recipient: "08040000000", amount: "1000" },
      }),
    );
    assert.equal(second.replayed, false);
    const after = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(after.availableMinor, 499_000);
  });
});

test("replay is idempotent: no second debit, no new events, no new writes", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const first = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "SUCCESS" }),
    );

    const replay = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "SUCCESS" }),
    );

    assert.equal(replay.replayed, true);
    assert.equal(replay.facts, null);
    assert.equal(replay.transaction.id, first.transaction.id);

    const events = await listTransactionEvents(repos, first.transaction.id);
    assert.equal(events.length, first.events.length);

    const ledger = await ledgerFor(repos, "wl_cus_demo_ngn");
    assert.equal(
      ledger.filter((entry) => entry.type === "DEBIT_SUCCESS").length,
      1,
    );

    const attempts = await attemptsFor(repos, first.transaction.id);
    assert.equal(attempts.length, 1);

    const txRecords = (await repos.marketplaceTransactions.list()).filter(
      (record) => record.id === first.transaction.id,
    );
    assert.equal(txRecords.length, 1);
  });
});

test("failed payment guard: an underfunded wallet never reaches the provider", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({
        serviceId: "svc_electricity_aedc",
        scenario: "SUCCESS",
        inputs: {
          provider: "AEDC",
          meterNumber: "23456781",
          meterType: "prepaid",
          amount: "10000",
        },
        openingBalanceMinor: 500,
      }),
    );

    assert.equal(result.transaction.paymentStatus, "FAILED");
    assert.equal(result.transaction.fulfillmentStatus, "NOT_STARTED");
    assert.equal((await orderLatest(repos, result.order.id))?.status, "FAILED");
    assert.equal(result.providerAttempts.length, 0);

    const types = (
      await listTransactionEvents(repos, result.transaction.id)
    ).map((e) => e.type);
    assert.ok(types.includes(TransactionEventType.PaymentFailed));
    assert.ok(types.includes(TransactionEventType.TransactionFailed));
    assert.ok(!types.includes(TransactionEventType.ProviderRequestSent));

    const balance = await getWalletBalance(repos, "wl_cus_demo_ngn", "NGN");
    assert.equal(balance.availableMinor, 500);
  });
});

test("unknown service throws TransactionInputError and betting is checkout-blocked", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    await assert.rejects(
      executeMarketplaceTransaction(
        deps,
        input({ serviceId: "svc_does_not_exist" }),
      ),
      (error: unknown) => error instanceof TransactionInputError,
    );
    await assert.rejects(
      executeMarketplaceTransaction(
        deps,
        input({ serviceId: "svc_betting_examplebet" }),
      ),
      (error: unknown) => error instanceof Error,
    );
  });
});

test("marketplaceTransactionFacts resolves the canonical trail from repositories", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "SUCCESS" }),
    );

    const facts = await marketplaceTransactionFacts(
      repos,
      result.transaction.id,
    );
    assert.notEqual(facts, null);
    assert.equal(facts?.serviceKind, "AIRTIME");
    assert.equal(facts?.paymentState, "SUCCESS");
    assert.equal(facts?.expectedAmountMinor, 1000);
    assert.equal(facts?.providerAmountMinor, 1000);
    assert.equal(facts?.scenario, "SUCCESS");
    assert.deepEqual(facts?.flags, []);
    assert.equal(facts?.reversal.status, "NONE");
    assert.equal(facts?.refund.status, "NONE");
    assert.match(facts?.providerReference ?? "", /^air_/);
    assert.equal(facts?.simulated, true);
  });
});
