import { test } from "node:test";
import assert from "node:assert/strict";
import { VtpassClient } from "../../../src/vtpass/client.ts";
import { VtpassServiceAdapter } from "../../../src/vtpass/adapter.ts";
import { VtpassUnsupportedServiceError } from "../../../src/vtpass/errors.ts";
import type {
  AirtimeProviderRequest,
  ProviderRequestContext,
} from "../../../src/marketplace/providers/contracts.ts";

function makeContext(serviceId = "svc_airtime_mtn"): ProviderRequestContext {
  return {
    transactionId: "txn_1",
    customerId: "cus_1",
    serviceId,
    providerId: "vtpass",
    providerName: "VTPass",
    requestId: "req_1",
    correlationId: "corr_1",
    attemptNumber: 1,
    customerReference: "cust_ref_1",
    idempotencyKey: "idem_1",
    requestedAt: new Date(Date.now() - 100).toISOString(),
    amountMinor: 10000,
    currency: "NGN",
    metadata: {},
  };
}

function makeRequest(): AirtimeProviderRequest {
  return {
    amountMinor: 10000,
    currency: "NGN",
    recipient: "08011111111",
    network: "MTN",
    productCode: "mtn",
  };
}

function stubFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
}

function makeAdapter(fetchImpl: typeof fetch) {
  const client = new VtpassClient({ apiKey: "k", secretKey: "s", fetchImpl });
  return new VtpassServiceAdapter<AirtimeProviderRequest>(client, {
    kind: "AIRTIME" as const,
    extractBillersCode: (r) => r.recipient,
    extractPhone: (r) => r.recipient,
  });
}

function okBody(innerStatus: string, amount = 100) {
  return {
    code: "000",
    content: {
      transactions: {
        status: innerStatus,
        transactionId: "vt_tx_1",
        product_name: "MTN Airtime",
        unique_element: "08011111111",
        unit_price: "100",
        quantity: 1,
      },
    },
    response_description: "ok",
    requestId: "req_1",
    amount,
  };
}

test("VtpassServiceAdapter.execute: 000+delivered → SUCCESS", async () => {
  const adapter = makeAdapter(stubFetch(okBody("delivered")));
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_SUCCESS");
  assert.equal(result.attemptStatus, "SUCCESS");
  assert.equal(result.canonicalPaymentStatus, "SUCCESS");
  assert.equal(result.simulated, false);
  assert.equal(result.providerReference, "vt_tx_1");
});

test("VtpassServiceAdapter.execute: 099 → PENDING", async () => {
  const adapter = makeAdapter(
    stubFetch({
      code: "099",
      content: null,
      response_description: "processing",
      requestId: "req_1",
    }),
  );
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_PENDING");
  assert.equal(result.attemptStatus, "PENDING");
});

test("VtpassServiceAdapter.execute: 016 → FAILED", async () => {
  const adapter = makeAdapter(
    stubFetch({
      code: "016",
      content: null,
      response_description: "failed",
      requestId: "req_1",
    }),
  );
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_FAILED");
  assert.equal(result.attemptStatus, "FAILED");
});

test("VtpassServiceAdapter.execute: 040 → PROVIDER_REVERSED + FAILED attempt", async () => {
  const adapter = makeAdapter(
    stubFetch({
      code: "040",
      content: null,
      response_description: "reversed",
      requestId: "req_1",
    }),
  );
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_REVERSED");
  assert.equal(result.attemptStatus, "FAILED");
  assert.equal(result.canonicalPaymentStatus, "FAILED");
});

test("VtpassServiceAdapter.execute: 014 → PROVIDER_DUPLICATE", async () => {
  const adapter = makeAdapter(
    stubFetch({
      code: "014",
      content: null,
      response_description: "duplicate",
      requestId: "req_1",
    }),
  );
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_DUPLICATE");
  assert.equal(result.attemptStatus, "DUPLICATE");
});

test("VtpassServiceAdapter.execute: 000+failed → PROVIDER_FAILED (code 000 ≠ success)", async () => {
  const adapter = makeAdapter(stubFetch(okBody("failed")));
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.providerStatus, "PROVIDER_FAILED");
  assert.equal(result.attemptStatus, "FAILED");
});

test("VtpassServiceAdapter.execute: unsupported service throws", async () => {
  const adapter = makeAdapter(stubFetch(okBody("delivered")));
  await assert.rejects(
    () => adapter.execute(makeContext("svc_cinema_filmhouse"), makeRequest()),
    (err: unknown) => {
      assert.ok(err instanceof VtpassUnsupportedServiceError);
      assert.equal(err.catalogServiceId, "svc_cinema_filmhouse");
      return true;
    },
  );
});

test("VtpassServiceAdapter.execute: naira→kobo conversion", async () => {
  const adapter = makeAdapter(stubFetch(okBody("delivered", 100)));
  const result = await adapter.execute(makeContext(), makeRequest());
  assert.equal(result.amountMinor, 10000);
  assert.equal(result.reconciliationFacts?.amountMinor, 10000);
});

test("VtpassServiceAdapter.queryStatus: unsupported service throws", async () => {
  const adapter = makeAdapter(stubFetch(okBody("delivered")));
  await assert.rejects(
    () => adapter.queryStatus(makeContext("svc_giftcard_amazon")),
    (err: unknown) => {
      assert.ok(err instanceof VtpassUnsupportedServiceError);
      return true;
    },
  );
});
