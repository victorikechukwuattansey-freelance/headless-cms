import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { Order } from "../../../src/domain/types.ts";

const prisma = getPrismaClient();

async function seedBusinessAndProduct(
  tx: Prisma.TransactionClient,
): Promise<void> {
  const repos = buildRepositories(tx);
  await repos.businesses.insert({
    id: "biz_test_1",
    name: "Test Business",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  await repos.products.insert({
    id: "prd_test_1",
    businessId: "biz_test_1",
    name: "Test Product",
    priceMinor: 12500,
    currency: "NGN",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

function sampleOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "ord_test_1",
    businessId: "biz_test_1",
    productId: "prd_test_1",
    customerEmail: "buyer@example.com",
    expectedAmountMinor: 12500,
    currency: "NGN",
    status: "PAYMENT_INITIATED",
    paystackReference: "ps_ref_abc",
    authorizationUrl: "https://checkout.paystack.com/abc",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("orders: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedBusinessAndProduct(tx);
    const record = sampleOrder();
    const saved = await repos.orders.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.orders.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "PAYMENT_INITIATED");
    assert.equal(found.paystackReference, "ps_ref_abc");
    assert.equal(found.authorizationUrl, "https://checkout.paystack.com/abc");
  });
});

test("orders: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.orders.readLatestById("ord_missing"), null);
  });
});

test("orders: insert with an existing id overwrites (INITIALIZATION_FAILED → PAYMENT_INITIATED)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedBusinessAndProduct(tx);
    await repos.orders.insert(
      sampleOrder({
        status: "INITIALIZATION_FAILED",
        paystackReference: null,
        authorizationUrl: null,
      }),
    );
    await repos.orders.insert(sampleOrder({ status: "PAYMENT_INITIATED" }));

    const found = await repos.orders.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "PAYMENT_INITIATED");
    assert.equal(found.paystackReference, "ps_ref_abc");
  });
});
