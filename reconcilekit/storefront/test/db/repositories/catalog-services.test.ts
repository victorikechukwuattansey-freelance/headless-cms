import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type {
  MarketplaceCategory,
  MarketplaceService,
} from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleCategory(): MarketplaceCategory {
  return {
    id: "cat_airtime",
    group: "CORE_VTU_BILL_PAYMENT",
    name: "Airtime",
    description: "Mobile airtime top-up across networks.",
    complianceStatus: "AVAILABLE",
    displayOrder: 1,
    simulated: true,
  };
}

function sampleService(
  overrides: Partial<MarketplaceService> = {},
): MarketplaceService {
  return {
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
      {
        name: "recipient",
        label: "Recipient phone",
        type: "PHONE",
        required: true,
      },
      { name: "amount", label: "Amount (NGN)", type: "NUMBER", required: true },
    ],
    simulated: true,
    ...overrides,
  };
}

async function seedCategory(tx: Prisma.TransactionClient): Promise<void> {
  const repos = buildRepositories(tx);
  await repos.catalogCategories.insert(sampleCategory());
}

test("catalogServices: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedCategory(tx);
    const record = sampleService();
    const saved = await repos.catalogServices.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.catalogServices.readLatestById("svc_airtime_mtn");
    assert.ok(found !== null);
    assert.equal(found.kind, "AIRTIME");
    assert.equal(found.currency, "NGN");
    assert.equal(found.inputSchema.length, 2);
    assert.equal(found.simulated, true);
  });
});

test("catalogServices: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.catalogServices.readLatestById("svc_missing"),
      null,
    );
  });
});

test("catalogServices: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedCategory(tx);
    await repos.catalogServices.insert(
      sampleService({ baseAmountMinor: 1000 }),
    );
    await repos.catalogServices.insert(
      sampleService({ baseAmountMinor: 2000 }),
    );

    const found = await repos.catalogServices.readLatestById("svc_airtime_mtn");
    assert.ok(found !== null);
    assert.equal(found.baseAmountMinor, 2000);
  });
});

test("catalogServices: list returns all in id order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedCategory(tx);
    await repos.catalogServices.insert(sampleService({ id: "svc_c" }));
    await repos.catalogServices.insert(sampleService({ id: "svc_a" }));
    await repos.catalogServices.insert(sampleService({ id: "svc_b" }));

    const rows = await repos.catalogServices.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["svc_a", "svc_b", "svc_c"],
    );
  });
});
