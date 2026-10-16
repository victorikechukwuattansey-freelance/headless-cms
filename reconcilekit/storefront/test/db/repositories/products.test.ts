import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { Product } from "../../../src/domain/types.ts";

const prisma = getPrismaClient();

async function seedBusiness(tx: Prisma.TransactionClient): Promise<void> {
  const repos = buildRepositories(tx);
  await repos.businesses.insert({
    id: "biz_test_1",
    name: "Test Business",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

function sampleProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "prd_test_1",
    businessId: "biz_test_1",
    name: "Test Product",
    priceMinor: 12500,
    currency: "NGN",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("products: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedBusiness(tx);
    const record = sampleProduct();
    const saved = await repos.products.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.products.readLatestById("prd_test_1");
    assert.ok(found !== null);
    assert.equal(found.businessId, "biz_test_1");
    assert.equal(found.priceMinor, 12500);
    assert.equal(found.currency, "NGN");
  });
});

test("products: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.products.readLatestById("prd_missing"), null);
  });
});

test("products: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedBusiness(tx);
    await repos.products.insert(sampleProduct({ priceMinor: 12500 }));
    await repos.products.insert(sampleProduct({ priceMinor: 15000 }));

    const found = await repos.products.readLatestById("prd_test_1");
    assert.ok(found !== null);
    assert.equal(found.priceMinor, 15000);
  });
});
