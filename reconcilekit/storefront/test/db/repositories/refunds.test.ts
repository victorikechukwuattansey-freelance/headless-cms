import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import {
  seedCustomer,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../fixtures.ts";
import type { RefundRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedTxn(): Promise<void> {}

function sampleRefund(
  overrides: Partial<RefundRecord> = {},
): RefundRecord {
  return {
    id: "ref_txn_1",
    transactionId: "txn_1",
    amountMinor: 12_500,
    currency: "NGN",
    status: "PENDING",
    reason: "OPERATOR_INITIATED_REFUND",
    initiatedAt: "2026-01-01T12:00:00.000Z",
    completedAt: null,
    ledgerReference: "wlrf_wl_1_txn_1_2",
    simulated: true,
    ...overrides,
  };
}

async function seedTxnContext(tx: Parameters<typeof seedOrg>[0]): Promise<void> {
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

test("refunds: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const refund = sampleRefund();
    const saved = await repos.refunds.insert(refund);
    assert.deepEqual(saved, refund);

    const found = await repos.refunds.readLatestById("ref_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "PENDING");
    assert.equal(found.amountMinor, 12_500);
    assert.equal(found.completedAt, null);
  });
});

test("refunds: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.refunds.readLatestById("ref_missing"), null);
  });
});

test("refunds: insert with an existing id overwrites (PENDING → COMPLETED)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.refunds.insert(sampleRefund({ status: "PENDING" }));
    await repos.refunds.insert(
      sampleRefund({
        status: "COMPLETED",
        completedAt: "2026-01-01T12:05:00.000Z",
      }),
    );

    const found = await repos.refunds.readLatestById("ref_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "COMPLETED");
    assert.equal(found.completedAt, "2026-01-01T12:05:00.000Z");
  });
});