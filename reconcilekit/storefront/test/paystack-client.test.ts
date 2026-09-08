import { test } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTransaction,
  verifyTransaction,
  PaystackClientError,
} from "../src/paystack/client.ts";

const SECRET = "sk_test_abc123";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("initializeTransaction posts the expected request and parses the result", async (t) => {
  const calls: Array<{ input: string | Request | URL; init: RequestInit }> = [];
  const fetchImpl = async (
    input: string | Request | URL,
    init?: RequestInit,
  ) => {
    calls.push({ input, init: init ?? {} });
    return jsonResponse({
      status: true,
      message: "Authorization URL created",
      data: {
        authorization_url: "https://checkout.paystack.com/abc123",
        access_code: "abc123",
        reference: "stf_req123",
      },
    });
  };

  const result = await initializeTransaction(
    { secretKey: SECRET, baseUrl: "https://api.paystack.test", fetchImpl },
    {
      email: "customer@example.com",
      amount: 5000,
      currency: "NGN",
      reference: "stf_req123",
      callbackUrl: "http://localhost:8787/callback?orderId=o-1",
      metadata: { business_id: "b-1", order_id: "o-1" },
    },
  );

  assert.equal(result.authorizationUrl, "https://checkout.paystack.com/abc123");
  assert.equal(result.accessCode, "abc123");
  assert.equal(result.reference, "stf_req123");

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.equal(
    String(call.input),
    "https://api.paystack.test/transaction/initialize",
  );
  assert.equal(call.init.method, "POST");
  const headers = call.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(headers["Content-Type"], "application/json");
  const sent = JSON.parse(String(call.init.body)) as Record<string, unknown>;
  assert.equal(sent.email, "customer@example.com");
  assert.equal(sent.amount, 5000);
  assert.equal(sent.currency, "NGN");
  assert.equal(sent.reference, "stf_req123");
  assert.equal(sent.callback_url, "http://localhost:8787/callback?orderId=o-1");
  assert.deepEqual(sent.metadata, { business_id: "b-1", order_id: "o-1" });
});

