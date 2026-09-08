import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  MerchantPayment,
  ProviderPayment,
  SourceAttributes,
} from "../domain/model.ts";
import { reconcile } from "../domain/reconcile.ts";
import {
  ApplicationError,
  reconcileRecords,
} from "../application/reconcile-records.ts";
import { parseMerchantCsv } from "../adapters/merchant/csv.ts";
import { mapPaystackResponse } from "../adapters/providers/paystack/paystack.ts";
import type {
  PaystackAdapterOptions,
  PaystackResponse,
  PaystackTransactionData,
} from "../adapters/providers/paystack/paystack.ts";

const RECONCILIATION_CONFIG = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD"],
} as const;

const PAYSTACK_OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ["NGN", "USD"],
  timestampField: "paid_at",
};

const MERCHANT_HEADER =
  "merchant_reference,amount,currency,status,occurred_at,merchant_record_id";

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

const EXPECTED_ATTRIBUTES: SourceAttributes = {
  original_status: "success",
  created_at: "2023-11-14T22:13:20.000Z",
  paid_at: "2023-11-14T22:13:20.000Z",
  transaction_date: "2023-11-14T22:13:20.000Z",
};

test("1. the Paystack adapter produces the established SourceAttributes", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  assert.deepEqual(mapped.source_attributes, EXPECTED_ATTRIBUTES);
});

test("2. SourceAttributes survive the Application invocation", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.equal(report.results[0].outcome, "MATCH");
});

test("3. SourceAttributes survive reconciliation into MatchResult", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.deepEqual(report.results[0].source_attributes, EXPECTED_ATTRIBUTES);
});

test("4. final MatchResult contains the exact expected source attributes", () => {
  const mapped = mapPaystackResponse(
    paystackResponse({ status: "reversed" }),
    PAYSTACK_OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.deepEqual(report.results[0].source_attributes, {
    original_status: "reversed",
    created_at: "2023-11-14T22:13:20.000Z",
    paid_at: "2023-11-14T22:13:20.000Z",
    transaction_date: "2023-11-14T22:13:20.000Z",
  });
});

test("5. multiple records receive their own corresponding attributes", () => {
  const first = mapPaystackResponse(
    paystackResponse({ reference: "REF-A", id: 1, status: "success" }),
    PAYSTACK_OPTIONS,
  );
  const second = mapPaystackResponse(
    paystackResponse({
      reference: "REF-B",
      id: 2,
      status: "failed",
      paid_at: "2023-11-14T22:14:00.000Z",
    }),
    PAYSTACK_OPTIONS,
  );
  const merchants = parseMerchantCsv(
    merchantCsv([
      "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
      "REF-B,20000,NGN,FAILED,1700000000000,M-2",
    ]),
  );
  const report = reconcileRecords({
    merchantPayments: merchants,
    providerPayments: [first.payment, second.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [
      first.source_attributes,
      second.source_attributes,
    ],
  });
  assert.equal(report.results[0].merchant_record?.merchant_record_id, "M-1");
  assert.equal(report.results[0].source_attributes.original_status, "success");
  assert.equal(report.results[1].merchant_record?.merchant_record_id, "M-2");
  assert.equal(report.results[1].source_attributes.original_status, "failed");
  assert.equal(
    report.results[1].source_attributes.paid_at,
    "2023-11-14T22:14:00.000Z",
  );
});

test("5b. provider-only rows retain their own attributes", () => {
  const unmatched = mapPaystackResponse(
    paystackResponse({ reference: "REF-Z", id: 9 }),
    PAYSTACK_OPTIONS,
  );
  const duplicateA = mapPaystackResponse(
    paystackResponse({ reference: "REF-D", id: 7, status: "success" }),
    PAYSTACK_OPTIONS,
  );
  const duplicateB = mapPaystackResponse(
    paystackResponse({ reference: "REF-D", id: 8, status: "failed" }),
    PAYSTACK_OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-D,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [
      unmatched.payment,
      duplicateA.payment,
      duplicateB.payment,
    ],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [
      unmatched.source_attributes,
      duplicateA.source_attributes,
      duplicateB.source_attributes,
    ],
  });
  const unmatchedRow = report.results.find(
    (result) => result.outcome === "UNMATCHED_PROVIDER_RECORD",
  );
  assert.equal(unmatchedRow?.source_attributes.original_status, "success");
  const duplicateRows = report.results.filter((result) =>
    result.discrepancy_codes.includes("DUPLICATE_PROVIDER_RECORD"),
  );
  assert.equal(duplicateRows.length, 2);
  assert.deepEqual(
    duplicateRows.map((row) => row.source_attributes.original_status).sort(),
    ["failed", "success"],
  );
  const heldRow = report.results.find(
    (result) =>
      result.outcome === "HELD_AMBIGUOUS" && result.merchant_record !== null,
  );
  assert.deepEqual(heldRow?.source_attributes, {});
});

test("6. source attributes do not alter outcome classification", () => {
  const mapped = mapPaystackResponse(
    paystackResponse({ amount: 21000 }),
    PAYSTACK_OPTIONS,
  );
  const merchants: MerchantPayment[] = parseMerchantCsv(
    merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
  );
  const withAttributes = reconcileRecords({
    merchantPayments: merchants,
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  const withoutAttributes = reconcileRecords({
    merchantPayments: merchants,
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
  });
  assert.equal(withAttributes.results[0].outcome, "DISCREPANCY");
  assert.deepEqual(withAttributes.results[0].discrepancy_codes, [
    "AMOUNT_MISMATCH",
  ]);
  assert.deepEqual(
    withAttributes.results.map((result) => result.outcome),
    withoutAttributes.results.map((result) => result.outcome),
  );
  assert.deepEqual(
    withAttributes.results.map((result) => result.discrepancy_codes),
    withoutAttributes.results.map((result) => result.discrepancy_codes),
  );
});

test("7. source attributes do not alter discrepancy codes", () => {
  const mapped = mapPaystackResponse(
    paystackResponse({
      amount: 21000,
      currency: "USD",
      status: "failed",
      paid_at: "2023-11-14T22:15:00.000Z",
    }),
    PAYSTACK_OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.deepEqual(report.results[0].discrepancy_codes, [
    "AMOUNT_MISMATCH",
    "CURRENCY_MISMATCH",
    "STATUS_MISMATCH",
    "TEMPORAL_ANOMALY",
  ]);
  assert.deepEqual(report.results[0].source_attributes, {
    original_status: "failed",
    created_at: "2023-11-14T22:13:20.000Z",
    paid_at: "2023-11-14T22:15:00.000Z",
    transaction_date: "2023-11-14T22:13:20.000Z",
  });
});

test("8. source attributes do not alter deterministic ordering", () => {
  const run = (withAttributes: boolean) => {
    const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
    const report = reconcileRecords({
      merchantPayments: parseMerchantCsv(
        merchantCsv([
          "REF-A,20000,NGN,SUCCESS,1700000000000,M-1",
          "REF-B,25000,NGN,SUCCESS,1700000000000,M-2",
        ]),
      ),
      providerPayments: [mapped.payment],
      config: RECONCILIATION_CONFIG,
      providerSourceAttributes: withAttributes
        ? [mapped.source_attributes]
        : undefined,
    });
    return report.results.map((result) => result.outcome);
  };
  assert.deepEqual(run(true), run(false));
});

test("9. absent source attributes preserve the established empty representation", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
  });
  assert.deepEqual(report.results[0].source_attributes, {});
});

test("10. provider-specific raw fields do not leak into MatchResult", () => {
  const mapped = mapPaystackResponse(
    paystackResponse({
      customer: { id: 123 } as never,
      gateway_response: "Successful",
    } as Partial<PaystackTransactionData>),
    PAYSTACK_OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.deepEqual(Object.keys(report.results[0].source_attributes).sort(), [
    "created_at",
    "original_status",
    "paid_at",
    "transaction_date",
  ]);
});

test("11. end-to-end exact match retains MATCH while exposing source attributes", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0].outcome, "MATCH");
  assert.deepEqual(report.results[0].source_attributes, EXPECTED_ATTRIBUTES);
});

