import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedOrg } from "../fixtures.ts";
import type { MarketplaceCustomer } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleCustomer(
  overrides: Partial<MarketplaceCustomer> = {},
): MarketplaceCustomer {
  return {
    id: "cus_test_1",
    org_id: "org_test",
    name: "Test Customer",
    email: "cus_test_1@example.com",
    phone: "+2340000000000",
    isDemo: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("marketplaceCustomers: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    const record = sampleCustomer();
    const saved = await repos.marketplaceCustomers.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.marketplaceCustomers.readLatestById("cus_test_1");
    assert.ok(found !== null);
    assert.equal(found.org_id, "org_test");
    assert.equal(found.name, "Test Customer");
    assert.equal(found.isDemo, true);
  });
});

test("marketplaceCustomers: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.marketplaceCustomers.readLatestById("cus_missing"),
      null,
    );
  });
});

test("marketplaceCustomers: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    await repos.marketplaceCustomers.insert(
      sampleCustomer({ name: "Old Name" }),
    );
    await repos.marketplaceCustomers.insert(
      sampleCustomer({ name: "New Name" }),
    );

    const found = await repos.marketplaceCustomers.readLatestById("cus_test_1");
    assert.ok(found !== null);
    assert.equal(found.name, "New Name");
  });
});

test("marketplaceCustomers: listByOrg scopes and orders by id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "org_test");
    await seedOrg(tx, "org_other");

    await repos.marketplaceCustomers.insert(
      sampleCustomer({ id: "cus_c", org_id: "org_test" }),
    );
    await repos.marketplaceCustomers.insert(
      sampleCustomer({ id: "cus_a", org_id: "org_test" }),
    );
    await repos.marketplaceCustomers.insert(
      sampleCustomer({ id: "cus_b", org_id: "org_other" }),
    );

    const rows = await repos.marketplaceCustomers.listByOrg("org_test");
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["cus_a", "cus_c"],
    );
    for (const row of rows) {
      assert.equal(row.org_id, "org_test");
    }
  });
});
