import assert from "node:assert/strict";
import { test } from "node:test";
import { reconcile } from "./reconcile.ts";
import { DEFAULT_CONFIG, merchant, provider } from "./fixtures.ts";

test("1. Exact match", () => {
  const m = merchant();
  const p = provider();
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  assert.equal(report.results.length, 1);
  const result = report.results[0];
  assert.equal(result.outcome, "MATCH");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.equal(result.merchant_record, m);
  assert.equal(result.provider_record, p);
  assert.equal(report.summary.matched, 1);
  assert.equal(report.summary.totalRecords, 2);
});

test("2. Missing provider transaction", () => {
  const m = merchant({ merchant_record_id: "M-1" });
  const report = reconcile([m], [], DEFAULT_CONFIG);
  assert.equal(report.results.length, 1);
  const result = report.results[0];
  assert.equal(result.outcome, "MISSING_PROVIDER_RECORD");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.equal(result.provider_record, null);
  assert.equal(report.summary.missingProviderRecords, 1);
});

test("3. Missing merchant record", () => {
  const p = provider({ provider_id: "P-1" });
  const report = reconcile([], [p], DEFAULT_CONFIG);
  assert.equal(report.results.length, 1);
  const result = report.results[0];
  assert.equal(result.outcome, "UNMATCHED_PROVIDER_RECORD");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.equal(result.merchant_record, null);
  assert.equal(report.summary.unmatchedProviderRecords, 1);
});

test("4. Missing reference", () => {
  const m = merchant({ merchant_reference: null });
  const report = reconcile([m], [], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "MISSING_REFERENCE");
  assert.equal(report.summary.missingReference, 1);
  assert.ok(
    result.validation_notes.some((note) => note.includes("unusable reference")),
  );
});

test("5. Empty/whitespace reference", () => {
  const empty = merchant({ merchant_reference: "", merchant_record_id: "M-1" });
  const whitespace = merchant({
    merchant_reference: "   ",
    merchant_record_id: "M-2",
  });
  const report = reconcile([empty, whitespace], [], DEFAULT_CONFIG);
  assert.equal(report.results.length, 2);
  assert.deepEqual(
    report.results.map((result) => result.outcome),
    ["MISSING_REFERENCE", "MISSING_REFERENCE"],
  );
  assert.equal(report.summary.missingReference, 2);
});

test("6. Duplicate merchant reference", () => {
  const m1 = merchant({ merchant_record_id: "M-1" });
  const m2 = merchant({ merchant_record_id: "M-2" });
  const p = provider({ provider_id: "P-1" });
  const report = reconcile([m1, m2], [p], DEFAULT_CONFIG);
  assert.equal(report.results.length, 3);
  const merchantResults = report.results.slice(0, 2);
  for (const result of merchantResults) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.deepEqual(result.discrepancy_codes, ["DUPLICATE_MERCHANT_RECORD"]);
  }
  const providerResult = report.results[2];
  assert.equal(providerResult.outcome, "HELD_AMBIGUOUS");
  assert.equal(providerResult.merchant_record, null);
  assert.equal(report.summary.heldAmbiguous, 3);
  assert.equal(
    report.summary.countsByDiscrepancyCode.DUPLICATE_MERCHANT_RECORD,
    2,
  );
});

test("7. Duplicate provider reference", () => {
  const p1 = provider({ provider_id: "P-1" });
  const p2 = provider({ provider_id: "P-2" });
  const m = merchant({ merchant_record_id: "M-1" });
  const report = reconcile([m], [p1, p2], DEFAULT_CONFIG);
  assert.equal(report.results.length, 3);
  const merchantResult = report.results[0];
  assert.equal(merchantResult.outcome, "HELD_AMBIGUOUS");
  assert.equal(merchantResult.provider_record, null);
  assert.deepEqual(merchantResult.discrepancy_codes, []);
  for (const result of report.results.slice(1)) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.deepEqual(result.discrepancy_codes, ["DUPLICATE_PROVIDER_RECORD"]);
  }
  assert.equal(report.summary.heldAmbiguous, 3);
  assert.equal(
    report.summary.countsByDiscrepancyCode.DUPLICATE_PROVIDER_RECORD,
    2,
  );
});