test("12. multiple-discrepancy scenario retains all codes while carrying attributes", () => {
  const mapped = mapPaystackResponse(
    paystackResponse({
      amount: 21000,
      currency: "USD",
      status: "failed",
      paid_at: "2023-11-14T22:15:00.000Z",
    }),
    PAYSTACK_OPTIONS,
  );
  const report = reconcileRecords({
    merchantPayments: parseMerchantCsv(
      merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
    ),
    providerPayments: [mapped.payment],
    config: RECONCILIATION_CONFIG,
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.equal(report.results[0].outcome, "DISCREPANCY");
  assert.equal(report.results[0].discrepancy_codes.length, 4);
  assert.equal(report.results[0].source_attributes.original_status, "failed");
});

test("misaligned providerSourceAttributes are rejected by the Application", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: parseMerchantCsv(
          merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
        ),
        providerPayments: [mapped.payment],
        config: RECONCILIATION_CONFIG,
        providerSourceAttributes: [],
      }),
    (error: unknown) =>
      error instanceof ApplicationError &&
      error.message.includes("align one-to-one"),
  );
  assert.throws(
    () =>
      reconcileRecords({
        merchantPayments: parseMerchantCsv(
          merchantCsv(["REF-A,20000,NGN,SUCCESS,1700000000000,M-1"]),
        ),
        providerPayments: [mapped.payment],
        config: RECONCILIATION_CONFIG,
        providerSourceAttributes:
          "not-an-array" as unknown as SourceAttributes[],
      }),
    ApplicationError,
  );
});

test("domain-level reconcile threads attributes without the Application", () => {
  const mapped = mapPaystackResponse(paystackResponse(), PAYSTACK_OPTIONS);
  const providerPayment: ProviderPayment = mapped.payment;
  const report = reconcile([], [providerPayment], RECONCILIATION_CONFIG, {
    providerSourceAttributes: [mapped.source_attributes],
  });
  assert.equal(report.results[0].outcome, "UNMATCHED_PROVIDER_RECORD");
  assert.deepEqual(report.results[0].source_attributes, EXPECTED_ATTRIBUTES);
});
