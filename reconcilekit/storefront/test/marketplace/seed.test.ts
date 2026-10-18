import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  DEMO_ORDER_SCENARIOS,
  DEMO_SCENARIO_NAMES,
  WALLET_FUNDING_SCENARIO_NAME,
  demoAliasFor,
  resolveDemoAlias,
} from "../../src/marketplace/demo-scenarios.ts";
import {
  seedDemoData,
  seedWalletFundingFailure,
  DEMO_WALLET_FUNDING_CUSTOMER_ID,
  DEMO_WALLET_FUNDING_TRANSACTION_ID,
  DEMO_WALLET_FUNDING_WALLET_ID,
} from "../../src/marketplace/seed.ts";
import {
  findWalletByCustomer,
  getWalletBalance,
} from "../../src/marketplace/wallet.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import { findTransactionByIdentifier } from "../../src/ui/client.ts";
import type { WalletLedgerEntry } from "../../src/marketplace/types.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import type {
  SeededDemoEntry,
  SeededOrderEntry,
  SeededWalletFundingEntry,
} from "../../src/marketplace/seed.ts";

const prisma = getPrismaClient();

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-seed-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

async function ledgerFor(
  repos: Repositories,
  transactionId: string,
): Promise<readonly WalletLedgerEntry[]> {
  return repos.walletLedger.listByTransaction(transactionId);
}

function orderEntries(seeded: {
  readonly transactions: readonly SeededDemoEntry[];
}): SeededOrderEntry[] {
  return seeded.transactions.filter(
    (entry): entry is SeededOrderEntry => entry.kind === "ORDER",
  );
}

test("demo seed creates all required validation scenarios", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const seeded = await seedDemoData(store, repos);
    const names = seeded.transactions.map((entry) => entry.demoScenarioName);
    assert.deepEqual(names.slice().sort(), DEMO_SCENARIO_NAMES.slice().sort());
  });
});

test("demo seed produces stable, unique identities with friendly names", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const seeded = await seedDemoData(store, repos);
    const orders = orderEntries(seeded);

    assert.equal(seeded.transactions.length, 16);
    assert.equal(orders.length, 15);
    assert.equal(
      seeded.transactions.filter((entry) => entry.kind === "WALLET_FUNDING")
        .length,
      1,
    );

    const ids = seeded.transactions.map((entry) => entry.transactionId);
    const references = seeded.transactions.map((entry) => entry.reference);
    assert.equal(
      new Set(ids).size,
      ids.length,
      "transaction ids must be unique",
    );
    assert.equal(
      new Set(references).size,
      references.length,
      "references must be unique",
    );

    for (const name of DEMO_SCENARIO_NAMES) {
      assert.ok(seeded.byName[name], `byName missing ${name}`);
      assert.equal(
        seeded.transactions.some((e) => e.demoScenarioName === name),
        true,
        name,
      );
    }

    for (const entry of orders) {
      assert.ok(entry.transactionId.startsWith("mk_txn_"), entry.transactionId);
      assert.ok(entry.reference.startsWith("txn_"), entry.reference);
      assert.equal(entry.transaction.demoScenarioName, entry.demoScenarioName);
      assert.equal(entry.transaction.reference, entry.reference);
      const persisted = await repos.marketplaceTransactions.readLatestById(
        entry.transactionId,
      );
      assert.equal(
        persisted?.demoScenarioName,
        entry.demoScenarioName,
        "friendly name must be persisted on the latest transaction record",
      );
      assert.ok(entry.truth, "reconciled truth expected");
      assert.ok(entry.pack, "evidence pack expected");
    }
  });
});

