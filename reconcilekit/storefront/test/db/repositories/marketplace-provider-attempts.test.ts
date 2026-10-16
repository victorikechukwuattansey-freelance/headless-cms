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
import type { ProviderAttempt } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(
  tx: Prisma.TransactionClient,
  transactionId: string,
): Promise<void> {
  await seedOrg(tx, `org_${transactionId}`);
  await seedCustomer(tx, {
    id: `cus_${transactionId}`,
    orgId: `org_${transactionId}`,
  });
  await seedOrder(tx, {
    id: `ord_${transactionId}`,
    customerId: `cus_${transactionId}`,
  });
  await seedTransaction(tx, {
    id: transactionId,
    orderId: `ord_${transactionId}`,
    customerId: `cus_${transactionId}`,
    reference: `ref_${transactionId}`,
  });
}

function sampleAttempt(
  overrides: Partial<ProviderAttempt> = {},
): ProviderAttempt {
  return {
    id: "att_txn_test_1_1",
    transactionId: "txn_test_1",
    providerId: "prv_mock",
    serviceId: "svc_airtime",
    scenario: "SUCCESS",
    requestReference: "req_txn_test_1_1",
    providerReference: "prv_ref_1",
    status: "SUCCESS",
    canonicalStatus: "SUCCESS",
    amountMinor: 12500,
    currency: "NGN",
    latencyMs: 12,
    sourceAttributes: { simulated: "true", provider_status: "success" },
    attemptedAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("marketplaceProviderAttempts: insert persists and listByTransaction reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "txn_test_1");
    const record = sampleAttempt();
    const saved = await repos.marketplaceProviderAttempts.insert(record);
    assert.deepEqual(saved, record);

    const rows =
      await repos.marketplaceProviderAttempts.listByTransaction("txn_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].providerId, "prv_mock");
    assert.equal(rows[0].status, "SUCCESS");
    assert.equal(rows[0].sourceAttributes.provider_status, "success");
    assert.equal(rows[0].simulated, true);
  });
});

test("marketplaceProviderAttempts: listByTransaction returns empty for an unknown transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.deepEqual(
      await repos.marketplaceProviderAttempts.listByTransaction("txn_missing"),
      [],
    );
  });
});

test("marketplaceProviderAttempts: listByTransaction isolates and orders attempts", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "txn_a");
    await seedChain(tx, "txn_b");

    // Attempt 2 of txn_a inserted first, then attempt 1 — read must be
    // in (attemptedAt, id) order, i.e. attempt 1 then attempt 2.
    await repos.marketplaceProviderAttempts.insert(
      sampleAttempt({
        id: "att_txn_a_2",
        transactionId: "txn_a",
        attemptedAt: "2026-01-01T12:00:00.000Z",
      }),
    );
    await repos.marketplaceProviderAttempts.insert(
      sampleAttempt({
        id: "att_txn_a_1",
        transactionId: "txn_a",
        attemptedAt: "2026-01-01T12:00:00.000Z",
      }),
    );
    await repos.marketplaceProviderAttempts.insert(
      sampleAttempt({ id: "att_txn_b_1", transactionId: "txn_b" }),
    );

    const a =
      await repos.marketplaceProviderAttempts.listByTransaction("txn_a");
    assert.equal(a.length, 2);
    assert.deepEqual(
      a.map((row) => row.id),
      ["att_txn_a_1", "att_txn_a_2"],
    );

    const b =
      await repos.marketplaceProviderAttempts.listByTransaction("txn_b");
    assert.equal(b.length, 1);
    assert.equal(b[0].transactionId, "txn_b");
  });
});
