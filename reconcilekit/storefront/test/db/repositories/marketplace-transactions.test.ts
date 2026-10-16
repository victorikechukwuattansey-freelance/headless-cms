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
} from "../fixtures.ts";
import type { MarketplaceTransaction } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
}

function sampleTransaction(
  overrides: Partial<MarketplaceTransaction> = {},
): MarketplaceTransaction {
  return {
    id: "txn_test_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    serviceId: "svc_airtime",
    providerId: "prv_mock",
    reference: "ref_txn_test_1",
    scenario: "SUCCESS",
    paymentStatus: "SUCCESS",
    fulfillmentStatus: "FULFILLED",
    reconcileOutcome: "MATCH",
    resolutionStatus: "NONE",
    customerStatus: "CONFIRMED",
    adminStatus: "HEALTHY",
    simulated: true,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    ...overrides,
  };
}

test("marketplaceTransactions: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = sampleTransaction();
    const saved = await repos.marketplaceTransactions.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.marketplaceTransactions.readLatestById(
      "txn_test_1",
    );
    assert.ok(found !== null);
    assert.equal(found.serviceId, "svc_airtime");
    assert.equal(found.providerId, "prv_mock");
    assert.equal(found.reconcileOutcome, "MATCH");
    assert.equal(found.simulated, true);
  });
});

test("marketplaceTransactions: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.marketplaceTransactions.readLatestById("txn_missing"),
      null,
    );
  });
});

test("marketplaceTransactions: insert with an existing id overwrites (reconcile update)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.marketplaceTransactions.insert(
      sampleTransaction({
        reconcileOutcome: null,
        customerStatus: "PENDING",
        adminStatus: "PENDING_PROVIDER",
      }),
    );
    await repos.marketplaceTransactions.insert(
      sampleTransaction({
        reconcileOutcome: "MATCH",
        customerStatus: "CONFIRMED",
        adminStatus: "HEALTHY",
        updatedAt: "2026-01-01T12:05:00.000Z",
      }),
    );

    const found = await repos.marketplaceTransactions.readLatestById(
      "txn_test_1",
    );
    assert.ok(found !== null);
    assert.equal(found.reconcileOutcome, "MATCH");
    assert.equal(found.customerStatus, "CONFIRMED");
    assert.equal(found.updatedAt, "2026-01-01T12:05:00.000Z");
  });
});

test("marketplaceTransactions: optional demoScenarioName round-trips absent and present", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);

    // Absent case — the key must not appear on the read-back record.
    await repos.marketplaceTransactions.insert(sampleTransaction());
    const without = await repos.marketplaceTransactions.readLatestById(
      "txn_test_1",
    );
    assert.ok(without !== null);
    assert.equal(
      Object.prototype.hasOwnProperty.call(without, "demoScenarioName"),
      false,
    );

    // Present case — same id, key now carried.
    await repos.marketplaceTransactions.insert(
      sampleTransaction({ demoScenarioName: "successful_airtime" }),
    );
    const withName = await repos.marketplaceTransactions.readLatestById(
      "txn_test_1",
    );
    assert.ok(withName !== null);
    assert.equal(withName.demoScenarioName, "successful_airtime");
  });
});