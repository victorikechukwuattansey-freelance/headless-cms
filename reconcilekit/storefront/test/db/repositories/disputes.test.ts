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
import type { DisputeRecord } from "../../../src/marketplace/types.ts";

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

function sampleDispute(overrides: Partial<DisputeRecord> = {}): DisputeRecord {
  return {
    id: "dsp_txn_1",
    transactionId: "txn_1",
    customerId: "cus_test_1",
    reason: "SERVICE_NOT_RECEIVED",
    status: "OPEN",
    message: "The data bundle never arrived.",
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    resolutionNote: null,
    simulated: true,
    ...overrides,
  };
}

test("disputes: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const dispute = sampleDispute();
    const saved = await repos.disputes.insert(dispute);
    assert.deepEqual(saved, dispute);

    const found = await repos.disputes.readLatestById("dsp_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "OPEN");
    assert.equal(found.customerId, "cus_test_1");
    assert.equal(found.resolutionNote, null);
  });
});

test("disputes: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.disputes.readLatestById("dsp_missing"), null);
  });
});

test("disputes: insert with an existing id overwrites (OPEN → RESOLVED)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.disputes.insert(sampleDispute());
    await repos.disputes.insert(
      sampleDispute({
        status: "RESOLVED",
        updatedAt: "2026-01-01T12:30:00.000Z",
        resolutionNote: "Refund issued.",
      }),
    );

    const found = await repos.disputes.readLatestById("dsp_txn_1");
    assert.ok(found !== null);
    assert.equal(found.status, "RESOLVED");
    assert.equal(found.resolutionNote, "Refund issued.");
    assert.equal(found.updatedAt, "2026-01-01T12:30:00.000Z");
  });
});
