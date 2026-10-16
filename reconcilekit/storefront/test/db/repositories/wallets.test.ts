import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedCustomer, seedOrg } from "../fixtures.ts";
import type { MarketplaceWallet } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleWallet(
  overrides: Partial<MarketplaceWallet> = {},
): MarketplaceWallet {
  return {
    id: "wl_test_1",
    customerId: "cus_test_1",
    currency: "NGN",
    openingBalanceMinor: 100_000,
    status: "ACTIVE",
    simulated: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("wallets: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });

    const wallet = sampleWallet();
    const saved = await repos.wallets.insert(wallet);
    assert.deepEqual(saved, wallet);

    const found = await repos.wallets.readLatestById("wl_test_1");
    assert.ok(found !== null);
    assert.equal(found.customerId, "cus_test_1");
    assert.equal(found.openingBalanceMinor, 100_000);
    assert.equal(found.status, "ACTIVE");
    assert.equal(found.simulated, true);
  });
});

test("wallets: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.wallets.readLatestById("wl_missing"), null);
  });
});

test("wallets: insert with an existing id overwrites (upsert, not throw)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });

    await repos.wallets.insert(sampleWallet({ openingBalanceMinor: 100_000 }));
    await repos.wallets.insert(sampleWallet({ openingBalanceMinor: 250_000 }));

    const found = await repos.wallets.readLatestById("wl_test_1");
    assert.ok(found !== null);
    assert.equal(found.openingBalanceMinor, 250_000);
  });
});

test("wallets: findByCustomer returns the wallet for that customer only", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    await seedCustomer(tx, { id: "cus_a", orgId: "org_test" });
    await seedCustomer(tx, { id: "cus_b", orgId: "org_test" });

    await repos.wallets.insert(
      sampleWallet({ id: "wl_a", customerId: "cus_a" }),
    );
    await repos.wallets.insert(
      sampleWallet({ id: "wl_b", customerId: "cus_b" }),
    );

    const found = await repos.wallets.findByCustomer("cus_a");
    assert.ok(found !== null);
    assert.equal(found.id, "wl_a");
    assert.equal(found.customerId, "cus_a");
  });
});

test("wallets: findByCustomer returns null for an unknown customer", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.wallets.findByCustomer("cus_missing"), null);
  });
});
