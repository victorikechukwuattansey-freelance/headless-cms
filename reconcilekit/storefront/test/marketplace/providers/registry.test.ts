import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMockProviderRegistry,
  createProviderRegistry,
} from "../../../src/marketplace/providers/registry.ts";
import { VtpassClient } from "../../../src/vtpass/client.ts";

test("registry: MOCK mode returns a fully populated provider registry", () => {
  const registry = createProviderRegistry("MOCK");
  assert.ok(registry.airtime);
  assert.ok(registry.data);
  assert.ok(registry.payment);
  assert.ok(registry.cinema);
  assert.equal(registry.airtime.mode, "MOCK");
  assert.equal(registry.payment.mode, "MOCK");
  assert.equal(
    registry.providerForServiceKind("AIRTIME").providerId,
    "mock_vtu_provider",
  );
});

test("registry: REAL mode without VtpassClient throws credentials error", () => {
  assert.throws(
    () => createProviderRegistry("REAL"),
    /REAL provider mode requires VTPass credentials/,
  );
});

test("registry: REAL mode with VtpassClient returns VTPass registry", () => {
  const stubFetch = (async () =>
    new Response(
      JSON.stringify({
        code: "000",
        content: { transactions: { status: "delivered" } },
        response_description: "ok",
        requestId: "r1",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
  const client = new VtpassClient({
    apiKey: "k",
    secretKey: "s",
    fetchImpl: stubFetch,
  });
  const registry = createProviderRegistry("REAL", client);
  assert.equal(registry.providerForServiceKind("AIRTIME").providerId, "vtpass");
  assert.equal(registry.providerForServiceKind("DATA").providerId, "vtpass");
  assert.throws(() => registry.providerForServiceKind("BETTING"));
});

test("registry: createMockProviderRegistry remains a working alias for MOCK", () => {
  const viaAlias = createMockProviderRegistry();
  const viaMode = createProviderRegistry("MOCK");
  assert.equal(viaAlias.airtime.providerId, viaMode.airtime.providerId);
  assert.equal(viaAlias.payment.providerId, viaMode.payment.providerId);
  assert.equal(viaAlias.airtime.mode, "MOCK");
});