test("initializeTransaction rejects an API-rejected envelope", async () => {
  await assert.rejects(
    initializeTransaction(
      {
        secretKey: SECRET,
        fetchImpl: async () =>
          jsonResponse({
            status: false,
            message: "Invalid amount",
            data: null,
          }),
      },
      { email: "a@b.com", amount: 0, currency: "NGN", reference: "r" },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_API_REJECTED" &&
      error.message.includes("Invalid amount"),
  );
});

test("initializeTransaction classifies HTTP 401 as unauthorized", async () => {
  await assert.rejects(
    initializeTransaction(
      {
        secretKey: SECRET,
        fetchImpl: async () => jsonResponse({ status: false }, 401),
      },
      { email: "a@b.com", amount: 100, currency: "NGN", reference: "r" },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_HTTP_UNAUTHORIZED" &&
      error.statusCode === 401,
  );
});

test("initializeTransaction classifies network failure", async () => {
  await assert.rejects(
    initializeTransaction(
      {
        secretKey: SECRET,
        fetchImpl: async () => {
          throw new Error("connection refused");
        },
      },
      { email: "a@b.com", amount: 100, currency: "NGN", reference: "r" },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_NETWORK_FAILURE",
  );
});

test("initializeTransaction rejects a response missing authorization_url", async () => {
  await assert.rejects(
    initializeTransaction(
      {
        secretKey: SECRET,
        fetchImpl: async () =>
          jsonResponse({ status: true, data: { reference: "r" } }),
      },
      { email: "a@b.com", amount: 100, currency: "NGN", reference: "r" },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_MALFORMED_RESPONSE",
  );
});

test("verifyTransaction maps success through the canonical adapter mapping", async () => {
  const fetchImpl = async (
    input: string | Request | URL,
    init?: RequestInit,
  ) => {
    assert.equal(init?.method, "GET");
    assert.ok(String(input).endsWith("/transaction/verify/stf_abc"));
    const headers = (init?.headers ?? {}) as Record<string, string>;
    assert.equal(headers.Authorization, `Bearer ${SECRET}`);
    return jsonResponse({
      status: true,
      message: "Verification successful",
      data: {
        id: 12345,
        reference: "stf_abc",
        amount: 5000,
        currency: "NGN",
        status: "success",
        paid_at: "2026-08-18T10:00:00.000Z",
      },
    });
  };

  const mapped = await verifyTransaction(
    { secretKey: SECRET, baseUrl: "https://api.paystack.test", fetchImpl },
    {
      reference: "stf_abc",
      supportedCurrencies: ["NGN"],
      timestampField: "paid_at",
    },
  );

  assert.equal(mapped.payment.reference, "stf_abc");
  assert.equal(mapped.payment.amount, 5000);
  assert.equal(mapped.payment.currency, "NGN");
  assert.equal(mapped.payment.status, "SUCCESS");
  assert.equal(mapped.payment.provider_id, "12345");
  assert.equal(mapped.source_attributes.original_status, "success");
  assert.equal(
    mapped.payment.occurred_at,
    Date.parse("2026-08-18T10:00:00.000Z"),
  );
});

test("verifyTransaction maps abandoned to UNKNOWN, never CANCELLED", async () => {
  const fetchImpl = async () =>
    jsonResponse({
      status: true,
      data: {
        reference: "stf_x",
        amount: 100,
        currency: "NGN",
        status: "abandoned",
      },
    });

  const mapped = await verifyTransaction(
    { secretKey: SECRET, fetchImpl },
    {
      reference: "stf_x",
      supportedCurrencies: ["NGN"],
      timestampField: "paid_at",
    },
  );
  assert.equal(mapped.payment.status, "UNKNOWN");
});

test("verifyTransaction maps a currency outside the allowlist instead of failing", async () => {
  const fetchImpl = async () =>
    jsonResponse({
      status: true,
      data: {
        reference: "stf_x",
        amount: 100,
        currency: "GHS",
        status: "success",
      },
    });

  const mapped = await verifyTransaction(
    { secretKey: SECRET, fetchImpl },
    { reference: "stf_x", supportedCurrencies: ["NGN"] },
  );
  assert.equal(mapped.payment.currency, "GHS");
  assert.equal(mapped.payment.status, "SUCCESS");
});

test("verifyTransaction defaults timestamp field to paid_at", async () => {
  const fetchImpl = async () =>
    jsonResponse({
      status: true,
      data: {
        reference: "stf_x",
        amount: 100,
        currency: "NGN",
        status: "success",
        created_at: "2026-08-18T09:00:00.000Z",
        paid_at: "2026-08-18T10:00:00.000Z",
      },
    });

  const mapped = await verifyTransaction(
    { secretKey: SECRET, fetchImpl },
    { reference: "stf_x", supportedCurrencies: ["NGN"] },
  );
  assert.equal(
    mapped.payment.occurred_at,
    Date.parse("2026-08-18T10:00:00.000Z"),
  );
});

test("verifyTransaction classifies HTTP 404", async () => {
  await assert.rejects(
    verifyTransaction(
      {
        secretKey: SECRET,
        fetchImpl: async () => jsonResponse({ status: false }, 404),
      },
      {
        reference: "stf_missing",
        supportedCurrencies: ["NGN"],
        timestampField: "paid_at",
      },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_HTTP_NOT_FOUND",
  );
});

test("client rejects an empty secret key", async () => {
  await assert.rejects(
    initializeTransaction(
      { secretKey: "   " },
      { email: "a@b.com", amount: 1, currency: "NGN", reference: "r" },
    ),
    (error: unknown) =>
      error instanceof PaystackClientError &&
      error.code === "PAYSTACK_CLIENT_INVALID_OPTION",
  );
});