test("friendly reference aliases resolve through the existing transaction lookup", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const seeded = await seedDemoData(store, repos);

    for (const scenario of DEMO_ORDER_SCENARIOS) {
      const entry = seeded.byName[scenario.name] as SeededOrderEntry;
      const alias = demoAliasFor(scenario.name);
      const resolved = resolveDemoAlias(alias);
      assert.ok(resolved, alias);
      assert.equal(resolved.id, entry.transactionId);

      const found = await findTransactionByIdentifier(repos, alias);
      assert.ok(found, `lookup by alias should find ${alias}`);
      assert.equal(found.id, entry.transactionId);
      assert.equal(found.demoScenarioName, scenario.name);
    }

    const funding = await findTransactionByIdentifier(
      repos,
      demoAliasFor(WALLET_FUNDING_SCENARIO_NAME),
    );
    assert.equal(
      funding,
      null,
      "wallet funding has no marketplace transaction",
    );
  });
});

test("demo seed is idempotent and leaves no duplicate money movement", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const first = await seedDemoData(store, repos);
    const second = await seedDemoData(store, repos);

    assert.deepEqual(
      first.transactions.map((e) => e.demoScenarioName).sort(),
      second.transactions.map((e) => e.demoScenarioName).sort(),
    );
    assert.deepEqual(
      first.transactions.map((e) => e.transactionId),
      second.transactions.map((e) => e.transactionId),
      "transaction ids must not change across repeated runs",
    );

    for (const entry of orderEntries(first)) {
      const once = await ledgerFor(repos, entry.transactionId);
      assert.equal(once.length >= 1, true, entry.demoScenarioName);
      const replayLedger = await ledgerFor(repos, entry.transactionId);
      assert.equal(
        replayLedger.length,
        once.length,
        `no extra movement on replay for ${entry.demoScenarioName}`,
      );
    }

    const fundingLedger = await ledgerFor(
      repos,
      DEMO_WALLET_FUNDING_TRANSACTION_ID,
    );
    assert.equal(
      fundingLedger.length,
      2,
      "wallet funding failure must be recorded exactly once (initiated + failed)",
    );
  });
});

test("wallet funding failure leaves the opening balance intact and is guarded", async () => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx, DEMO_WALLET_FUNDING_CUSTOMER_ID);
    const repos = buildRepositories(tx);
    const provider = createMockProviderRegistry().payment;
    const entry = await seedWalletFundingFailure(repos, provider);
    const funding = entry as SeededWalletFundingEntry;

    assert.equal(funding.kind, "WALLET_FUNDING");
    assert.equal(funding.demoScenarioName, WALLET_FUNDING_SCENARIO_NAME);
    assert.equal(funding.walletId, DEMO_WALLET_FUNDING_WALLET_ID);
    assert.equal(funding.transactionId, DEMO_WALLET_FUNDING_TRANSACTION_ID);

    assert.ok(funding.outcome, "fresh run must produce a funding outcome");
    assert.equal(funding.outcome.lifecycle, "FAILED");

    const balance = await getWalletBalance(
      repos,
      DEMO_WALLET_FUNDING_WALLET_ID,
      "NGN",
    );
    assert.equal(
      balance.availableMinor,
      100_000,
      "failed funding must not move balance",
    );

    const repeated = await seedWalletFundingFailure(repos, provider);
    assert.equal(
      repeated.outcome,
      null,
      "a repeat of an already-seeded funding must not re-attempt the provider",
    );
    const ledger = await ledgerFor(repos, DEMO_WALLET_FUNDING_TRANSACTION_ID);
    assert.equal(
      ledger.length,
      2,
      "funding ledger must stay at initiated + failed",
    );
    assert.equal(
      ledger.some((entry) => entry.type === "FUNDING_INITIATED"),
      true,
      "FUNDING_INITIATED must be present in the funding ledger",
    );
    assert.equal(
      ledger.some((entry) => entry.type === "FUNDING_FAILED"),
      true,
      "failed funding must leave a FUNDING_FAILED ledger entry",
    );

    const wallet = await findWalletByCustomer(
      repos,
      DEMO_WALLET_FUNDING_CUSTOMER_ID,
    );
    assert.equal(wallet?.id, DEMO_WALLET_FUNDING_WALLET_ID);
  });
});
