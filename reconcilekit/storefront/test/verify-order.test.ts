import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyOrder } from "../src/application/verify-order.ts";
import type { VerifyOrderResult } from "../src/application/verify-order.ts";
import type { PaystackGateway } from "../src/paystack/gateway.ts";
import { PaystackClientError } from "../src/paystack/client.ts";
import type { PaystackMappedTransaction } from "../../src/adapters/providers/paystack/paystack.ts";
import type { Order, PaymentRecord, Product } from "../src/domain/types.ts";
import { getPrismaClient } from "../src/db/client.ts";
import { buildRepositories } from "../src/db/repositories/index.ts";
import type { Repositories } from "../src/db/repositories/index.ts";
import { withRollback } from "./db/helpers.ts";

const prisma = getPrismaClient();

const REF = "stf_abc";
const ORDER_ID = "o-1";
const BUSINESS_ID = "b-1";
const EXPECTED_AMOUNT = 3000;
const CURRENCY = "NGN";
const PAID_AT = "2026-08-18T10:00:00.000Z";

interface Fixture {
  order: Order;
  product: Product;
}

function isoAt(epoch: number): string {
  return new Date(epoch).toISOString();
}

async function seedOrder(
  repos: Repositories,
  options?: {
    readonly reference?: string | null;
    readonly orderStatus?: Order["status"];
    readonly expectedAmount?: number;
    readonly currency?: string;
    readonly paymentStatus?: PaymentRecord["status"];
  },
): Promise<Fixture> {
  const orderReference =
    options?.reference === undefined ? REF : options.reference;
  const order: Order = {
    id: ORDER_ID,
    businessId: BUSINESS_ID,
    productId: "p-1",
    customerEmail: "customer@example.com",
    expectedAmountMinor: options?.expectedAmount ?? EXPECTED_AMOUNT,
    currency: options?.currency ?? CURRENCY,
    status: options?.orderStatus ?? "PAYMENT_INITIATED",
    paystackReference: orderReference,
    authorizationUrl: "https://checkout.paystack.com/x",
    createdAt: isoAt(0),
  };
  const product: Product = {
    id: "p-1",
    businessId: BUSINESS_ID,
    name: "Coffee",
    priceMinor: options?.expectedAmount ?? EXPECTED_AMOUNT,
    currency: options?.currency ?? CURRENCY,
    createdAt: isoAt(0),
  };
  await repos.businesses.insert({
    id: BUSINESS_ID,
    name: "Biz",
    createdAt: isoAt(0),
  });
  await repos.products.insert(product);
  await repos.orders.insert(order);
  if (orderReference !== null) {
    const payment: PaymentRecord = {
      id: order.id,
      businessId: BUSINESS_ID,
      orderId: order.id,
      expectedAmount: order.expectedAmountMinor,
      currency: order.currency,
      paystackReference: orderReference,
      status: options?.paymentStatus ?? "PENDING",
      paidAt: null,
      refundStatus: "NONE",
      metadata: { requested_reference: orderReference },
      recordedAt: isoAt(0),
    };
    await repos.payments.insert(payment);
  }
  return { order, product };
}

function mapped(
  partial?: Partial<PaystackMappedTransaction["payment"]>,
): PaystackMappedTransaction {
  return {
    payment: {
      reference: REF,
      amount: EXPECTED_AMOUNT,
      currency: CURRENCY,
      status: "SUCCESS",
      occurred_at: Date.parse(PAID_AT),
      provider_id: "t-1",
      ...partial,
    },
    source_attributes: { original_status: "success" },
  };
}

function gatewayWith(
  verify: PaystackGateway["verifyTransaction"],
): PaystackGateway {
  return {
    initializeTransaction: async () => {
      throw new Error("initialize should not be called");
    },
    verifyTransaction: verify,
  };
}

async function paymentCount(repos: Repositories): Promise<number> {
  const payments = await repos.payments.list();
  return payments.filter((record) => record.orderId === ORDER_ID).length;
}

