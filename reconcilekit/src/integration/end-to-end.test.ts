import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReconciliationConfig } from "../domain/model.ts";
import { reconcileRecords } from "../application/reconcile-records.ts";
import {
  MerchantCsvError,
  parseMerchantCsv,
} from "../adapters/merchant/csv.ts";
import {
  mapPaystackResponse,
  PaystackAdapterError,
} from "../adapters/providers/paystack/paystack.ts";
import type {
  PaystackAdapterOptions,
  PaystackResponse,
  PaystackTransactionData,
} from "../adapters/providers/paystack/paystack.ts";

const MERCHANT_HEADER =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id";

const RECONCILIATION_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD"],
};

const PAYSTACK_OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ["NGN", "USD"],
  timestampField: "paid_at",
};

function merchantCsv(rows: readonly string[]): string {
  return [MERCHANT_HEADER, ...rows].join("\n");
}

function paystackResponse(
  overrides: Partial<PaystackTransactionData> = {},
): PaystackResponse {
  return {
    status: true,
    message: "Verification successful",
    data: {
      id: 4123456789,
      reference: "REF-A",
      amount: 20000,
      currency: "NGN",
      status: "success",
      created_at: "2023-11-14T22:13:20.000Z",
      paid_at: "2023-11-14T22:13:20.000Z",
      transaction_date: "2023-11-14T22:13:20.000Z",
      ...overrides,
    },
  };
}

test("exact match: CSV and Paystack fixtures reconcile to MATCH end to end", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.summary.totalRecords, 2);
  assert.equal(report.summary.matched, 1);
  assert.equal(report.summary.discrepancies, 0);
  const result = report.results[0];
  assert.equal(result.outcome, "MATCH");
  assert.deepEqual(result.discrepancy_codes, []);
  assert.equal(result.merchant_record?.merchant_record_id, "M-1");
  assert.equal(result.provider_record?.provider_id, "4123456789");
  assert.deepEqual(Object.keys(result.provider_record ?? {}).sort(), [
    "amount",
    "currency",
    "occurred_at",
    "provider_id",
    "reference",
    "status",
  ]);
});

test("amount mismatch: CSV 20000 vs Paystack 21000 produces AMOUNT_MISMATCH", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(paystackResponse({ amount: 21000 }), PAYSTACK_OPTIONS)
      .payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, ["AMOUNT_MISMATCH"]);
  assert.equal(report.summary.discrepancies, 1);
});

test("currency mismatch: merchant NGN vs provider USD produces CURRENCY_MISMATCH", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(paystackResponse({ currency: "USD" }), PAYSTACK_OPTIONS)
      .payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, ["CURRENCY_MISMATCH"]);
});

test("status mismatch: merchant SUCCESS vs mapped Paystack failed produces STATUS_MISMATCH", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(
      paystackResponse({ status: "failed" }),
      PAYSTACK_OPTIONS,
    ).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, ["STATUS_MISMATCH"]);
});

test("timestamp anomaly: provider paid_at outside tolerance produces TEMPORAL_ANOMALY", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(
      paystackResponse({ paid_at: "2023-11-14T22:15:00.000Z" }),
      PAYSTACK_OPTIONS,
    ).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, ["TEMPORAL_ANOMALY"]);
});

test("multiple simultaneous discrepancies are all preserved end to end", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(
      paystackResponse({
        amount: 21000,
        currency: "USD",
        status: "failed",
        paid_at: "2023-11-14T22:15:00.000Z",
      }),
      PAYSTACK_OPTIONS,
    ).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0].discrepancy_codes, [
    "AMOUNT_MISMATCH",
    "CURRENCY_MISMATCH",
    "STATUS_MISMATCH",
    "TEMPORAL_ANOMALY",
  ]);
  assert.equal(report.summary.countsByDiscrepancyCode.AMOUNT_MISMATCH, 1);
  assert.equal(report.summary.countsByDiscrepancyCode.CURRENCY_MISMATCH, 1);
  assert.equal(report.summary.countsByDiscrepancyCode.STATUS_MISMATCH, 1);
  assert.equal(report.summary.countsByDiscrepancyCode.TEMPORAL_ANOMALY, 1);
});

test("merchant empty reference reaches the domain as MISSING_REFERENCE", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv([",20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const report = reconcileRecords({
    merchantPayments,
    providerPayments: [],
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "MISSING_REFERENCE");
  assert.equal(report.summary.missingReference, 1);
});

test("merchant whitespace-only reference reaches the domain as MISSING_REFERENCE", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["   ,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const report = reconcileRecords({
    merchantPayments,
    providerPayments: [],
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "MISSING_REFERENCE");
});

test("provider missing reference reaches the domain as MISSING_REFERENCE", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(paystackResponse({ reference: null }), PAYSTACK_OPTIONS)
      .payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  const outcomes = report.results.map((result) => result.outcome);
  assert.deepEqual(outcomes, ["MISSING_PROVIDER_RECORD", "MISSING_REFERENCE"]);
  assert.equal(report.summary.missingProviderRecords, 1);
  assert.equal(report.summary.missingReference, 1);
});

test("provider unmapped status (reversed) reaches the domain as STATUS_UNRESOLVED", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const providerPayments = [
    mapPaystackResponse(
      paystackResponse({ status: "reversed" }),
      PAYSTACK_OPTIONS,
    ).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(report.results[0].outcome, "UNRESOLVED");
  assert.deepEqual(report.results[0].discrepancy_codes, ["STATUS_UNRESOLVED"]);
  assert.equal(report.summary.unresolved, 1);
});

test("provider unsupported currency is rejected by the adapter before reconciliation", () => {
  assert.throws(
    () =>
      mapPaystackResponse(
        paystackResponse({ currency: "GBP" }),
        PAYSTACK_OPTIONS,
      ),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_UNSUPPORTED_CURRENCY",
  );
});

test("malformed merchant CSV is rejected by the adapter before reconciliation", () => {
  assert.throws(
    () =>
      parseMerchantCsv(
        merchantCsv(['"REF-A,20000,NGN,SUCCESS,1700000000000,M-1']),
      ),
    (error: unknown) =>
      error instanceof MerchantCsvError &&
      error.code === "MERCHANT_CSV_PARSE_ERROR",
  );
});

test("mixed multi-record flow preserves input order and per-record outcomes", () => {
  const merchantPayments = parseMerchantCsv(
    merchantCsv([
      "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,25000,NGN,SUCCESS,1700000000000,M-2",
    ]),
  );
  const providerPayments = [
    mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS).payment,
    mapPaystackResponse(
      paystackResponse({ reference: "REF-C", amount: 30000 }),
      PAYSTACK_OPTIONS,
    ).payment,
  ];
  const report = reconcileRecords({
    merchantPayments,
    providerPayments,
    config: RECONCILIATION_CONFIG,
  });
  assert.deepEqual(
    report.results.map((result) => result.outcome),
    ["MATCH", "MISSING_PROVIDER_RECORD", "UNMATCHED_PROVIDER_RECORD"],
  );
  assert.equal(report.summary.totalRecords, 4);
  assert.equal(report.summary.matched, 1);
  assert.equal(report.summary.missingProviderRecords, 1);
  assert.equal(report.summary.unmatchedProviderRecords, 1);
});

test("identical fixtures produce identical reconciliation reports", () => {
  const run = () => {
    const merchantPayments = parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    );
    const providerPayments = [
      mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS).payment,
    ];
    return reconcileRecords({
      merchantPayments,
      providerPayments,
      config: RECONCILIATION_CONFIG,
    });
  };
  assert.equal(JSON.stringify(run()), JSON.stringify(run()));
});
