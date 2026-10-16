import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import {
  seedCustomer,
  seedEvidencePack,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../fixtures.ts";
import type { ReceiptRecord } from "../../../src/marketplace/types.ts";

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
  await seedEvidencePack(tx, {
    id: "evp_txn_1",
    transactionId: "txn_1",
    customerReference: "ref_txn_1",
    amountMinor: 12_500,
    currency: "NGN",
  });
}

function sampleReceipt(
  overrides: Partial<ReceiptRecord> = {},
): ReceiptRecord {
  return {
    id: "rcpt_txn_1",
    transactionId: "txn_1",
    evidencePackId: "evp_txn_1",
    amountMinor: 12_500,
    currency: "NGN",
    issuedAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("receipts: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const receipt = sampleReceipt();
    const saved = await repos.receipts.insert(receipt);
    assert.deepEqual(saved, receipt);

    const found = await repos.receipts.readLatestById("rcpt_txn_1");
    assert.ok(found !== null);
    assert.equal(found.evidencePackId, "evp_txn_1");
    assert.equal(found.amountMinor, 12_500);
    assert.equal(found.simulated, true);
  });
});

test("receipts: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.receipts.readLatestById("rcpt_missing"), null);
  });
});

test("receipts: insert with an existing id overwrites (reissue updates the row)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.receipts.insert(
      sampleReceipt({ issuedAt: "2026-01-01T12:00:00.000Z" }),
    );
    await repos.receipts.insert(
      sampleReceipt({ issuedAt: "2026-01-01T12:05:00.000Z" }),
    );

    const found = await repos.receipts.readLatestById("rcpt_txn_1");
    assert.ok(found !== null);
    assert.equal(found.issuedAt, "2026-01-01T12:05:00.000Z");
  });
});