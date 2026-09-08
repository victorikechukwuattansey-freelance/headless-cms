import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { loadConfig } from "../src/config.ts";
import { JsonlStore } from "../src/store/jsonl-store.ts";
import { createStorefrontServer } from "../src/server.ts";
import type { PaystackGateway } from "../src/paystack/gateway.ts";
import type { PaymentRecord } from "../src/domain/types.ts";

interface TestContext {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(
  seed?: readonly PaymentRecord[],
): Promise<TestContext> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-reconcile-"));
  const store = new JsonlStore(dataDir);
  for (const record of seed ?? []) {
    await store.insert("payments", record);
  }
  const gateway: PaystackGateway = {
    initializeTransaction: async () => ({
      authorizationUrl: "https://checkout.paystack.com/x",
      accessCode: "ac_x",
      reference: "stf_x",
    }),
    verifyTransaction: async () => ({
      payment: {
        reference: "stf_x",
        amount: 3000,
        currency: "NGN",
        status: "SUCCESS",
        occurred_at: 1787032800000,
        provider_id: "t-1",
      },
      source_attributes: { original_status: "success" },
    }),
  };
  const config = loadConfig({ STOREFRONT_DATA_DIR: dataDir });
  const server: Server = createStorefrontServer(config, {
    store,
    paystack: gateway,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => {
          rmSync(dataDir, { recursive: true, force: true });
          error ? reject(error) : resolve();
        }),
      ),
  };
}

function successRecord(id: string, reference: string): PaymentRecord {
  return {
    id,
    businessId: "b-e2e",
    orderId: id,
    expectedAmount: 12500,
    currency: "NGN",
    paystackReference: reference,
    status: "SUCCESS",
    paidAt: "2026-08-18T12:37:49.000Z",
    refundStatus: "NONE",
    metadata: {
      requested_reference: reference,
      authorization_url: "https://checkout.paystack.com/abc",
      callback_url: "http://localhost:8787/callback?orderId=" + id,
      customer_email: "buyer@example.com",
      product_id: "p-1",
      verified_at: "2026-08-18T12:37:53.000Z",
      paystack_canonical_status: "SUCCESS",
      integrity: "OK",
      paystack_amount: "12500",
      paystack_currency: "NGN",
      paystack_paid_at: "2026-08-18T12:37:49.000Z",
    },
    recordedAt: "2026-08-18T12:37:53.000Z",
  };
}

test("GET /reconcile returns the expected-vs-received view", async () => {
  const ctx = await startServer([
    successRecord("o-1", "stf_o1"),
    successRecord("o-2", "stf_o2"),
  ]);
  try {
    const response = await fetch(`${ctx.baseUrl}/reconcile`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      summary: { matched: number; totalRecords: number };
      results: Array<{
        orderId: string;
        reference: string;
        expectedAmount: number;
        receivedAmount: number;
        difference: number;
        status: string;
        outcome: string;
      }>;
    };
    assert.equal(body.summary.matched, 2);
    assert.equal(body.summary.totalRecords, 4);
    assert.equal(body.results.length, 2);
    const first = body.results[0] as NonNullable<(typeof body.results)[number]>;
    assert.equal(first.orderId, "o-1");
    assert.equal(first.reference, "stf_o1");
    assert.equal(first.expectedAmount, 12500);
    assert.equal(first.receivedAmount, 12500);
    assert.equal(first.difference, 0);
    assert.equal(first.status, "SUCCESS");
    assert.equal(first.outcome, "MATCH");
  } finally {
    await ctx.close();
  }
});

test("GET /reconcile?orderId= returns one row", async () => {
  const ctx = await startServer([successRecord("o-1", "stf_o1")]);
  try {
    const response = await fetch(`${ctx.baseUrl}/reconcile?orderId=o-1`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      results: Array<{ orderId: string }>;
    };
    assert.equal(body.results.length, 1);
    assert.equal(body.results[0]?.orderId, "o-1");
  } finally {
    await ctx.close();
  }
});

test("GET /reconcile?orderId= unknown order is 404 ORDER_NOT_FOUND", async () => {
  const ctx = await startServer([successRecord("o-1", "stf_o1")]);
  try {
    const response = await fetch(`${ctx.baseUrl}/reconcile?orderId=o-missing`);
    assert.equal(response.status, 404);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, "ORDER_NOT_FOUND");
  } finally {
    await ctx.close();
  }
});

test("GET /reconcile/merchant.csv emits the frozen merchant CSV contract", async () => {
  const ctx = await startServer([successRecord("o-1", "stf_o1")]);
  try {
    const response = await fetch(`${ctx.baseUrl}/reconcile/merchant.csv`);
    assert.equal(response.status, 200);
    const text = await response.text();
    const lines = text.trim().split("\n");
    assert.equal(
      lines[0],
      "merchant_reference,amount,currency,status,occurred_at,merchant_record_id",
    );
    const row = (lines[1] ?? "").split(",");
    assert.equal(row[0], "stf_o1");
    assert.equal(row[1], "12500");
    assert.equal(row[2], "NGN");
    assert.equal(row[3], "SUCCESS");
    assert.equal(row[5], "o-1");
  } finally {
    await ctx.close();
  }
});
