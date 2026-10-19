import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { loadConfig } from "../src/config.ts";
import { getPrismaClient } from "../src/db/client.ts";
import { buildRepositories } from "../src/db/repositories/index.ts";
import type { Repositories } from "../src/db/repositories/index.ts";
import { JsonlStore } from "../src/store/jsonl-store.ts";
import { createStorefrontServer } from "../src/server.ts";
import type { PaystackGateway } from "../src/paystack/gateway.ts";
import type {
  Business,
  Order,
  PaymentRecord,
  Product,
} from "../src/domain/types.ts";

const repos = buildRepositories(getPrismaClient());

interface TestContext {
  baseUrl: string;
  close: () => Promise<void>;
  store: JsonlStore;
}

async function startServer(options?: {
  gateway?: PaystackGateway;
  dataDir?: string;
}): Promise<TestContext> {
  const dataDir =
    options?.dataDir ?? mkdtempSync(join(tmpdir(), "storefront-server-"));
  const store = new JsonlStore(dataDir);
  const gateway: PaystackGateway = options?.gateway ?? {
    initializeTransaction: async (input) => ({
      authorizationUrl: `https://checkout.paystack.com/${input.reference}`,
      accessCode: `ac_${input.reference}`,
      reference: input.reference,
    }),
    verifyTransaction: async (input) => ({
      payment: {
        reference: input.reference,
        amount: 3000,
        currency: input.supportedCurrencies[0] ?? "NGN",
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
    repos,
    paystack: gateway,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const ctx: TestContext = {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    store,
  };
  if (options?.dataDir === undefined) {
    rmSync(dataDir, { recursive: true, force: true });
  }
  return ctx;
}

async function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as Record<string, unknown>;
  return { status: response.status, json };
}

async function seedBusinessAndProduct(
  baseUrl: string,
): Promise<{ business: Business; product: Product }> {
  const business = await postJson(baseUrl, "/businesses", {
    name: "Accra Coffee Co",
  });
  const biz = business.json.business as Business;
  const product = await postJson(baseUrl, "/products", {
    businessId: biz.id,
    name: "Cappuccino",
    priceMinor: 3000,
    currency: "NGN",
  });
  return { business: biz, product: product.json.product as Product };
}

async function seedVerifyFixture(
  repos: Repositories,
  options?: {
    readonly reference?: string | null;
    readonly priceMinor?: number;
    readonly currency?: string;
    readonly orderStatus?: Order["status"];
  },
): Promise<Order> {
  const price = options?.priceMinor ?? 3000;
  const currency = options?.currency ?? "NGN";
  const reference =
    options?.reference === undefined ? "stf_fixture" : options.reference;
  const business = {
    id: "b-fixture",
    name: "Fixture Biz",
    createdAt: "2026-08-18T08:00:00.000Z",
  };
  const product = {
    id: "p-fixture",
    businessId: business.id,
    name: "Cup",
    priceMinor: price,
    currency,
    createdAt: "2026-08-18T08:00:00.000Z",
  };
  const order: Order = {
    id: "o-fixture",
    businessId: business.id,
    productId: product.id,
    customerEmail: "customer@example.com",
    expectedAmountMinor: price,
    currency,
    status: options?.orderStatus ?? "PAYMENT_INITIATED",
    paystackReference: reference,
    authorizationUrl: "https://checkout.paystack.com/x",
    createdAt: "2026-08-18T08:00:00.000Z",
  };
  await repos.businesses.insert(business);
  await repos.products.insert(product);
  await repos.orders.insert(order);
  if (reference !== null) {
    const payment: PaymentRecord = {
      id: order.id,
      businessId: business.id,
      orderId: order.id,
      expectedAmount: price,
      currency,
      paystackReference: reference,
      status: "PENDING",
      paidAt: null,
      refundStatus: "NONE",
      metadata: { requested_reference: reference },
      recordedAt: "2026-08-18T08:00:00.000Z",
    };
    await repos.payments.insert(payment);
  }
  return order;
}

test("GET /health reports ok", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const response = await fetch(`${ctx.baseUrl}/health`);
  assert.equal(response.status, 200);
  const body = (await response.json()) as Record<string, unknown>;
  assert.equal(body.status, "ok");
});

test("POST /businesses creates a business with an id", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const { status, json } = await postJson(ctx.baseUrl, "/businesses", {
    name: "Lagos Laundry",
  });
  assert.equal(status, 201);
  const business = json.business as Business;
  assert.ok(business.id.length > 0);
  assert.equal(business.name, "Lagos Laundry");
  assert.ok(business.createdAt.length > 0);
});

test("POST /businesses rejects missing name", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const { status, json } = await postJson(ctx.baseUrl, "/businesses", {});
  assert.equal(status, 400);
  assert.equal((json.error as { code: string }).code, "MISSING_FIELD");
});

