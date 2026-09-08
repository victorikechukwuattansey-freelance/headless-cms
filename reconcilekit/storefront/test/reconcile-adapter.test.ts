import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  MerchantPayment,
  ProviderPayment,
} from "../../src/domain/model.ts";
import { reconcileRecords } from "../../src/application/reconcile-records.ts";
import { parseMerchantCsv } from "../../src/adapters/merchant/csv.ts";
import {
  DEFAULT_CONFIG,
  merchant as merchantFixture,
  provider as providerFixture,
} from "../../src/domain/fixtures.ts";
import type { PaymentRecord } from "../src/domain/types.ts";
import {
  buildReconcileBridgeInput,
  effectivePaymentRecords,
  paymentRecordToMerchantPayment,
  paymentRecordToProviderPayment,
} from "../src/reconcile/adapter.ts";
import { buildReconcileView, RECONCILE_CONFIG } from "../src/reconcile/view.ts";
import { toMerchantCsv } from "../src/reconcile/merchant-csv.ts";

function paidRecord(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: "o-12500",
    businessId: "b-live-e2e",
    orderId: "o-12500",
    expectedAmount: 12500,
    currency: "NGN",
    paystackReference: "stf_o12500",
    status: "SUCCESS",
    paidAt: "2026-08-18T12:37:49.000Z",
    refundStatus: "NONE",
    metadata: {
      requested_reference: "stf_o12500",
      authorization_url: "https://checkout.paystack.com/abc",
      callback_url: "http://localhost:8787/callback?orderId=o-12500",
      customer_email: "buyer@example.com",
      product_id: "p-1",
      verified_at: "2026-08-18T12:37:53.000Z",
      paystack_canonical_status: "SUCCESS",
      integrity: "OK",
      paystack_amount: "12500",
      paystack_currency: "NGN",
      paystack_paid_at: "2026-08-18T12:37:49.000Z",
    },
    recordedAt: "2026-08-18T12:25:36.445Z",
    ...overrides,
  };
}

function reconcile(records: readonly PaymentRecord[]) {
  const input = buildReconcileBridgeInput(records);
  const report = reconcileRecords({ ...input, config: RECONCILE_CONFIG });
  return { input, report, view: buildReconcileView(records, report) };
}

test("1. exact payment: expected 12500, received 12500, difference 0, SUCCESS, MATCH", () => {
  const record = paidRecord();
  const { input, report, view } = reconcile([record]);
  assert.equal(input.merchantPayments.length, 1);
  assert.equal(input.providerPayments.length, 1);
  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0]?.outcome, "MATCH");
  const row = view.results[0] as NonNullable<(typeof view.results)[number]>;
  assert.equal(row.expectedAmount, 12500);
  assert.equal(row.receivedAmount, 12500);
  assert.equal(row.difference, 0);
  assert.equal(row.status, "SUCCESS");
  assert.equal(row.outcome, "MATCH");
  assert.equal(row.receivedResolved, true);
  assert.equal(row.currencyMismatch, false);
});

test("2. underpayment: received 10000 vs expected 12500, mismatch preserved", () => {
  const record = paidRecord({
    metadata: {
      ...paidRecord().metadata,
      paystack_amount: "10000",
      integrity: "AMOUNT_MISMATCH",
    },
  });
  const { report, view } = reconcile([record]);
  assert.equal(report.results[0]?.outcome, "DISCREPANCY");
  assert.deepEqual(report.results[0]?.discrepancy_codes, ["AMOUNT_MISMATCH"]);
  const row = view.results[0]!;
  assert.equal(row.receivedAmount, 10000);
  assert.equal(row.difference, -2500);
  assert.equal(row.status, "SUCCESS");
});

