import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import {
  seedCustomer,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../fixtures.ts";
import type { ManualReviewRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedTxnContext(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
  await seedTransaction(tx, {
    id: "txn_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    reference: "ref_txn_1",
  });
}

function sampleReview(
  overrides: Partial<ManualReviewRecord> = {},
): ManualReviewRecord {
  return {
    id: "mr_txn_1",
    transactionId: "txn_1",
    reason: "RECONCILE_UNRESOLVED",
    status: "OPEN",
    assignedTo: null,
    createdAt: "2026-01-01T12:00:00.000Z",
    resolvedAt: null,
    operatorNote: null,
    simulated: true,
    ...overrides,
  };
}

test("manualReviews: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const review = sampleReview();
    const saved = await repos.manualReviews.insert(review);
    assert.deepEqual(saved, review);

    const found = await repos.manualReviews.readLatestById("mr_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "OPEN");
    assert.equal(found.assignedTo, null);
    assert.equal(found.resolvedAt, null);
  });
});

test("manualReviews: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.manualReviews.readLatestById("mr_missing"), null);
  });
});

test("manualReviews: insert with an existing id overwrites (OPEN → RESOLVED)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.manualReviews.insert(
      sampleReview({ assignedTo: "op_1", status: "OPEN" }),
    );
    await repos.manualReviews.insert(
      sampleReview({
        assignedTo: "op_1",
        status: "RESOLVED",
        resolvedAt: "2026-01-01T13:00:00.000Z",
        operatorNote: "Manually matched against provider statement.",
      }),
    );

    const found = await repos.manualReviews.readLatestById("mr_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "RESOLVED");
    assert.equal(found.assignedTo, "op_1");
    assert.equal(found.resolvedAt, "2026-01-01T13:00:00.000Z");
    assert.equal(
      found.operatorNote,
      "Manually matched against provider statement.",
    );
  });
});
