import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  executeMarketplaceTransaction,
  type ExecuteTransactionResult,
} from "../../src/marketplace/transactions.ts";
import {
  completeTransactionRefund,
  initiateTransactionRefund,
  markManualReview,
  openDispute,
  resolveDispute,
  resolveManualReview,
  ResolutionError,
  reverseTransactionDebit,
} from "../../src/marketplace/resolution.ts";
import {
  listTransactionEvents,
  TransactionEventType,
} from "../../src/marketplace/timeline.ts";
import { buildTransactionTruth } from "../../src/marketplace/truth.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import type { MarketplaceTransaction } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-res-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

async function runSuccess(
  t: { after: (fn: () => void) => void },
  repos: Repositories,
  inputsOverride: Readonly<Record<string, string>> = {
    network: "MTN",
    recipient: "08030000000",
    amount: "1000",
  },
): Promise<{ store: JsonlStore; result: ExecuteTransactionResult }> {
  const store = tempStore(t);
  const result = await executeMarketplaceTransaction(demoDeps(repos), {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: inputsOverride,
    now: NOW,
  });
  return { store, result };
}

async function readTransaction(
  repos: Repositories,
  transactionId: string,
): Promise<MarketplaceTransaction> {
  const transaction =
    await repos.marketplaceTransactions.readLatestById(transactionId);
  assert.ok(transaction !== null);
  return transaction;
}

async function eventTypes(
  repos: Repositories,
  transactionId: string,
): Promise<string[]> {
  const events = await listTransactionEvents(repos, transactionId);
  return events.map((event) => event.type);
}

test("a reversal is a distinct money movement from a refund", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;

    const outcome = await reverseTransactionDebit(repos, {
      transactionId,
      reason: "DOUBLE_CHARGE",
    });

    assert.equal(outcome.resolutionStatus, "REVERSED");
    assert.equal(outcome.reversal.status, "COMPLETED");
    assert.ok(outcome.reversal.ledgerReference !== null);
    assert.equal(outcome.reversal.id, `rev_${transactionId}`);
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "REVERSED",
    );
    const refunds = await repos.refunds.list();
    assert.equal(refunds.length, 0);

    const types = await eventTypes(repos, transactionId);
    assert.ok(types.includes(TransactionEventType.ReversalInitiated));
    assert.ok(types.includes(TransactionEventType.ReversalCompleted));
    assert.ok(!types.includes(TransactionEventType.RefundInitiated));
    assert.ok(types.includes(TransactionEventType.DisputeOpened) === false);
  });
});

test("refund pending and refunded are two distinct resolution states", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;

    const initiated = await initiateTransactionRefund(repos, {
      transactionId,
      reason: "BAD_DELIVERY",
    });
    assert.equal(initiated.resolutionStatus, "REFUND_PENDING");
    assert.equal(initiated.refund.status, "PENDING");
    assert.equal(initiated.refund.ledgerReference !== null, true);
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "REFUND_PENDING",
    );

    const completed = await completeTransactionRefund(repos, {
      transactionId,
    });
    assert.equal(completed.resolutionStatus, "REFUNDED");
    assert.equal(completed.refund.status, "COMPLETED");
    assert.ok(completed.refund.completedAt !== null);
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "REFUNDED",
    );

    const types = await eventTypes(repos, transactionId);
    assert.ok(types.includes(TransactionEventType.RefundInitiated));
    assert.ok(types.includes(TransactionEventType.RefundPending));
    assert.ok(types.includes(TransactionEventType.RefundCompleted));
  });
});

test("a refund cannot complete before it was initiated", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    await assert.rejects(
      completeTransactionRefund(repos, {
        transactionId: result.transaction.id,
      }),
      (error: unknown) =>
        error instanceof ResolutionError && error.code === "REFUND_NOT_PENDING",
    );
  });
});

