import { test } from "node:test";
import assert from "node:assert/strict";
import { VtpassClient } from "../../../src/vtpass/client.ts";
import { VtpassClientError } from "../../../src/vtpass/errors.ts";
import { resolveVtpassServiceId } from "../../../src/vtpass/service-map.ts";

function fakeFetch(status: number, body: unknown) {
  return (async (_url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

test("VtpassClient.pay posts to /pay with correct headers", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const stubFetch = (async (url: string, init?: RequestInit) => {
    capturedUrl = url;
    capturedInit = init;
    return new Response(
      JSON.stringify({
        code: "000",
        content: { transactions: { status: "delivered" } },
        response_description: "ok",
        requestId: "r1",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;

  const client = new VtpassClient({
    apiKey: "k",
    secretKey: "s",
    fetchImpl: stubFetch,
  });
  const result = await client.pay({
    request_id: "r1",
    serviceID: "mtn",
    billersCode: "08011111111",
    amount: 100,
  });

  assert.equal(capturedUrl, "https://sandbox.vtpass.com/api/pay");
  const headers = capturedInit!.headers as Record<string, string>;
  assert.equal(headers["api-key"], "k");
  assert.equal(headers["secret-key"], "s");
  assert.equal(result.code, "000");
});

test("VtpassClient.pay throws on 401", async () => {
  const client = new VtpassClient({
    apiKey: "k",
    secretKey: "s",
    fetchImpl: fakeFetch(401, { code: "999", response_description: "unauth" }),
  });
  await assert.rejects(
    () =>
      client.pay({
        request_id: "r1",
        serviceID: "mtn",
        billersCode: "08011111111",
        amount: 100,
      }),
    (err: unknown) => {
      assert.ok(err instanceof VtpassClientError);
      assert.equal(err.code, "VTPASS_CLIENT_HTTP_UNAUTHORIZED");
      return true;
    },
  );
});

test("service-map resolves 11 services, returns null for unsupported", () => {
  assert.equal(resolveVtpassServiceId("svc_airtime_mtn"), "mtn");
  assert.equal(resolveVtpassServiceId("svc_education_waec"), "waec");
  assert.equal(resolveVtpassServiceId("svc_cinema_filmhouse"), null);
  assert.equal(resolveVtpassServiceId("svc_giftcard_amazon"), null);
});

test("VtpassClient sends Basic auth header when email and password are configured", async () => {
  let capturedAuth = "";
  const stubFetch = (async (_url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    capturedAuth = headers["authorization"] ?? "";
    return new Response(JSON.stringify({ code: "000" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const client = new VtpassClient({
    apiKey: "k",
    secretKey: "s",
    email: "e@test.com",
    password: "pwd",
    fetchImpl: stubFetch,
  });
  await client.pay({
    request_id: "r1",
    serviceID: "mtn",
    billersCode: "080",
    amount: 100,
  });

  assert.equal(
    capturedAuth,
    "Basic " + Buffer.from("e@test.com:pwd").toString("base64"),
  );
});
