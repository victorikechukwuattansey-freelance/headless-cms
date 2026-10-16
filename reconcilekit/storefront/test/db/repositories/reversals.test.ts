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
import type { ReversalRecord } from "../../../src/marketplace/types.ts";

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

function sampleReversal(
  overrides: Partial<ReversalRecord> = {},
): ReversalRecord {
  return {
    id: "rev_txn_1",
    transactionId: "txn_1",
    amountMinor: 12_500,
    currency: "NGN",
    status: "COMPLETED",
    reason: "OPERATOR_INITIATED_REVERSAL",
    initiatedAt: "2026-01-01T12:00:00.000Z",
    completedAt: "2026-01-01T12:00:00.000Z",
    ledgerReference: "wlr_wl_test_1_txn_1_2",
    simulated: true,
    ...overrides,
  };
}

test("reversals: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const reversal = sampleReversal();
    const saved = await repos.reversals.insert(reversal);
    assert.deepEqual(saved, reversal);

    const found = await repos.reversals.readLatestById("rev_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "COMPLETED");
    assert.equal(found.amountMinor, 12_500);
    assert.equal(found.completedAt, "2026-01-01T12:00:00.000Z");
  });
});

test("reversals: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.reversals.readLatestById("rev_missing"), null);
  });
});

test("reversals: insert with an existing id overwrites (latest write wins)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.reversals.insert(
      sampleReversal({ ledgerReference: "wlr_original" }),
    );
    await repos.reversals.insert(
      sampleReversal({ ledgerReference: "wlr_corrected" }),
    );

    const found = await repos.reversals.readLatestById("rev_txn_1");
    assert.ok(found !== null);
    assert.equal(found.ledgerReference, "wlr_corrected");
  });
});