test("3. overpayment: received 15000 vs expected 12500, mismatch preserved", () => {
  const record = paidRecord({
    status: "UNKNOWN",
    metadata: {
      ...paidRecord().metadata,
      paystack_amount: "15000",
      integrity: "AMOUNT_MISMATCH",
    },
  });
  const { report, view } = reconcile([record]);
  assert.equal(report.results[0]?.outcome, "DISCREPANCY");
  const row = view.results[0]!;
  assert.equal(row.receivedAmount, 15000);
  assert.equal(row.difference, 2500);
  assert.equal(row.status, "UNKNOWN");
  assert.ok(report.results[0]?.discrepancy_codes.includes("AMOUNT_MISMATCH"));
});

test("4. currency mismatch: no numeric reconciliation across currencies", () => {
  const record = paidRecord({
    status: "UNKNOWN",
    metadata: {
      ...paidRecord().metadata,
      paystack_currency: "USD",
      integrity: "CURRENCY_MISMATCH",
    },
  });
  const { report, view } = reconcile([record]);
  assert.equal(report.results[0]?.outcome, "DISCREPANCY");
  assert.ok(report.results[0]?.discrepancy_codes.includes("CURRENCY_MISMATCH"));
  const row = view.results[0]!;
  assert.equal(row.receivedCurrency, "USD");
  assert.equal(row.currencyMismatch, true);
  assert.equal(row.difference, null);
});

test("5. PENDING: received amount unresolved, no provider row", () => {
  const record = paidRecord({
    id: "o-pending",
    orderId: "o-pending",
    paystackReference: "stf_opending",
    status: "PENDING",
    paidAt: null,
    metadata: {
      requested_reference: "stf_opending",
      authorization_url: "https://checkout.paystack.com/pending",
      callback_url: "http://localhost:8787/callback?orderId=o-pending",
      customer_email: "buyer@example.com",
      product_id: "p-1",
    },
  });
  const { input, report, view } = reconcile([record]);
  assert.equal(input.providerPayments.length, 0);
  assert.equal(input.merchantPayments.length, 1);
  assert.equal(report.summary.missingProviderRecords, 1);
  assert.equal(report.results[0]?.outcome, "MISSING_PROVIDER_RECORD");
  const row = view.results[0]!;
  assert.equal(row.receivedAmount, null);
  assert.equal(row.receivedResolved, false);
  assert.equal(row.difference, null);
  assert.equal(row.currencyMismatch, false);
  assert.equal(row.status, "PENDING");
});

test("6. FAILED: canonical status preserved, never presented as received", () => {
  const record = paidRecord({
    id: "o-failed",
    orderId: "o-failed",
    paystackReference: "stf_ofailed",
    status: "FAILED",
    paidAt: null,
    metadata: {
      ...paidRecord().metadata,
      paystack_canonical_status: "FAILED",
      paystack_paid_at: "",
      verified_at: "2026-08-18T12:40:00.000Z",
    },
    recordedAt: "2026-08-18T12:41:00.000Z",
  });
  const { report, view } = reconcile([record]);
  assert.equal(report.results[0]?.outcome, "MATCH");
  const row = view.results[0]!;
  assert.equal(row.status, "FAILED");
  assert.equal(row.receivedAmount, 12500);
  assert.equal(row.receivedResolved, true);
});

test("7. UNKNOWN (abandoned): STATUS_UNRESOLVED, status preserved", () => {
  const record = paidRecord({
    id: "o-unknown",
    orderId: "o-unknown",
    paystackReference: "stf_ounknown",
    status: "UNKNOWN",
    paidAt: null,
    metadata: {
      ...paidRecord().metadata,
      paystack_canonical_status: "UNKNOWN",
      paystack_paid_at: "",
      verified_at: "2026-08-18T12:40:00.000Z",
    },
    recordedAt: "2026-08-18T12:41:00.000Z",
  });
  const { report, view } = reconcile([record]);
  assert.equal(report.results[0]?.outcome, "UNRESOLVED");
  assert.ok(report.results[0]?.discrepancy_codes.includes("STATUS_UNRESOLVED"));
  assert.equal(view.results[0]!.status, "UNKNOWN");
});

test("8. missing order or PaymentRecord yields no view row", () => {
  const { view } = reconcile([]);
  assert.equal(view.results.length, 0);
  assert.equal(view.summary.totalRecords, 0);
});

