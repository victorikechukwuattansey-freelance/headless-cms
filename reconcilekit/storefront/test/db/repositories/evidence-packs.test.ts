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
import type {
  EvidencePack,
  MarketplaceService,
  ReconciliationSnapshot,
} from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
  await seedTransaction(tx, {
    id: "txn_test_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    reference: "ref_txn_test_1",
  });
}

const SAMPLE_SERVICE: MarketplaceService = {
  id: "svc_airtime_mtn",
  categoryId: "cat_airtime",
  providerId: "prv_airtime",
  kind: "AIRTIME",
  name: "MTN Airtime",
  description: "MTN airtime top-up.",
  currency: "NGN",
  baseAmountMinor: 1000,
  complianceStatus: "AVAILABLE",
  fulfillmentType: "INSTANT_DIGITAL",
  availability: "AVAILABLE",
  inputSchema: [
    { name: "amount", label: "Amount (NGN)", type: "NUMBER", required: true },
  ],
  simulated: true,
};

const SAMPLE_SNAPSHOT: ReconciliationSnapshot = {
  outcome: "MATCH",
  codes: [],
  notes: [],
  sourceAttributes: { engine: "reconcilekit" },
};

function samplePack(overrides: Partial<EvidencePack> = {}): EvidencePack {
  return {
    id: "evp_txn_test_1",
    transactionId: "txn_test_1",
    customerReference: "ref_txn_test_1",
    providerReference: "prv_ref_1",
    paymentReference: "wld_ref_1",
    serviceSnapshot: SAMPLE_SERVICE,
    amountMinor: 12500,
    currency: "NGN",
    timelineEventIds: ["evt_1", "evt_2"],
    providerFacts: { provider_status: "success", amount_minor: "12500" },
    reconciliation: SAMPLE_SNAPSHOT,
    mismatchFlags: [],
    resolutionStatus: "NONE",
    auditEventIds: ["wl_1", "wl_2"],
    createdAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("evidencePacks: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = samplePack();
    const saved = await repos.evidencePacks.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.evidencePacks.readLatestById("evp_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.transactionId, "txn_test_1");
    assert.equal(found.reconciliation?.outcome, "MATCH");
    assert.equal(found.serviceSnapshot.kind, "AIRTIME");
    assert.deepEqual(found.timelineEventIds, ["evt_1", "evt_2"]);
    assert.deepEqual(found.auditEventIds, ["wl_1", "wl_2"]);
    assert.equal(found.simulated, true);
  });
});

test("evidencePacks: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.evidencePacks.readLatestById("evp_missing"), null);
  });
});

test("evidencePacks: insert with an existing id overwrites (reconcile re-runs update in place)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.evidencePacks.insert(
      samplePack({ reconciliation: null, mismatchFlags: [] }),
    );
    await repos.evidencePacks.insert(
      samplePack({
        reconciliation: SAMPLE_SNAPSHOT,
        mismatchFlags: [],
      }),
    );

    const found = await repos.evidencePacks.readLatestById("evp_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.reconciliation?.outcome, "MATCH");
  });
});

test("evidencePacks: reconciliation null round-trips as null (DbNull, not JSON null)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.evidencePacks.insert(
      samplePack({
        reconciliation: null,
        mismatchFlags: ["STATUS_UNRESOLVED"],
      }),
    );

    const found = await repos.evidencePacks.readLatestById("evp_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.reconciliation, null);
    assert.deepEqual(found.mismatchFlags, ["STATUS_UNRESOLVED"]);
  });
});
