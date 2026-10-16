import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedCustomer, seedOrg } from "../fixtures.ts";
import type {
  MarketplaceWallet,
  WalletLedgerEntry,
} from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedWallet(
  tx: Prisma.TransactionClient,
  walletId = "wl_test_1",
  customerId = "cus_test_1",
): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: customerId, orgId: "org_test" });
  const wallet: MarketplaceWallet = {
    id: walletId,
    customerId,
    currency: "NGN",
    openingBalanceMinor: 100_000,
    status: "ACTIVE",
    simulated: true,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const repos = buildRepositories(tx);
  await repos.wallets.insert(wallet);
}

function sampleEntry(
  overrides: Partial<WalletLedgerEntry> = {},
): WalletLedgerEntry {
  return {
    id: "wl_test_1_DEBIT_SUCCESS_1",
    walletId: "wl_test_1",
    transactionId: "txn_1",
    type: "DEBIT_SUCCESS",
    amountMinor: 12_500,
    currency: "NGN",
    status: "POSTED",
    reference: "wld_test_1_txn_1_1",
    occurredAt: "2026-01-01T12:00:00.000Z",
    metadata: { simulated: "true", scenario: "SUCCESS" },
    simulated: true,
    ...overrides,
  };
}

test("walletLedger: insert persists and listByWallet reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedWallet(tx);

    const entry = sampleEntry();
    const saved = await repos.walletLedger.insert(entry);
    assert.deepEqual(saved, entry);

    const rows = await repos.walletLedger.listByWallet("wl_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "wl_test_1_DEBIT_SUCCESS_1");
    assert.equal(rows[0].type, "DEBIT_SUCCESS");
    assert.equal(rows[0].status, "POSTED");
    assert.equal(rows[0].amountMinor, 12_500);
    assert.equal(rows[0].simulated, true);
  });
});

test("walletLedger: listByWallet returns empty for an unknown wallet", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.deepEqual(await repos.walletLedger.listByWallet("wl_missing"), []);
  });
});

test("walletLedger: insert with an existing id overwrites (upsert, not throw)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedWallet(tx);

    await repos.walletLedger.insert(sampleEntry({ status: "PENDING" }));
    await repos.walletLedger.insert(sampleEntry({ status: "POSTED" }));

    const rows = await repos.walletLedger.listByWallet("wl_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "POSTED");
  });
});

test("walletLedger: listByTransaction isolates entries by transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedWallet(tx);

    await repos.walletLedger.insert(
      sampleEntry({
        id: "wl_test_1_DEBIT_SUCCESS_1",
        transactionId: "txn_a",
        reference: "wld_test_1_txn_a_1",
      }),
    );
    await repos.walletLedger.insert(
      sampleEntry({
        id: "wl_test_1_DEBIT_SUCCESS_2",
        transactionId: "txn_b",
        reference: "wld_test_1_txn_b_1",
      }),
    );

    const a = await repos.walletLedger.listByTransaction("txn_a");
    assert.equal(a.length, 1);
    assert.equal(a[0].transactionId, "txn_a");

    const b = await repos.walletLedger.listByTransaction("txn_b");
    assert.equal(b.length, 1);
    assert.equal(b[0].transactionId, "txn_b");
  });
});

test("walletLedger: listByWallet orders by occurredAt then id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedWallet(tx);

    // Insert in reverse of the expected read order.
    await repos.walletLedger.insert(
      sampleEntry({
        id: "wl_test_1_B_2",
        occurredAt: "2026-01-01T12:00:01.000Z",
        reference: "wld_test_1_B_2",
      }),
    );
    await repos.walletLedger.insert(
      sampleEntry({
        id: "wl_test_1_A_1",
        occurredAt: "2026-01-01T12:00:00.000Z",
        reference: "wld_test_1_A_1",
      }),
    );

    const rows = await repos.walletLedger.listByWallet("wl_test_1");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].id, "wl_test_1_A_1");
    assert.equal(rows[1].id, "wl_test_1_B_2");
  });
});