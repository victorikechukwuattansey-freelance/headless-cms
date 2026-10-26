import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createMockProviderRegistry,
  createProviderRegistry,
} from "../../../src/marketplace/providers/registry.ts";

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

test("registry: REAL mode throws with a deferral message", () => {
  assert.throws(
    () => createProviderRegistry("REAL"),
    /REAL provider mode not yet implemented/,
  );
});

test("registry: createMockProviderRegistry remains a working alias for MOCK", () => {
  const viaAlias = createMockProviderRegistry();
  const viaMode = createProviderRegistry("MOCK");
  assert.equal(viaAlias.airtime.providerId, viaMode.airtime.providerId);
  assert.equal(viaAlias.payment.providerId, viaMode.payment.providerId);
  assert.equal(viaAlias.airtime.mode, "MOCK");
});