test("POST /products creates a product under an existing business", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);
  assert.equal(product.businessId, business.id);
  assert.equal(product.name, "Cappuccino");
  assert.equal(product.priceMinor, 3000);
  assert.equal(product.currency, "NGN");
});

test("POST /products rejects an unknown business", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const { status, json } = await postJson(ctx.baseUrl, "/products", {
    businessId: "no-such-business",
    name: "Tea",
    priceMinor: 1000,
    currency: "NGN",
  });
  assert.equal(status, 404);
  assert.equal((json.error as { code: string }).code, "BUSINESS_NOT_FOUND");
});

test("POST /products rejects invalid price and currency", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const { business } = await seedBusinessAndProduct(ctx.baseUrl);

  const badPrice = await postJson(ctx.baseUrl, "/products", {
    businessId: business.id,
    name: "Tea",
    priceMinor: -5,
    currency: "NGN",
  });
  assert.equal(badPrice.status, 400);

  const badCurrency = await postJson(ctx.baseUrl, "/products", {
    businessId: business.id,
    name: "Tea",
    priceMinor: 1000,
    currency: "ngn",
  });
  assert.equal(badCurrency.status, 400);
});

test("POST /orders initializes payment and persists order + payment record", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);

  const { status, json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: business.id,
    productId: product.id,
    customerEmail: "customer@example.com",
  });

  assert.equal(status, 201);
  const order = json.order as Order;
  const payment = json.payment as PaymentRecord;

  assert.equal(order.businessId, business.id);
  assert.equal(order.productId, product.id);
  assert.equal(order.expectedAmountMinor, product.priceMinor);
  assert.equal(order.currency, product.currency);
  assert.equal(order.status, "PAYMENT_INITIATED");
  assert.ok(order.paystackReference);
  assert.ok(order.authorizationUrl);
  assert.ok(order.paystackReference.startsWith("stf_"));
  assert.ok(order.authorizationUrl.includes(order.paystackReference));

  assert.equal(payment.id, order.id);
  assert.equal(payment.orderId, order.id);
  assert.equal(payment.businessId, business.id);
  assert.equal(payment.expectedAmount, product.priceMinor);
  assert.equal(payment.currency, product.currency);
  assert.equal(payment.paystackReference, order.paystackReference);
  assert.equal(payment.status, "PENDING");
  assert.equal(payment.paidAt, null);
  assert.equal(payment.refundStatus, "NONE");
  assert.equal(payment.metadata.requested_reference, order.paystackReference);

  const persistedOrder = await repos.orders.readLatestById(order.id);
  assert.deepEqual(persistedOrder, order);
  const persistedPayment = await repos.payments.readLatestById(order.id);
  assert.deepEqual(persistedPayment, payment);
});

test("POST /orders uses the product price, never a client-supplied amount", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);

  const { json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: business.id,
    productId: product.id,
    customerEmail: "customer@example.com",
    expectedAmount: 1,
  });

  const order = json.order as Order;
  assert.equal(order.expectedAmountMinor, product.priceMinor);
});

