import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import {
  ReconcileError,
  reconcileMarketplaceTransaction,
  type MarketplaceReconcileDeps,
} from "../../src/marketplace/reconcile.ts";
import {
  listTransactionEvents,
  TransactionEventType,
} from "../../src/marketplace/timeline.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { truncateCommittedState } from "../db/isolation.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import type { ExecuteTransactionInput } from "../../src/marketplace/transactions.ts";
import type { EvidencePack } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

beforeEach(async () => {
  await truncateCommittedState(prisma);
  await seedDemoCustomer(prisma);
});

after(async () => {
  await truncateCommittedState(prisma);
});

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-reconcile-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function reconcileDeps(
  store: JsonlStore,
  repos: Repositories,
): MarketplaceReconcileDeps {
  return { store, repos, catalog: buildDemoCatalog() };
}

function input(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
    ...overrides,
  };
}

async function snapshotRows(store: JsonlStore): Promise<readonly string[]> {
  const kinds = [
    "payments",
    "marketplace_provider_attempts",
    "wallet_ledger",
  ] as const;
  const json: string[] = [];
  for (const kind of kinds) {
    const rows = await store.readAll(kind);
    json.push(JSON.stringify(rows));
  }
  return json;
}

async function packFor(
  store: JsonlStore,
  transactionId: string,
): Promise<EvidencePack | null> {
  return store.readLatestById<EvidencePack>(
    "evidence_packs",
    `evp_${transactionId}`,
  );
}

test("reconcile: SUCCESS settles clean — no money at risk", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "SUCCESS" }),
  );
  const rows = await snapshotRows(store);

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.replayed, false);
  assert.equal(result.truth.reconcileOutcome, "MATCH");
  assert.equal(result.truth.customerStatus, "CONFIRMED");
  assert.equal(result.truth.adminStatus, "HEALTHY");
  assert.equal(result.truth.moneyAtRisk, false);
  assert.equal(result.report?.summary.matched, 1);
  assert.equal(result.pack.reconciliation?.outcome, "MATCH");
  assert.deepEqual(result.pack.mismatchFlags, []);

  const events = await listTransactionEvents(store, executed.transaction.id);
  assert.equal(events.length, executed.events.length + 2);
  assert.equal(events.filter((e) => e.source === "RECONCILE_KIT").length, 2);
  assert.equal(result.events[0].type, TransactionEventType.ReconcileInputBuilt);
  assert.equal(result.events[1].type, TransactionEventType.ReconcileDetermined);

  const updated = await repos.marketplaceTransactions.readLatestById(
    executed.transaction.id,
  );
  assert.ok(updated !== null);
  assert.equal(updated.reconcileOutcome, "MATCH");
  assert.equal(updated.customerStatus, "CONFIRMED");
  assert.equal(updated.adminStatus, "HEALTHY");

  assert.deepEqual(await snapshotRows(store), rows);
});

test("reconcile: FAILED exposes a provider-side discrepancy and money at risk", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "FAILED" }),
  );

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.truth.reconcileOutcome, "DISCREPANCY");
  assert.equal(result.truth.customerStatus, "NEEDS_ATTENTION");
  assert.equal(result.truth.adminStatus, "PROVIDER_FAILED");
  assert.equal(result.truth.moneyAtRisk, true);
  assert.deepEqual(result.pack.mismatchFlags, ["STATUS_MISMATCH"]);
  assert.equal(
    result.events[1].type,
    TransactionEventType.ReconcileRequiresReview,
  );
});

test("reconcile: TIMEOUT has no provider evidence — held, never fabricated", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "TIMEOUT" }),
  );

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.truth.reconcileOutcome, "MISSING_PROVIDER_RECORD");
  assert.equal(result.truth.customerStatus, "PENDING");
  assert.equal(result.truth.adminStatus, "PENDING_PROVIDER");
  assert.equal(result.truth.moneyAtRisk, true);
  assert.equal(result.pack.providerReference, null);
  assert.deepEqual(result.pack.reconciliation?.codes, []);
  assert.deepEqual(result.pack.mismatchFlags, ["STATUS_UNRESOLVED"]);
});

