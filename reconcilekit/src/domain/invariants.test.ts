import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcile } from "./reconcile.ts";
import { DEFAULT_CONFIG, merchant, provider } from "./fixtures.ts";

test("identical inputs and configuration produce identical reports", () => {
  const m1 = merchant({ amount: 20000, merchant_record_id: "M-1" });
  const p1 = provider({ amount: 21000, provider_id: "P-1" });
  const first = reconcile([m1], [p1], DEFAULT_CONFIG);
  const second = reconcile([m1], [p1], DEFAULT_CONFIG);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});

test("duplicate candidates are never arbitrarily paired", () => {
  const m = merchant({ merchant_record_id: "M-1" });
  const p1 = provider({ provider_id: "P-1" });
  const p2 = provider({ provider_id: "P-2" });
  const report = reconcile([m], [p1, p2], DEFAULT_CONFIG);
  const held = report.results.filter(
    (result) => result.outcome === "HELD_AMBIGUOUS",
  );
  assert.equal(held.length, 3);
  for (const result of held) {
    assert.equal(
      result.merchant_record === null || result.provider_record === null,
      true,
    );
  }
});

test("monetary comparison uses integer values only", () => {
  const within = reconcile(
    [merchant({ amount: 45000 })],
    [provider({ amount: 45000 })],
    DEFAULT_CONFIG,
  );
  assert.equal(within.results[0].outcome, "MATCH");
  const mismatch = reconcile(
    [merchant({ amount: 45000, merchant_record_id: "M-2" })],
    [provider({ amount: 45000 + 1, provider_id: "P-2" })],
    DEFAULT_CONFIG,
  );
  assert.deepEqual(mismatch.results[0].discrepancy_codes, ["AMOUNT_MISMATCH"]);
  const fractional = reconcile(
    [merchant({ amount: 45000.5, merchant_record_id: "M-3" })],
    [provider({ amount: 45000, provider_id: "P-3" })],
    DEFAULT_CONFIG,
  );
  assert.equal(fractional.results[0].outcome, "INPUT_ERROR");
});

test("multiple simultaneous discrepancies are all preserved", () => {
  const report = reconcile(
    [merchant({ amount: 20000, currency: "NGN", status: "SUCCESS" })],
    [
      provider({
        amount: 21000,
        currency: "USD",
        status: "FAILED",
        occurred_at: 1_700_000_300_000,
      }),
    ],
    DEFAULT_CONFIG,
  );
  assert.equal(report.results[0].discrepancy_codes.length, 4);
});

test("missing status is distinguished from unknown status", () => {
  const missing = reconcile(
    [merchant({ status: null, merchant_record_id: "M-1" })],
    [provider({ provider_id: "P-1" })],
    DEFAULT_CONFIG,
  );
  assert.equal(missing.results[0].outcome, "MATCH");
  assert.deepEqual(missing.results[0].discrepancy_codes, []);
  const unknown = reconcile(
    [merchant({ status: "UNKNOWN", merchant_record_id: "M-2" })],
    [provider({ status: "SUCCESS", provider_id: "P-2" })],
    DEFAULT_CONFIG,
  );
  assert.equal(unknown.results[0].outcome, "UNRESOLVED");
  assert.deepEqual(unknown.results[0].discrepancy_codes, ["STATUS_UNRESOLVED"]);
});

test("input error takes precedence over missing-reference classification", () => {
  const report = reconcile(
    [
      merchant({
        merchant_reference: null,
        currency: "USD",
        merchant_record_id: "M-1",
      }),
    ],
    [],
    {
      timestampValidation: { enabled: true, toleranceMs: 60_000 },
      supportedCurrencies: ["NGN"],
    },
  );
  const result = report.results[0];
  assert.equal(result.outcome, "INPUT_ERROR");
  assert.notEqual(result.outcome, "MISSING_REFERENCE");
});

test("empty inputs produce an empty deterministic report", () => {
  const report = reconcile([], [], DEFAULT_CONFIG);
  assert.deepEqual(report.results, []);
  assert.equal(report.summary.totalRecords, 0);
  assert.equal(report.summary.matched, 0);
  assert.equal(report.summary.discrepancies, 0);
  assert.equal(report.summary.unresolved, 0);
  assert.equal(report.summary.heldAmbiguous, 0);
  assert.equal(report.summary.inputErrors, 0);
  assert.equal(report.summary.missingProviderRecords, 0);
  assert.equal(report.summary.unmatchedProviderRecords, 0);
  assert.equal(report.summary.missingReference, 0);
});

test("invalid timestamp tolerance configuration is rejected", () => {
  assert.throws(
    () =>
      reconcile([], [], {
        timestampValidation: { enabled: true, toleranceMs: -1 },
        supportedCurrencies: ["NGN"],
      }),
    /tolerance/,
  );
  assert.throws(
    () =>
      reconcile([], [], {
        timestampValidation: { enabled: true, toleranceMs: Number.NaN },
        supportedCurrencies: ["NGN"],
      }),
    /tolerance/,
  );
});

test("disabled timestamp validation requires no tolerance", () => {
  const report = reconcile([], [], {
    timestampValidation: { enabled: false },
    supportedCurrencies: ["NGN"],
  });
  assert.equal(report.summary.totalRecords, 0);
});