test("8. Duplicate reference with conflicting attributes", () => {
  const m1 = merchant({ amount: 20000, merchant_record_id: "M-1" });
  const m2 = merchant({ amount: 25000, merchant_record_id: "M-2" });
  const p = provider({ amount: 20000, provider_id: "P-1" });
  const report = reconcile([m1, m2], [p], DEFAULT_CONFIG);
  const merchantResults = report.results.slice(0, 2);
  for (const result of merchantResults) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.deepEqual(result.discrepancy_codes, [
      "DUPLICATE_MERCHANT_RECORD",
      "CONFLICTING_ATTRIBUTES",
    ]);
  }
  const providerResult = report.results[2];
  assert.equal(providerResult.outcome, "HELD_AMBIGUOUS");
  assert.deepEqual(providerResult.discrepancy_codes, []);
  assert.equal(report.summary.heldAmbiguous, 3);
  assert.equal(
    report.summary.countsByDiscrepancyCode.CONFLICTING_ATTRIBUTES,
    2,
  );
});

test("9. Amount mismatch", () => {
  const m = merchant({ amount: 20000 });
  const p = provider({ amount: 15000 });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "DISCREPANCY");
  assert.deepEqual(result.discrepancy_codes, ["AMOUNT_MISMATCH"]);
  assert.equal(report.summary.discrepancies, 1);
  assert.ok(
    result.validation_notes.some((note) => note.includes("amount mismatch")),
  );
});

test("10. Currency mismatch", () => {
  const m = merchant({ currency: "NGN" });
  const p = provider({ currency: "USD" });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "DISCREPANCY");
  assert.deepEqual(result.discrepancy_codes, ["CURRENCY_MISMATCH"]);
  assert.ok(
    result.validation_notes.some((note) => note.includes("currency mismatch")),
  );
});

test("11. Status mismatch", () => {
  const m = merchant({ status: "SUCCESS" });
  const p = provider({ status: "FAILED" });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "DISCREPANCY");
  assert.deepEqual(result.discrepancy_codes, ["STATUS_MISMATCH"]);
  assert.ok(
    result.validation_notes.some((note) => note.includes("status mismatch")),
  );
});

test("12. Missing merchant status", () => {
  const m = merchant({ status: null });
  const p = provider({ status: "SUCCESS" });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "MATCH");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.ok(
    result.validation_notes.some(
      (note) =>
        note.includes("status validation unavailable") &&
        note.includes("merchant status absent"),
    ),
  );
});

test("13. Missing merchant timestamp", () => {
  const m = merchant({ occurred_at: null });
  const p = provider({ occurred_at: 1_700_000_000_000 });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "MATCH");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.ok(
    result.validation_notes.some(
      (note) =>
        note.includes("timestamp validation unavailable") &&
        note.includes("merchant occurred_at absent"),
    ),
  );
});

test("14. Timestamp within tolerance", () => {
  const m = merchant({ occurred_at: 1_700_000_000_000 });
  const p = provider({ occurred_at: 1_700_000_030_000 });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "MATCH");
  assert.deepEqual(result.discrepancy_codes, []);
});

test("15. Timestamp outside tolerance", () => {
  const m = merchant({ occurred_at: 1_700_000_000_000 });
  const p = provider({ occurred_at: 1_700_000_090_000 });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "DISCREPANCY");
  assert.deepEqual(result.discrepancy_codes, ["TEMPORAL_ANOMALY"]);
  assert.equal(report.summary.discrepancies, 1);
  assert.ok(
    result.validation_notes.some((note) => note.includes("temporal anomaly")),
  );
});

test("16. Multiple simultaneous discrepancies", () => {
  const m = merchant({ amount: 20000, currency: "NGN", status: "SUCCESS" });
  const p = provider({
    amount: 21000,
    currency: "USD",
    status: "FAILED",
    occurred_at: 1_700_000_300_000,
  });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "DISCREPANCY");
  assert.deepEqual(result.discrepancy_codes, [
    "AMOUNT_MISMATCH",
    "CURRENCY_MISMATCH",
    "STATUS_MISMATCH",
    "TEMPORAL_ANOMALY",
  ]);
  assert.equal(report.summary.discrepancies, 1);
});