test("reconcile: UNKNOWN stays unresolved, never convinced either way", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "UNKNOWN" }),
  );

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.truth.reconcileOutcome, "UNRESOLVED");
  assert.equal(result.truth.customerStatus, "NEEDS_ATTENTION");
  assert.equal(result.truth.adminStatus, "UNRESOLVED");
  assert.equal(result.truth.moneyAtRisk, true);
});

test("reconcile: REVERSAL outcome is resolved — no money at risk", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "REVERSED" }),
  );

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.truth.reconcileOutcome, "MATCH");
  assert.equal(result.truth.customerStatus, "REVERSED");
  assert.equal(result.truth.adminStatus, "HEALTHY");
  assert.equal(result.truth.moneyAtRisk, false);
});

test("reconcile: declined wallet debit is a clean failure, not a mystery", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "SUCCESS", openingBalanceMinor: 0 }),
  );

  const result = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(result.truth.reconcileOutcome, "MISSING_PROVIDER_RECORD");
  assert.equal(result.truth.customerStatus, "FAILED");
  assert.equal(result.truth.adminStatus, "HEALTHY");
  assert.equal(result.truth.moneyAtRisk, false);
  assert.equal(result.pack.providerReference, null);
  assert.equal(result.pack.reconciliation?.codes.length, 0);
});

test("reconcile: evidence pack carries the service snapshot and provider facts", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "SUCCESS" }),
  );

  await reconcileMarketplaceTransaction(reconcileDeps(store, repos), {
    transactionId: executed.transaction.id,
    now: NOW,
  });

  const pack = await packFor(store, executed.transaction.id);
  assert.ok(pack !== null);
  assert.equal(pack.id, `evp_${executed.transaction.id}`);
  assert.equal(pack.serviceSnapshot.id, "svc_airtime_mtn");
  assert.equal(pack.serviceSnapshot.currency, "NGN");
  assert.equal(
    pack.providerFacts.provider_reference,
    executed.facts?.providerReference,
  );
  assert.equal(pack.reconciliation?.outcome, "MATCH");
  assert.equal(pack.simulated, true);
});

test("reconcile: replay is store-only — no engine re-run, no new rows", async (t) => {
  const store = tempStore(t);
  const executed = await executeMarketplaceTransaction(
    demoDeps(store, repos),
    input({ scenario: "FAILED" }),
  );

  const first = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );
  const eventsAfterFirst = await listTransactionEvents(
    store,
    executed.transaction.id,
  );
  const rowsAfterFirst = await snapshotRows(store);

  const replay = await reconcileMarketplaceTransaction(
    reconcileDeps(store, repos),
    {
      transactionId: executed.transaction.id,
      now: NOW,
    },
  );

  assert.equal(replay.replayed, true);
  assert.equal(replay.report, null);
  assert.deepEqual(replay.truth, first.truth);
  assert.equal(replay.pack.id, first.pack.id);
  assert.deepEqual(
    await listTransactionEvents(store, executed.transaction.id),
    eventsAfterFirst,
  );
  assert.deepEqual(await snapshotRows(store), rowsAfterFirst);

  const packs = await store.readAll<EvidencePack>("evidence_packs");
  assert.equal(packs.length, 1);
});

test("reconcile: unknown transaction is a typed error", async (t) => {
  const store = tempStore(t);
  await assert.rejects(
    () =>
      reconcileMarketplaceTransaction(reconcileDeps(store, repos), {
        transactionId: "mk_txn_missing",
        now: NOW,
      }),
    (error: unknown) =>
      error instanceof ReconcileError && error.code === "TRANSACTION_NOT_FOUND",
  );
});
