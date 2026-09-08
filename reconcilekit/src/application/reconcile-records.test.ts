import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CONFIG, merchant, provider } from "../domain/fixtures.ts";
import { reconcile } from "../domain/reconcile.ts";
import { ApplicationError, reconcileRecords } from "./reconcile-records.ts";
import type { ReconcileRecordsRequest } from "./reconcile-records.ts";

test("provider-neutral inputs reach the domain and produce the domain report", () => {
  const m = merchant({ merchant_record_id: "M-1" });
  const p = provider({ provider_id: "P-1" });
  const report = reconcileRecords({
    merchantPayments: [m],
    providerPayments: [p],
    config: DEFAULT_CONFIG,
  });
  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0].outcome, "MATCH");
  assert.equal(report.results[0].merchant_record, m);
  assert.equal(report.results[0].provider_record, p);
});

test("explicit configuration reaches the domain", () => {
  const m = merchant({ occurred_at: 1_700_000_000_000 });
  const p = provider({ occurred_at: 1_700_000_090_000 });
  const anomaly = reconcileRecords({
    merchantPayments: [m],
    providerPayments: [p],
    config: DEFAULT_CONFIG,
  });
  assert.deepEqual(anomaly.results[0].discrepancy_codes, ["TEMPORAL_ANOMALY"]);

  const disabled = reconcileRecords({
    merchantPayments: [m],
    providerPayments: [p],
    config: {
      timestampValidation: { enabled: false },
      supportedCurrencies: ["NGN", "USD"],
    },
  });
  assert.equal(disabled.results[0].outcome, "MATCH");
  assert.ok(
    disabled.results[0].validation_notes.some((note) =>
      note.includes("timestamp validation disabled"),
    ),
  );
});

test("returns the domain reconciliation report unchanged", () => {
  const merchants = [
    merchant({ merchant_record_id: "M-1" }),
    merchant({
      merchant_record_id: "M-2",
      amount: 25000,
      merchant_reference: "REF-B",
    }),
    merchant({
      merchant_record_id: "M-3",
      currency: "USD",
      merchant_reference: "REF-C",
    }),
  ];
  const providers = [
    provider({ provider_id: "P-1", amount: 20000 }),
    provider({ provider_id: "P-2", reference: "REF-B", amount: 26000 }),
    provider({ provider_id: "P-3", reference: "REF-C" }),
  ];
  const request = {
    merchantPayments: merchants,
    providerPayments: providers,
    config: DEFAULT_CONFIG,
  };
  assert.deepEqual(
    reconcileRecords(request),
    reconcile(merchants, providers, DEFAULT_CONFIG),
  );
});

test("domain outcomes are preserved unchanged", () => {
  const inputErrorM = merchant({ currency: "USD", merchant_record_id: "M-1" });
  const missingRefM = merchant({
    merchant_reference: null,
    merchant_record_id: "M-2",
  });
  const heldM = merchant({
    merchant_record_id: "M-3",
    merchant_reference: "REF-D",
  });
  const dupP1 = provider({ provider_id: "P-1", reference: "REF-D" });
  const dupP2 = provider({ provider_id: "P-2", reference: "REF-D" });
  const singleCurrencyConfig = {
    timestampValidation: { enabled: true, toleranceMs: 60_000 },
    supportedCurrencies: ["NGN"],
  };
  const request = {
    merchantPayments: [inputErrorM, missingRefM, heldM],
    providerPayments: [dupP1, dupP2],
    config: singleCurrencyConfig,
  };
  const report = reconcileRecords(request);
  const outcomes = report.results.map((result) => result.outcome);
  assert.deepEqual(outcomes, [
    "INPUT_ERROR",
    "MISSING_REFERENCE",
    "HELD_AMBIGUOUS",
    "HELD_AMBIGUOUS",
    "HELD_AMBIGUOUS",
  ]);
  assert.equal(
    report.results.filter((result) => result.outcome === "INPUT_ERROR").length,
    1,
  );
});

test("multiple discrepancies are preserved", () => {
  const m = merchant({
    amount: 20000,
    currency: "NGN",
    status: "SUCCESS",
    occurred_at: 1_700_000_000_000,
  });
  const p = provider({
    amount: 21000,
    currency: "USD",
    status: "FAILED",
    occurred_at: 1_700_000_300_000,
  });
  const report = reconcileRecords({
    merchantPayments: [m],
    providerPayments: [p],
    config: DEFAULT_CONFIG,
  });
  assert.deepEqual(report.results[0].discrepancy_codes, [
    "AMOUNT_MISMATCH",
    "CURRENCY_MISMATCH",
    "STATUS_MISMATCH",
    "TEMPORAL_ANOMALY",
  ]);
  assert.equal(report.summary.discrepancies, 1);
});

test("performs no matching, indexing, or provider translation of its own", () => {
  const m1 = merchant({ amount: 20000, merchant_record_id: "M-1" });
  const m2 = merchant({ amount: 25000, merchant_record_id: "M-2" });
  const p = provider({ amount: 20000, provider_id: "P-1" });
  const viaApplication = reconcileRecords({
    merchantPayments: [m1, m2],
    providerPayments: [p],
    config: DEFAULT_CONFIG,
  });
  const viaDomain = reconcile([m1, m2], [p], DEFAULT_CONFIG);
  assert.deepEqual(viaApplication, viaDomain);
  const held = viaApplication.results.filter(
    (result) => result.outcome === "HELD_AMBIGUOUS",
  );
  assert.equal(held.length, 3);
  assert.equal(
    viaApplication.summary.countsByDiscrepancyCode.DUPLICATE_MERCHANT_RECORD,
    2,
  );
});

test("application-level orchestration errors are ApplicationError, not domain outcomes", () => {
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: [],
        providerPayments: [],
        config: {
          timestampValidation: { enabled: true, toleranceMs: -1 },
          supportedCurrencies: ["NGN"],
        },
      }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.message.includes("orchestration failed") &&
      error.cause instanceof Error,
  );
});

test("malformed request envelopes are rejected as ApplicationError", () => {
  assert.throws(
    () => reconcileRecords(null as unknown as ReconcileRecordsRequest),
    ApplicationError,
  );
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: "not-an-array" as unknown as readonly never[],
        providerPayments: [],
        config: DEFAULT_CONFIG,
      }),
    ApplicationError,
  );
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: [],
        providerPayments: "not-an-array" as unknown as readonly never[],
        config: DEFAULT_CONFIG,
      }),
    ApplicationError,
  );
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: [],
        providerPayments: [],
        config: null as unknown as ReconcileRecordsRequest["config"],
      }),
    ApplicationError,
  );
});

test("domain outcomes never become application errors", () => {
  const report = reconcileRecords({
    merchantPayments: [
      merchant({ currency: "USD", merchant_record_id: "M-1" }),
      merchant({ merchant_reference: null, merchant_record_id: "M-2" }),
    ],
    providerPayments: [provider({ provider_id: "P-1" })],
    config: {
      timestampValidation: { enabled: true, toleranceMs: 60_000 },
      supportedCurrencies: ["NGN"],
    },
  });
  assert.equal(report.summary.inputErrors, 1);
  assert.equal(report.summary.missingReference, 1);
});