test("9. multiple orders for the same business", () => {
  const first = paidRecord();
  const second = paidRecord({
    id: "o-2",
    orderId: "o-2",
    paystackReference: "stf_o2",
    metadata: {
      ...paidRecord().metadata,
      paystack_amount: "12500",
      paystack_paid_at: "2026-08-18T12:50:00.000Z",
    },
    recordedAt: "2026-08-18T12:50:05.000Z",
  });
  const { report, view } = reconcile([first, second]);
  assert.equal(view.results.length, 2);
  assert.equal(view.results[0]!.businessId, "b-live-e2e");
  assert.equal(view.results[1]!.businessId, "b-live-e2e");
  assert.equal(report.summary.matched, 2);
  assert.equal(report.summary.totalRecords, 4);
});

test("10. reference preservation: the Paystack reference is the engine join key", () => {
  const record = paidRecord();
  const { input, report, view } = reconcile([record]);
  assert.equal(input.merchantPayments[0]?.merchant_reference, "stf_o12500");
  assert.equal(input.providerPayments[0]?.reference, "stf_o12500");
  assert.equal(
    report.results[0]?.merchant_record?.merchant_reference,
    "stf_o12500",
  );
  assert.equal(report.results[0]?.provider_record?.reference, "stf_o12500");
  assert.equal(view.results[0]?.reference, "stf_o12500");
});

test("11. CSV conversion round-trips through the frozen merchant loader", () => {
  const records = [
    paidRecord(),
    paidRecord({
      id: "o-pending",
      orderId: "o-pending",
      paystackReference: "stf_opending",
      status: "PENDING",
      paidAt: null,
      metadata: {
        requested_reference: "stf_opending",
        authorization_url: "https://checkout.paystack.com/pending",
        callback_url: "http://localhost:8787/callback?orderId=o-pending",
        customer_email: "buyer@example.com",
        product_id: "p-1",
      },
    }),
  ];
  const csv = toMerchantCsv(records);
  assert.equal(
    csv.split("\n")[0],
    "merchant_reference,amount,currency,status,occurred_at,merchant_record_id",
  );
  const parsed = parseMerchantCsv(csv);
  assert.equal(parsed.length, 2);
  const expected = records.map(paymentRecordToMerchantPayment);
  parsed.forEach((row: MerchantPayment, index: number) => {
    assert.deepEqual(row, expected[index]);
  });
});

test("12. regression: frozen reconciliation engine still produces its existing result", () => {
  const report = reconcileRecords({
    merchantPayments: [merchantFixture()],
    providerPayments: [providerFixture()],
    config: DEFAULT_CONFIG,
  });
  assert.equal(report.summary.matched, 1);
  assert.equal(report.results[0]?.outcome, "MATCH");
  assert.equal(report.results[0]?.merchant_record?.merchant_reference, "REF-A");
});

test("adapter: effective records reduce per order id, last append wins", () => {
  const older = paidRecord({ recordedAt: "2026-08-18T12:00:00.000Z" });
  const newer: PaymentRecord = {
    ...paidRecord(),
    recordedAt: "2026-08-18T12:37:53.000Z",
    metadata: {
      ...paidRecord().metadata,
      verified_at: "2026-08-18T12:37:53.000Z",
    },
  };
  const effective = effectivePaymentRecords([older, newer, older]);
  assert.equal(effective.length, 1);
  assert.equal(effective[0]?.recordedAt, older.recordedAt);
  const tracked = effectivePaymentRecords([older, newer]);
  assert.equal(tracked[0]?.recordedAt, newer.recordedAt);
});

test("adapter: provider side requires verified payload metadata", () => {
  const clean = paidRecord();
  const provider = paymentRecordToProviderPayment(clean);
  assert.ok(provider !== null);
  const { reference, amount } = provider as ProviderPayment;
  assert.equal(reference, "stf_o12500");
  assert.equal(amount, 12500);
  assert.equal(
    paymentRecordToProviderPayment(
      paidRecord({ status: "PENDING", paidAt: null, metadata: {} }),
    ),
    null,
  );
});
