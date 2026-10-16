import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { MarketplaceCategory } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleCategory(
  overrides: Partial<MarketplaceCategory> = {},
): MarketplaceCategory {
  return {
    id: "cat_airtime",
    group: "CORE_VTU_BILL_PAYMENT",
    name: "Airtime",
    description: "Mobile airtime top-up across networks.",
    complianceStatus: "AVAILABLE",
    displayOrder: 1,
    simulated: true,
    ...overrides,
  };
}

test("catalogCategories: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const record = sampleCategory();
    const saved = await repos.catalogCategories.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.catalogCategories.readLatestById("cat_airtime");
    assert.ok(found !== null);
    assert.equal(found.name, "Airtime");
    assert.equal(found.group, "CORE_VTU_BILL_PAYMENT");
    assert.equal(found.displayOrder, 1);
    assert.equal(found.simulated, true);
  });
});

test("catalogCategories: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.catalogCategories.readLatestById("cat_missing"),
      null,
    );
  });
});

test("catalogCategories: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.catalogCategories.insert(sampleCategory({ name: "Old Name" }));
    await repos.catalogCategories.insert(sampleCategory({ name: "New Name" }));

    const found = await repos.catalogCategories.readLatestById("cat_airtime");
    assert.ok(found !== null);
    assert.equal(found.name, "New Name");
  });
});

test("catalogCategories: list returns all in displayOrder", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.catalogCategories.insert(
      sampleCategory({ id: "cat_c", displayOrder: 3 }),
    );
    await repos.catalogCategories.insert(
      sampleCategory({ id: "cat_a", displayOrder: 1 }),
    );
    await repos.catalogCategories.insert(
      sampleCategory({ id: "cat_b", displayOrder: 2 }),
    );

    const rows = await repos.catalogCategories.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["cat_a", "cat_b", "cat_c"],
    );
  });
});
