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
import type { MarketplacePaymentRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(
  tx: Prisma.TransactionClient,
  transactionId: string,
  orderId: string,
  customerId: string,
): Promise<void> {
  await seedOrg(tx, `org_${customerId}`);
  await seedCustomer(tx, { id: customerId, orgId: `org_${customerId}` });
  await seedOrder(tx, { id: orderId, customerId });
  await seedTransaction(tx, {
    id: transactionId,
    orderId,
    customerId,
    reference: `ref_${transactionId}`,
  });
}

function samplePayment(
  overrides: Partial<MarketplacePaymentRecord> = {},
): MarketplacePaymentRecord {
  return {
    id: "mkpay_txn_test_1",
    transactionId: "txn_test_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    walletReference: "wld_wl_test_1",
    providerReference: "prv_ref_1",
    expectedAmountMinor: 12500,
    actualAmountMinor: 12500,
    currency: "NGN",
    status: "SUCCESS",
    paidAt: "2026-01-01T12:00:00.000Z",
    metadata: { simulated: "true", scenario: "SUCCESS" },
    recordedAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("marketplacePayments: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "txn_test_1", "ord_test_1", "cus_test_1");
    const record = samplePayment();
    const saved = await repos.marketplacePayments.insert(record);
    assert.deepEqual(saved, record);

    const found =
      await repos.marketplacePayments.readLatestById("mkpay_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "SUCCESS");
    assert.equal(found.expectedAmountMinor, 12500);
    assert.equal(found.actualAmountMinor, 12500);
    assert.equal(found.metadata.scenario, "SUCCESS");
    assert.equal(found.simulated, true);
  });
});

test("marketplacePayments: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.marketplacePayments.readLatestById("mkpay_missing"),
      null,
    );
  });
});

test("marketplacePayments: insert with an existing id overwrites (PENDING → SUCCESS)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "txn_test_1", "ord_test_1", "cus_test_1");
    await repos.marketplacePayments.insert(
      samplePayment({
        status: "PENDING",
        paidAt: null,
        actualAmountMinor: null,
      }),
    );
    await repos.marketplacePayments.insert(
      samplePayment({ status: "SUCCESS", paidAt: "2026-01-01T12:00:05.000Z" }),
    );

    const found =
      await repos.marketplacePayments.readLatestById("mkpay_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "SUCCESS");
    assert.equal(found.paidAt, "2026-01-01T12:00:05.000Z");
    assert.equal(found.actualAmountMinor, 12500);
  });
});

test("marketplacePayments: findByOrderId returns the payment for that order only", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "txn_a", "ord_a", "cus_test_1");
    await seedChain(tx, "txn_b", "ord_b", "cus_test_1");

    await repos.marketplacePayments.insert(
      samplePayment({
        id: "mkpay_txn_a",
        transactionId: "txn_a",
        orderId: "ord_a",
      }),
    );
    await repos.marketplacePayments.insert(
      samplePayment({
        id: "mkpay_txn_b",
        transactionId: "txn_b",
        orderId: "ord_b",
      }),
    );

    const found = await repos.marketplacePayments.findByOrderId("ord_a");
    assert.ok(found !== null);
    assert.equal(found.id, "mkpay_txn_a");
    assert.equal(found.transactionId, "txn_a");

    assert.equal(
      await repos.marketplacePayments.findByOrderId("ord_missing"),
      null,
    );
  });
});