test("PENDING → SUCCESS: records SUCCESS with the Paystack paid_at timestamp", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const { order } = await seedOrder(repos);
    const gateway = gatewayWith(async (input) => {
      assert.equal(input.reference, REF);
      assert.deepEqual(input.supportedCurrencies, [CURRENCY]);
      return mapped();
    });

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;

    assert.equal(result.changed, true);
    assert.equal(result.payment.status, "SUCCESS");
    assert.equal(result.payment.paidAt, PAID_AT);
    assert.equal(result.payment.refundStatus, "NONE");
    assert.equal(result.payment.expectedAmount, order.expectedAmountMinor);
    assert.equal(result.payment.paystackReference, REF);
    assert.equal(result.payment.metadata.integrity, "OK");
    assert.equal(result.payment.metadata.paystack_canonical_status, "SUCCESS");
    assert.ok(result.payment.metadata.verified_at);

    const persisted = await repos.payments.readLatestById(ORDER_ID);
    assert.equal(persisted?.status, "SUCCESS");
    assert.equal(persisted?.paidAt, PAID_AT);
  });
});

test("PENDING → FAILED: records FAILED with no payment timestamp", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ status: "FAILED", occurred_at: null }),
    );

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;
    assert.equal(result.changed, true);
    assert.equal(result.payment.status, "FAILED");
    assert.equal(result.payment.paidAt, null);
    assert.equal(result.payment.metadata.integrity, "OK");
  });
});

test("PENDING → PENDING: state is unchanged and nothing is appended", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ status: "PENDING", occurred_at: null }),
    );

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;
    assert.equal(result.changed, false);
    assert.equal(result.payment.status, "PENDING");
    assert.equal(await paymentCount(repos), 1);
  });
});

test("SUCCESS → SUCCESS: repeated verification is a safe no-op", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => mapped());

    const first = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(first.kind, "verified");
    if (first.kind !== "verified") return;
    assert.equal(first.changed, true);

    const second = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(second.kind, "verified");
    if (second.kind !== "verified") return;
    assert.equal(second.changed, false);
    assert.equal(second.payment.status, "SUCCESS");
    assert.equal(await paymentCount(repos), 1);
  });
});

test("repeated successful verification never creates contradictory records", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => mapped());

    await verifyOrder(repos, gateway, ORDER_ID);
    await verifyOrder(repos, gateway, ORDER_ID);
    await verifyOrder(repos, gateway, ORDER_ID);

    const all = (await repos.payments.list()).filter(
      (record) => record.orderId === ORDER_ID,
    );
    assert.equal(all.length, 1);
    const latest = all[all.length - 1];
    assert.equal(latest.status, "SUCCESS");
    assert.equal(latest.paidAt, PAID_AT);
    assert.equal(
      all.filter((record) => record.status === "SUCCESS").length,
      1,
      "no duplicate SUCCESS effects",
    );
  });
});

test("verifying a nonexistent order returns order_not_found", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const gateway = gatewayWith(async () => mapped());
    const result = await verifyOrder(repos, gateway, "no-such-order");
    assert.equal(result.kind, "order_not_found");
  });
});

test("verifying an order without a reference returns not_initialized", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos, {
      reference: null,
      orderStatus: "INITIALIZATION_FAILED",
    });
    const gateway = gatewayWith(async () => mapped());
    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "not_initialized");
  });
});

test("reference mismatch is a reference-integrity failure and nothing is recorded", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => mapped({ reference: "stf_EVIL" }));

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "reference_mismatch");

    const persisted = await repos.payments.readLatestById(ORDER_ID);
    assert.equal(persisted?.status, "PENDING");
    assert.equal(await paymentCount(repos), 1);
  });
});