test("a refund cannot be initiated twice", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;
    await initiateTransactionRefund(repos, {
      transactionId,
      reason: "FIRST",
    });
    await assert.rejects(
      initiateTransactionRefund(repos, {
        transactionId,
        reason: "SECOND",
      }),
      (error: unknown) =>
        error instanceof ResolutionError &&
        error.code === "REFUND_ALREADY_IN_FLIGHT",
    );
  });
});

test("a reversal cannot follow an in-flight refund", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;
    await initiateTransactionRefund(repos, {
      transactionId,
      reason: "TEST",
    });
    await assert.rejects(
      reverseTransactionDebit(repos, { transactionId }),
      (error: unknown) =>
        error instanceof ResolutionError &&
        error.code === "INVALID_RESOLUTION_TRANSITION",
    );
  });
});

test("dispute open moves the transaction to DISPUTED and resolve restores NONE", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;

    const opened = await openDispute(repos, {
      transactionId,
      reason: "NOT_RECEIVED",
      message: "Customer never received the airtime.",
    });
    assert.equal(opened.resolutionStatus, "DISPUTED");
    assert.equal(opened.dispute.status, "OPEN");
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "DISPUTED",
    );
    assert.equal(opened.event.type, TransactionEventType.DisputeOpened);

    const resolved = await resolveDispute(repos, {
      transactionId,
      resolutionNote: "Airtime confirmed delivered by provider.",
    });
    assert.equal(resolved.dispute.status, "RESOLVED");
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "NONE",
    );
    assert.equal(resolved.event.type, TransactionEventType.DisputeResolved);
  });
});

test("a duplicate open dispute is rejected", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;
    await openDispute(repos, { transactionId, reason: "FIRST" });
    await assert.rejects(
      openDispute(repos, { transactionId, reason: "SECOND" }),
      (error: unknown) =>
        error instanceof ResolutionError && error.code === "DUPLICATE_DISPUTE",
    );
  });
});

test("manual review opens and resolves, appending review events", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;

    const opened = await markManualReview(repos, {
      transactionId,
      reason: "UNRESOLVED_RECONCILIATION",
      assignedTo: "ops_demo",
    });
    assert.equal(opened.resolutionStatus, "MANUAL_REVIEW");
    assert.equal(opened.review.status, "OPEN");
    assert.equal(opened.review.assignedTo, "ops_demo");
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "MANUAL_REVIEW",
    );
    assert.equal(opened.event.type, TransactionEventType.ManualReviewRequested);

    const resolved = await resolveManualReview(repos, {
      transactionId,
      operatorNote: "Marked refunded after provider confirmation.",
    });
    assert.equal(resolved.review.status, "RESOLVED");
    assert.equal(resolved.review.resolvedAt !== null, true);
    assert.equal(
      (await readTransaction(repos, transactionId)).resolutionStatus,
      "NONE",
    );
    assert.equal(
      resolved.event.type,
      TransactionEventType.ManualReviewResolved,
    );
  });
});

test("a dispute cannot be opened on a refunded transaction", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const { result } = await runSuccess(t, repos);
    const transactionId = result.transaction.id;
    await initiateTransactionRefund(repos, {
      transactionId,
      reason: "TEST",
    });
    await completeTransactionRefund(repos, { transactionId });
    await assert.rejects(
      openDispute(repos, { transactionId, reason: "LATE" }),
      (error: unknown) =>
        error instanceof ResolutionError &&
        error.code === "INVALID_RESOLUTION_TRANSITION",
    );
  });
});

test("an unresolved transaction under manual review stays money-at-risk", () => {
  const truth = buildTransactionTruth({
    transactionId: "mk_txn_fail",
    outcome: "DISCREPANCY",
    codes: [],
    paymentState: "SUCCESS",
    resolutionStatus: "MANUAL_REVIEW",
    expectedAmountMinor: 1000,
    currency: "NGN",
    providerAmountMinor: 1000,
  });
  assert.equal(truth.customerStatus, "NEEDS_ATTENTION");
  assert.equal(truth.adminStatus, "MANUAL_REVIEW");
  assert.equal(truth.moneyAtRisk, true);
});
