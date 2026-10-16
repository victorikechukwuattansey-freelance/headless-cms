import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedCustomer, seedOrg } from "../fixtures.ts";
import type { MarketplaceOrder } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
}

function sampleOrder(
  overrides: Partial<MarketplaceOrder> = {},
): MarketplaceOrder {
  return {
    id: "ord_test_1",
    customerId: "cus_test_1",
    serviceId: "svc_airtime",
    inputs: { recipient: "+2340000000000", amount: "1000" },
    quotedAmountMinor: 12500,
    currency: "NGN",
    customerReference: "ref_ord_test_1",
    status: "CREATED",
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("marketplaceOrders: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = sampleOrder();
    const saved = await repos.marketplaceOrders.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.marketplaceOrders.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.quotedAmountMinor, 12500);
    assert.equal(found.customerReference, "ref_ord_test_1");
    assert.deepEqual(found.inputs, {
      recipient: "+2340000000000",
      amount: "1000",
    });
    assert.equal(found.simulated, true);
  });
});

test("marketplaceOrders: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await repos.marketplaceOrders.readLatestById("ord_missing"),
      null,
    );
  });
});

test("marketplaceOrders: insert with an existing id overwrites (status transition)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.marketplaceOrders.insert(sampleOrder({ status: "CREATED" }));
    await repos.marketplaceOrders.insert(
      sampleOrder({
        status: "COMPLETED",
        updatedAt: "2026-01-01T12:05:00.000Z",
      }),
    );

    const found = await repos.marketplaceOrders.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "COMPLETED");
    assert.equal(found.updatedAt, "2026-01-01T12:05:00.000Z");
  });
});