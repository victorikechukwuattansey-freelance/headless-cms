import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { PaymentRecord } from "../../../src/domain/types.ts";

const prisma = getPrismaClient();

async function seedChain(
  tx: Prisma.TransactionClient,
  orderId: string,
  businessId: string,
  productId: string,
): Promise<void> {
  const repos = buildRepositories(tx);
  await repos.businesses.insert({
    id: businessId,
    name: `Business ${businessId}`,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  await repos.products.insert({
    id: productId,
    businessId,
    name: `Product ${productId}`,
    priceMinor: 12500,
    currency: "NGN",
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  await repos.orders.insert({
    id: orderId,
    businessId,
    productId,
    customerEmail: "buyer@example.com",
    expectedAmountMinor: 12500,
    currency: "NGN",
    status: "PAYMENT_INITIATED",
    paystackReference: `ps_ref_${orderId}`,
    authorizationUrl: `https://checkout.paystack.com/${orderId}`,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
}

function samplePayment(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "ord_test_1",
    businessId: "biz_test_1",
    orderId: "ord_test_1",
    expectedAmount: 12500,
    currency: "NGN",
    paystackReference: "ps_ref_ord_test_1",
    status: "PENDING",
    paidAt: null,
    refundStatus: "NONE",
    metadata: { requested_reference: "ps_ref_ord_test_1" },
    recordedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("payments: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "ord_test_1", "biz_test_1", "prd_test_1");
    const record = samplePayment();
    const saved = await repos.payments.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.payments.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "PENDING");
    assert.equal(found.paystackReference, "ps_ref_ord_test_1");
    assert.equal(found.paidAt, null);
    assert.equal(found.refundStatus, "NONE");
  });
});

test("payments: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.payments.readLatestById("ord_missing"), null);
  });
});

test("payments: insert with an existing id overwrites (PENDING → SUCCESS with paidAt)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "ord_test_1", "biz_test_1", "prd_test_1");

    await repos.payments.insert(
      samplePayment({ status: "PENDING", paidAt: null }),
    );
    await repos.payments.insert(
      samplePayment({
        status: "SUCCESS",
        paidAt: "2026-01-01T00:05:00.000Z",
        metadata: {
          requested_reference: "ps_ref_ord_test_1",
          verified_at: "2026-01-01T00:05:00.000Z",
          integrity: "OK",
        },
      }),
    );

    const found = await repos.payments.readLatestById("ord_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "SUCCESS");
    assert.equal(found.paidAt, "2026-01-01T00:05:00.000Z");
    assert.equal(found.metadata.integrity, "OK");
  });
});

test("payments: list returns every payment in id order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "ord_b", "biz_test_1", "prd_test_1");
    await seedChain(tx, "ord_a", "biz_test_1", "prd_test_1");
    await seedChain(tx, "ord_c", "biz_test_1", "prd_test_1");

    await repos.payments.insert(
      samplePayment({
        id: "ord_b",
        orderId: "ord_b",
        paystackReference: "ps_ref_ord_b",
      }),
    );
    await repos.payments.insert(
      samplePayment({
        id: "ord_a",
        orderId: "ord_a",
        paystackReference: "ps_ref_ord_a",
      }),
    );
    await repos.payments.insert(
      samplePayment({
        id: "ord_c",
        orderId: "ord_c",
        paystackReference: "ps_ref_ord_c",
      }),
    );

    const rows = await repos.payments.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["ord_a", "ord_b", "ord_c"],
    );
  });
});

test("payments: findByOrderId returns the payment for that order only", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx, "ord_a", "biz_test_1", "prd_test_1");
    await seedChain(tx, "ord_b", "biz_test_1", "prd_test_1");

    await repos.payments.insert(
      samplePayment({
        id: "ord_a",
        orderId: "ord_a",
        paystackReference: "ps_ref_ord_a",
      }),
    );
    await repos.payments.insert(
      samplePayment({
        id: "ord_b",
        orderId: "ord_b",
        paystackReference: "ps_ref_ord_b",
      }),
    );

    const found = await repos.payments.findByOrderId("ord_a");
    assert.ok(found !== null);
    assert.equal(found.id, "ord_a");
    assert.equal(found.orderId, "ord_a");

    assert.equal(await repos.payments.findByOrderId("ord_missing"), null);
  });
});
