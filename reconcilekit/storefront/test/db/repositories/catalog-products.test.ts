import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type {
  CatalogProduct,
  MarketplaceCategory,
  MarketplaceService,
} from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(tx: Prisma.TransactionClient): Promise<void> {
  const repos = buildRepositories(tx);

  const category: MarketplaceCategory = {
    id: "cat_airtime",
    group: "CORE_VTU_BILL_PAYMENT",
    name: "Airtime",
    description: "Mobile airtime top-up across networks.",
    complianceStatus: "AVAILABLE",
    displayOrder: 1,
    simulated: true,
  };
  await repos.catalogCategories.insert(category);

  const service: MarketplaceService = {
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
  await repos.catalogServices.insert(service);
}

function sampleProduct(
  overrides: Partial<CatalogProduct> = {},
): CatalogProduct {
  return {
    id: "prod_airtime_mtn_100",
    serviceId: "svc_airtime_mtn",
    categoryId: "cat_airtime",
    providerId: "prv_airtime",
    name: "MTN ₦1,000",
    description: "₦1,000 MTN airtime.",
    kind: "AIRTIME",
    fulfillmentType: "INSTANT_DIGITAL",
    pricing: { catalogPriceMinor: 1000, currency: "NGN" },
    availability: "AVAILABLE",
    attributes: { network: "MTN", amount: "1000" },
    simulated: true,
    ...overrides,
  };
}

test("catalogProducts: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = sampleProduct();
    const saved = await repos.catalogProducts.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.catalogProducts.readLatestById(
      "prod_airtime_mtn_100",
    );
    assert.ok(found !== null);
    assert.equal(found.pricing.catalogPriceMinor, 1000);
    assert.equal(found.pricing.currency, "NGN");
    assert.equal(found.attributes.network, "MTN");
    assert.equal(found.simulated, true);
  });
});

test("catalogProducts: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.catalogProducts.readLatestById("prod_missing"),
      null,
    );
  });
});

test("catalogProducts: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.catalogProducts.insert(
      sampleProduct({ pricing: { catalogPriceMinor: 1000, currency: "NGN" } }),
    );
    await repos.catalogProducts.insert(
      sampleProduct({ pricing: { catalogPriceMinor: 1500, currency: "NGN" } }),
    );

    const found = await repos.catalogProducts.readLatestById(
      "prod_airtime_mtn_100",
    );
    assert.ok(found !== null);
    assert.equal(found.pricing.catalogPriceMinor, 1500);
  });
});

test("catalogProducts: list returns all in id order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.catalogProducts.insert(sampleProduct({ id: "prod_c" }));
    await repos.catalogProducts.insert(sampleProduct({ id: "prod_a" }));
    await repos.catalogProducts.insert(sampleProduct({ id: "prod_b" }));

    const rows = await repos.catalogProducts.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["prod_a", "prod_b", "prod_c"],
    );
  });
});
