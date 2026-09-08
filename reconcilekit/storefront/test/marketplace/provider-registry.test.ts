import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  AirtimeProvider,
  ProviderRequestContext,
} from "../../src/marketplace/providers/contracts.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type { MarketplaceServiceKind } from "../../src/marketplace/types.ts";

function context(kind: MarketplaceServiceKind): ProviderRequestContext {
  return {
    transactionId: `txn_${kind.toLowerCase()}`,
    customerId: "cus_demo",
    serviceId: `svc_${kind.toLowerCase()}`,
    providerId: "mock_registry_provider",
    providerName: "Mock Registry Provider",
    requestId: `req_${kind.toLowerCase()}`,
    correlationId: `corr_${kind.toLowerCase()}`,
    attemptNumber: 1,
    customerReference: `cust_${kind.toLowerCase()}`,
    idempotencyKey: `idem_${kind.toLowerCase()}`,
    requestedAt: "2026-01-01T12:00:00.000Z",
    scenario: "SUCCESS",
    amountMinor: 1_000_00,
    currency: "NGN",
    metadata: {},
  };
}

test("registry exposes every non-gated service kind through provider interfaces", () => {
  const registry = createMockProviderRegistry();
  const serviceKinds: readonly MarketplaceServiceKind[] = [
    "AIRTIME",
    "DATA",
    "ELECTRICITY",
    "CABLE_TV",
    "INTERNET",
    "EDUCATION",
    "GIFT_CARD",
    "DIGITAL_VOUCHER",
    "CINEMA_TICKET",
    "EVENT_TICKET",
    "BUS_TICKET",
    "AIRLINE_TICKET",
    "WALLET_FUNDING",
  ];

  for (const kind of serviceKinds) {
    const provider = registry.providerForServiceKind(kind);
    assert.equal(provider.mode, "MOCK");
    assert.equal(provider.serviceKinds.includes(kind), true);
  }
});

test("registry keeps marketplace use cases dependent on contracts, not concrete mocks", async () => {
  const registry = createMockProviderRegistry();
  const provider: AirtimeProvider = registry.airtime;

  const result = await provider.execute(context("AIRTIME"), {
    recipient: "08030000000",
    network: "MTN",
    productCode: "AIRTIME_1000",
    amountMinor: 1_000_00,
    currency: "NGN",
  });

  assert.equal(result.providerName, "Mock VTU Provider");
  assert.equal(result.serviceKind, "AIRTIME");
  assert.equal(result.simulated, true);
});

test("registry refuses compliance-gated betting provider", () => {
  const registry = createMockProviderRegistry();

  assert.throws(
    () => registry.providerForServiceKind("BETTING"),
    /compliance-gated/,
  );
});