test("17. Same reference with conflicting attributes", () => {
  const p1 = provider({ amount: 5000, provider_id: "P-1" });
  const p2 = provider({ amount: 7000, provider_id: "P-2" });
  const m = merchant({ amount: 5000, merchant_record_id: "M-1" });
  const report = reconcile([m], [p1, p2], DEFAULT_CONFIG);
  const merchantResult = report.results[0];
  assert.equal(merchantResult.outcome, "HELD_AMBIGUOUS");
  assert.equal(merchantResult.provider_record, null);
  for (const result of report.results.slice(1)) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.deepEqual(result.discrepancy_codes, [
      "DUPLICATE_PROVIDER_RECORD",
      "CONFLICTING_ATTRIBUTES",
    ]);
  }
  assert.equal(report.summary.heldAmbiguous, 3);
  assert.equal(
    report.summary.countsByDiscrepancyCode.CONFLICTING_ATTRIBUTES,
    2,
  );
});

test("18. Unknown status mapping", () => {
  const m = merchant({ status: "UNKNOWN" });
  const p = provider({ status: "SUCCESS" });
  const report = reconcile([m], [p], DEFAULT_CONFIG);
  const result = report.results[0];
  assert.equal(result.outcome, "UNRESOLVED");
  assert.deepEqual(result.discrepancy_codes, ["STATUS_UNRESOLVED"]);
  assert.equal(report.summary.unresolved, 1);

  const bothUnknownM = merchant({
    status: "UNKNOWN",
    merchant_record_id: "M-2",
  });
  const bothUnknownP = provider({ status: "UNKNOWN", provider_id: "P-2" });
  const second = reconcile([bothUnknownM], [bothUnknownP], DEFAULT_CONFIG);
  const secondResult = second.results[0];
  assert.equal(secondResult.outcome, "UNRESOLVED");
  assert.deepEqual(secondResult.discrepancy_codes, ["STATUS_UNRESOLVED"]);
});

test("19. Unsupported/invalid currency", () => {
  const config = {
    timestampValidation: { enabled: true, toleranceMs: 60_000 },
    supportedCurrencies: ["NGN"],
  };
  const m = merchant({ currency: "USD", merchant_record_id: "M-1" });
  const p = provider({ provider_id: "P-1" });
  const report = reconcile([m], [p], config);
  const merchantResult = report.results[0];
  assert.equal(merchantResult.outcome, "INPUT_ERROR");
  assert.deepEqual(merchantResult.discrepancy_codes, []);
  assert.ok(
    merchantResult.validation_notes.some((note) =>
      note.includes("unsupported or invalid currency"),
    ),
  );
  assert.equal(report.summary.inputErrors, 1);
  const providerResult = report.results[1];
  assert.equal(providerResult.outcome, "UNMATCHED_PROVIDER_RECORD");

  const invalidWithMissingReference = merchant({
    merchant_reference: null,
    currency: "USD",
    merchant_record_id: "M-2",
  });
  const precedence = reconcile([invalidWithMissingReference], [], config);
  assert.equal(precedence.results[0].outcome, "INPUT_ERROR");
});

test("20. Multiple provider candidates for one merchant reference", () => {
  const p1 = provider({ provider_id: "P-1" });
  const p2 = provider({ provider_id: "P-2" });
  const m = merchant({ merchant_record_id: "M-1" });
  const report = reconcile([m], [p1, p2], DEFAULT_CONFIG);
  const merchantResult = report.results[0];
  assert.equal(merchantResult.outcome, "HELD_AMBIGUOUS");
  assert.equal(merchantResult.provider_record, null);
  assert.ok(
    merchantResult.validation_notes.some((note) =>
      note.includes("no arbitrary pairing"),
    ),
  );
  for (const result of report.results.slice(1)) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.deepEqual(result.discrepancy_codes, ["DUPLICATE_PROVIDER_RECORD"]);
  }
  assert.equal(report.summary.heldAmbiguous, 3);
  assert.equal(
    report.summary.countsByDiscrepancyCode.DUPLICATE_PROVIDER_RECORD,
    2,
  );
});