test("amount mismatch blocks SUCCESS and records UNKNOWN with integrity metadata", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ amount: EXPECTED_AMOUNT + 1 }),
    );

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;
    assert.equal(result.changed, true);
    assert.equal(result.payment.status, "UNKNOWN");
    assert.equal(result.payment.paidAt, null);
    assert.equal(result.payment.metadata.integrity, "AMOUNT_MISMATCH");
    assert.equal(result.payment.metadata.paystack_canonical_status, "SUCCESS");
    assert.equal(
      result.payment.metadata.paystack_amount,
      String(EXPECTED_AMOUNT + 1),
    );
    assert.equal(result.payment.metadata.paystack_currency, CURRENCY);
  });
});

test("currency mismatch blocks SUCCESS and records UNKNOWN with integrity metadata", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => mapped({ currency: "GHS" }));

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;
    assert.equal(result.payment.status, "UNKNOWN");
    assert.equal(result.payment.metadata.integrity, "CURRENCY_MISMATCH");
  });
});

test("amount and currency mismatch together are both reported", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ amount: 1, currency: "GHS" }),
    );

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verified");
    if (result.kind !== "verified") return;
    assert.equal(result.payment.status, "UNKNOWN");
    assert.equal(
      result.payment.metadata.integrity,
      "AMOUNT_MISMATCH,CURRENCY_MISMATCH",
    );
  });
});

test("an integrity mismatch never flips back to SUCCESS on repeat", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ amount: EXPECTED_AMOUNT + 1 }),
    );

    await verifyOrder(repos, gateway, ORDER_ID);
    const second = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(second.kind, "verified");
    if (second.kind !== "verified") return;
    assert.equal(second.changed, false);
    assert.equal(second.payment.status, "UNKNOWN");
  });
});

test("malformed Paystack response leaves the effective record untouched", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => {
      throw new PaystackClientError(
        "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
        "not valid JSON",
      );
    });

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verify_failed");
    if (result.kind === "verify_failed") {
      assert.equal(result.causeCode, "PAYSTACK_CLIENT_MALFORMED_RESPONSE");
    }
    const persisted = await repos.payments.readLatestById(ORDER_ID);
    assert.equal(persisted?.status, "PENDING");
    assert.equal(await paymentCount(repos), 1);
  });
});

test("Paystack transport failure leaves the effective record untouched", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => {
      throw new PaystackClientError(
        "PAYSTACK_CLIENT_HTTP_UNAUTHORIZED",
        "HTTP 401",
        { statusCode: 401 },
      );
    });

    const result = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(result.kind, "verify_failed");
    if (result.kind === "verify_failed") {
      assert.equal(result.causeCode, "PAYSTACK_CLIENT_HTTP_UNAUTHORIZED");
    }
    const persisted = await repos.payments.readLatestById(ORDER_ID);
    assert.equal(persisted?.status, "PENDING");
  });
});

test("FAILED → SUCCESS later: later verified state wins", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () =>
      mapped({ status: "FAILED", occurred_at: null }),
    );

    const first = await verifyOrder(repos, gateway, ORDER_ID);
    assert.equal(first.kind, "verified");
    if (first.kind === "verified") assert.equal(first.payment.status, "FAILED");

    const successGateway = gatewayWith(async () => mapped());
    const second = await verifyOrder(repos, successGateway, ORDER_ID);
    assert.equal(second.kind, "verified");
    if (second.kind === "verified") {
      assert.equal(second.changed, true);
      assert.equal(second.payment.status, "SUCCESS");
    }
    const persisted = await repos.payments.readLatestById(ORDER_ID);
    assert.equal(persisted?.status, "SUCCESS");
    assert.equal(persisted?.paidAt, PAID_AT);
  });
});

test("unexpected gateway failures surface as verify_failed without a cause code", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrder(repos);
    const gateway = gatewayWith(async () => {
      throw new Error("mystery");
    });

    const result = (await verifyOrder(repos, gateway, ORDER_ID)) as Extract<
      VerifyOrderResult,
      { kind: "verify_failed" }
    >;
    assert.equal(result.kind, "verify_failed");
    assert.equal(result.causeCode, null);
  });
});
