import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import type {
  EvidencePack,
  MarketplaceTransaction,
} from "../../src/marketplace/types.ts";

interface StubRecord {
  readonly id: string;
  readonly value: number;
}

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-marketplace-store-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("jsonl store writes and reads marketplace transactions", async (t) => {
  const store = tempStore(t);
  const transaction: MarketplaceTransaction = {
    id: "txn_1",
    orderId: "ord_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    providerId: "mock_vtu",
    reference: "mk_txn_1",
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
  };

  await store.insert("marketplace_transactions", transaction);

  const stored = await store.readLatestById<MarketplaceTransaction>(
    "marketplace_transactions",
    "txn_1",
  );
  const records = await store.readAll<MarketplaceTransaction>(
    "marketplace_transactions",
  );

  assert.equal(stored?.reference, "mk_txn_1");
  assert.deepEqual(records, [transaction]);
});

test("jsonl store keeps existing legacy store kinds compatible", async (t) => {
  const store = tempStore(t);
  const payment = { id: "pay_1", value: 100 } satisfies StubRecord;

  await store.insert("payments", payment);

  const stored = await store.readLatestById<StubRecord>("payments", "pay_1");
  assert.deepEqual(stored, payment);
});

test("jsonl store keeps evidence packs in their own kind for replay", async (t) => {
  const store = tempStore(t);
  const pack: EvidencePack = {
    id: "evp_mk_txn_1",
    transactionId: "mk_txn_1",
    customerReference: "cus_demo",
    providerReference: "air_demo_1",
    paymentReference: null,
    serviceSnapshot: {
      id: "svc_airtime_mtn",
      categoryId: "cat_airtime",
      providerId: "mock_vtu",
      kind: "AIRTIME",
      name: "MTN Airtime",
      description: "MTN Airtime top-up",
      currency: "NGN",
      baseAmountMinor: 1000,
      complianceStatus: "AVAILABLE",
      fulfillmentType: "INSTANT_DIGITAL",
      availability: "AVAILABLE",
      inputSchema: [],
      simulated: true,
    },
    amountMinor: 1000,
    currency: "NGN",
    timelineEventIds: ["evt-1", "evt-2"],
    providerFacts: { provider_reference: "air_demo_1" },
    reconciliation: {
      outcome: "MATCH",
      codes: [],
      notes: [],
      sourceAttributes: {},
    },
    mismatchFlags: [],
    resolutionStatus: "NONE",
    auditEventIds: ["led-1"],
    createdAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
  };

  await store.insert("evidence_packs", pack);

  const stored = await store.readLatestById<EvidencePack>(
    "evidence_packs",
    "evp_mk_txn_1",
  );
  const records = await store.readAll<EvidencePack>("evidence_packs");

  assert.deepEqual(stored, pack);
  assert.deepEqual(records, [pack]);
});