test("POST /orders rejects a product from another business", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);
  const other = await postJson(ctx.baseUrl, "/businesses", {
    name: "Other Co",
  });
  const otherBiz = other.json.business as Business;

  const { status, json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: otherBiz.id,
    productId: product.id,
    customerEmail: "customer@example.com",
  });
  assert.equal(status, 400);
  assert.equal(
    (json.error as { code: string }).code,
    "PRODUCT_BUSINESS_MISMATCH",
  );
});

test("POST /orders persists INITIALIZATION_FAILED order when Paystack rejects", async (t) => {
  const ctx = await startServer({
    gateway: {
      initializeTransaction: async () => {
        throw new Error("Paystack down");
      },
      verifyTransaction: async () => {
        throw new Error("unused");
      },
    },
  });
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);

  const { status, json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: business.id,
    productId: product.id,
    customerEmail: "customer@example.com",
  });

  assert.equal(status, 502);
  assert.equal(
    (json.error as { code: string }).code,
    "PAYSTACK_INITIALIZE_FAILED",
  );
  const orderId = (json.error as { message: string }).message.match(
    /order id ([\w-]+)/,
  )?.[1];
  assert.ok(orderId);

  const persisted = await repos.orders.readLatestById(orderId);
  assert.equal(persisted?.status, "INITIALIZATION_FAILED");
  assert.equal(persisted?.paystackReference, null);

  assert.equal(await repos.payments.findByOrderId(orderId), null);
});

test("POST /orders rejects invalid email", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);

  const { status, json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: business.id,
    productId: product.id,
    customerEmail: "not-an-email",
  });
  assert.equal(status, 400);
  assert.equal((json.error as { code: string }).code, "INVALID_EMAIL");
});

test("POST /orders with no secret yields a clear 502 and a persisted failed order", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-server-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const ctx = await startServer({
    dataDir,
    gateway: {
      initializeTransaction: async () => {
        throw new Error(
          "STOREFRONT_PAYSTACK_SECRET_KEY is not set; cannot initiate payments",
        );
      },
      verifyTransaction: async () => {
        throw new Error("unused");
      },
    },
  });
  t.after(() => ctx.close());
  const { business, product } = await seedBusinessAndProduct(ctx.baseUrl);

  const { status, json } = await postJson(ctx.baseUrl, "/orders", {
    businessId: business.id,
    productId: product.id,
    customerEmail: "customer@example.com",
  });
  assert.equal(status, 502);
  assert.equal(
    (json.error as { code: string }).code,
    "PAYSTACK_INITIALIZE_FAILED",
  );
});

test("unknown routes return 404", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const response = await fetch(`${ctx.baseUrl}/nope`);
  assert.equal(response.status, 404);
});

test("invalid JSON body returns 400", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const response = await fetch(`${ctx.baseUrl}/businesses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{not json",
  });
  assert.equal(response.status, 400);
});

test("POST /orders/:orderId/verify transitions PENDING to SUCCESS and is idempotent", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const order = await seedVerifyFixture(repos);

  const first = await fetch(`${ctx.baseUrl}/orders/${order.id}/verify`, {
    method: "POST",
  });
  assert.equal(first.status, 200);
  const firstBody = (await first.json()) as {
    verification: { changed: boolean; payment: PaymentRecord };
  };
  assert.equal(firstBody.verification.changed, true);
  assert.equal(firstBody.verification.payment.status, "SUCCESS");
  assert.equal(
    firstBody.verification.payment.paidAt,
    new Date(1787032800000).toISOString(),
  );

  const second = await fetch(`${ctx.baseUrl}/orders/${order.id}/verify`, {
    method: "POST",
  });
  assert.equal(second.status, 200);
  const secondBody = (await second.json()) as {
    verification: { changed: boolean; payment: PaymentRecord };
  };
  assert.equal(secondBody.verification.changed, false);
  assert.equal(secondBody.verification.payment.status, "SUCCESS");

  const persisted = await repos.payments.readLatestById(order.id);
  assert.equal(persisted?.status, "SUCCESS");
});

test("POST /orders/:orderId/verify returns 404 for an unknown order", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const response = await fetch(`${ctx.baseUrl}/orders/no-such/verify`, {
    method: "POST",
  });
  assert.equal(response.status, 404);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "ORDER_NOT_FOUND");
});

test("POST /orders/:orderId/verify returns 409 when the order has no reference", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  await seedVerifyFixture(repos, {
    reference: null,
    orderStatus: "INITIALIZATION_FAILED",
  });

  const response = await fetch(`${ctx.baseUrl}/orders/o-fixture/verify`, {
    method: "POST",
  });
  assert.equal(response.status, 409);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "ORDER_NOT_INITIATED");
});

test("POST /orders/:orderId/verify surfaces a reference mismatch without recording it", async (t) => {
  const ctx = await startServer({
    gateway: {
      initializeTransaction: async () => {
        throw new Error("unused");
      },
      verifyTransaction: async (input) => ({
        payment: {
          reference: "stf_EVIL",
          amount: 3000,
          currency: "NGN",
          status: "SUCCESS",
          occurred_at: 1787032800000,
          provider_id: "t-1",
        },
        source_attributes: { original_status: "success" },
      }),
    },
  });
  t.after(() => ctx.close());
  const order = await seedVerifyFixture(repos);

  const response = await fetch(`${ctx.baseUrl}/orders/${order.id}/verify`, {
    method: "POST",
  });
  assert.equal(response.status, 502);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "REFERENCE_MISMATCH");

  const persisted = await repos.payments.readLatestById(order.id);
  assert.equal(persisted?.status, "PENDING");
});

test("POST /orders/:orderId/verify records an amount mismatch as UNKNOWN", async (t) => {
  const ctx = await startServer({
    gateway: {
      initializeTransaction: async () => {
        throw new Error("unused");
      },
      verifyTransaction: async (input) => ({
        payment: {
          reference: input.reference,
          amount: 3001,
          currency: "NGN",
          status: "SUCCESS",
          occurred_at: 1787032800000,
          provider_id: "t-1",
        },
        source_attributes: { original_status: "success" },
      }),
    },
  });
  t.after(() => ctx.close());
  const order = await seedVerifyFixture(repos);

  const response = await fetch(`${ctx.baseUrl}/orders/${order.id}/verify`, {
    method: "POST",
  });
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    verification: { changed: boolean; payment: PaymentRecord };
  };
  const payment = body.verification.payment;
  assert.equal(payment.status, "UNKNOWN");
  assert.equal(payment.metadata.integrity, "AMOUNT_MISMATCH");
  assert.equal(payment.paidAt, null);
});

test("POST /orders/:orderId/verify surfaces transient failures without changing records", async (t) => {
  const ctx = await startServer({
    gateway: {
      initializeTransaction: async () => {
        throw new Error("unused");
      },
      verifyTransaction: async () => {
        throw new Error("Paystack API down");
      },
    },
  });
  t.after(() => ctx.close());
  const order = await seedVerifyFixture(repos);

  const response = await fetch(`${ctx.baseUrl}/orders/${order.id}/verify`, {
    method: "POST",
  });
  assert.equal(response.status, 502);
  const json = (await response.json()) as { error: { code: string } };
  assert.equal(json.error.code, "VERIFY_FAILED");

  const persisted = await repos.payments.readLatestById(order.id);
  assert.equal(persisted?.status, "PENDING");
});

test("GET /callback routes the customer through verification without self-certifying", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());
  const order = await seedVerifyFixture(repos);

  const response = await fetch(
    `${ctx.baseUrl}/callback?orderId=${order.id}&reference=stf_whatever`,
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(response.headers.get("content-type") ?? "", /text\/html/);
  assert.ok(html.includes("Payment received"));
  assert.ok(html.includes(order.id));

  const persisted = await repos.payments.readLatestById(order.id);
  assert.equal(persisted?.status, "SUCCESS");
});

test("GET /callback without an orderId returns 400", async (t) => {
  const ctx = await startServer();
  t.after(() => ctx.close());

  const response = await fetch(`${ctx.baseUrl}/callback`);
  assert.equal(response.status, 400);
  const html = await response.text();
  assert.ok(html.includes("Missing order"));
});
