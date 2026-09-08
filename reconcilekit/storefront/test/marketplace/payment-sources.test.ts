import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  buildIdempotencyKey,
  buildPaymentEventId,
  ingestPaymentEvent,
  listPaymentEvents,
} from "../../src/marketplace/payment-sources/ingest.ts";
import { paystackPaymentEvent } from "../../src/marketplace/payment-sources/adapters/paystack.ts";
import { bankTransferPaymentEvent } from "../../src/marketplace/payment-sources/adapters/bank-transfer.ts";
import { walletLedgerToPaymentEvent } from "../../src/marketplace/payment-sources/adapters/wallet.ts";
import { manualCsvPaymentEvent } from "../../src/marketplace/payment-sources/adapters/manual-csv.ts";
import {
  reconcilePaymentEvents,
  toReconcileKitRequest,
} from "../../src/marketplace/payment-sources/to-reconcilekit.ts";
import { PaymentSourceError } from "../../src/marketplace/payment-sources/types.ts";
import type { PaymentEventInput } from "../../src/marketplace/payment-sources/types.ts";
import type {
  MatchResult,
  ReconciliationConfig,
  ReconciliationReport,
} from "../../../src/domain/model.ts";
import type {
  PaystackAdapterOptions,
  PaystackResponse,
  PaystackTransactionData,
} from "../../../src/adapters/providers/paystack/paystack.ts";
import type { WalletLedgerEntry } from "../../src/marketplace/types.ts";

const NOW = "2026-01-01T12:00:00.000Z";
const NOW_EPOCH = Date.parse(NOW);

const TEST_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD", "GBP"],
};

const PAYSTACK_OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: TEST_CONFIG.supportedCurrencies,
  timestampField: "paid_at",
};

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-payment-sources-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function paystackTransaction(
  overrides: Partial<PaystackTransactionData> = {},
): PaystackResponse {
  return {
    status: true,
    message: "Verification successful",
    data: {
      id: 1943896549,
      reference: "ps_456",
      amount: 1000,
      currency: "NGN",
      status: "success",
      created_at: NOW,
      paid_at: NOW,
      transaction_date: NOW,
      ...overrides,
    },
  };
}

function paystackDraft(overrides: {
  readonly transactionId?: string | null;
  readonly merchantReference?: string | null;
}): PaymentEventInput {
  return paystackPaymentEvent(paystackTransaction(), PAYSTACK_OPTIONS, {
    transactionId: overrides.transactionId ?? null,
    merchantReference: overrides.merchantReference ?? null,
  });
}

function walletLedgerEntry(
  overrides: Partial<WalletLedgerEntry> = {},
): WalletLedgerEntry {
  return {
    id: "wl_1",
    walletId: "wlt_1",
    transactionId: "mk_txn_c",
    type: "DEBIT_SUCCESS",
    amountMinor: 1000,
    currency: "NGN",
    status: "POSTED",
    reference: "wld_1",
    occurredAt: NOW,
    metadata: {},
    simulated: true,
    ...overrides,
  };
}

function merchantResult(
  report: ReconciliationReport,
  merchantRecordId: string,
): MatchResult | undefined {
  return report.results.find(
    (result) => result.merchant_record?.merchant_record_id === merchantRecordId,
  );
}

test("paystack: raw responses normalize via the root adapter mapping", () => {
  const event = paystackDraft({
    transactionId: "mk_txn_a",
    merchantReference: "mk_txn_a",
  });
  assert.equal(event.payment_source, "PAYSTACK");
  assert.equal(event.payment_source_reference, "ps_456");
  assert.equal(event.source_event_id, "1943896549");
  assert.equal(event.amount, 1000);
  assert.equal(event.currency, "NGN");
  assert.equal(event.status, "SUCCESS");
  assert.equal(event.occurred_at, NOW_EPOCH);
  assert.equal(event.source_confidence, "OBSERVED");
  assert.equal(event.source_attributes.original_status, "success");

  const abandoned = paystackPaymentEvent(
    paystackTransaction({ status: "abandoned" }),
    PAYSTACK_OPTIONS,
    { transactionId: null, merchantReference: null },
  );
  assert.equal(abandoned.status, "UNKNOWN");

  const missingStatus = paystackPaymentEvent(
    paystackTransaction({ status: undefined }),
    PAYSTACK_OPTIONS,
    { transactionId: null, merchantReference: null },
  );
  assert.equal(missingStatus.status, null);
});

test("paystack: evidence reaches the engine as an exact MATCH", async (t) => {
  const store = tempStore(t);
  const { event } = await ingestPaymentEvent(
    store,
    paystackDraft({
      transactionId: "mk_txn_a",
      merchantReference: "mk_txn_a",
    }),
    { now: NOW_EPOCH },
  );
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  const result = merchantResult(report, "mk_txn_a");
  assert.equal(result?.outcome, "MATCH");
  assert.deepEqual(result?.discrepancy_codes, []);
  assert.equal(report.summary.matched, 1);
});

test("paystack: the source reference is never the join key", async (t) => {
  const store = tempStore(t);
  const { event } = await ingestPaymentEvent(
    store,
    paystackDraft({
      transactionId: "mk_txn_a",
      merchantReference: "mk_txn_a",
    }),
    { now: NOW_EPOCH },
  );
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  const result = merchantResult(report, "mk_txn_a");
  assert.equal(result?.provider_record?.reference, "mk_txn_a");
  assert.equal(result?.source_attributes.payment_source_reference, "ps_456");
  assert.ok(
    result?.provider_record !== null &&
      result?.provider_record !== undefined &&
      !JSON.stringify(result.provider_record).includes("ps_456"),
  );
});

test("bank transfer: a row carrying a reference reconciles as MATCH", async (t) => {
  const store = tempStore(t);
  const draft = bankTransferPaymentEvent(
    {
      amountMinor: 5000,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "row_1",
    },
    { transactionId: "mk_txn_b", merchantReference: "mk_txn_b" },
  );
  const { event } = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  const result = merchantResult(report, "mk_txn_b");
  assert.equal(result?.outcome, "MATCH");
  assert.equal(event.occurred_at, NOW_EPOCH);
});

test("bank transfer: an unanchored row stays MISSING_REFERENCE, never auto-correlated", async (t) => {
  const store = tempStore(t);
  const draft = bankTransferPaymentEvent(
    {
      amountMinor: 5000,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "import_1",
    },
    { transactionId: null, merchantReference: null },
  );
  assert.equal(draft.transaction_id, null);
  assert.equal(draft.merchant_reference, null);
  assert.equal(draft.source_event_id, "import_1");

  const { event } = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  const request = toReconcileKitRequest([event], TEST_CONFIG);
  assert.equal(request.providerPayments.length, 0);

  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  assert.equal(report.results.length, 1);
  assert.equal(report.results[0].outcome, "MISSING_REFERENCE");

  const stored = await store.readLatestById("payment_events", event.event_id);
  assert.deepEqual(stored, event);
});

test("idempotency: replaying an identical event stores exactly once", async (t) => {
  const store = tempStore(t);
  const draft = paystackDraft({
    transactionId: "mk_txn_a",
    merchantReference: "mk_txn_a",
  });
  const first = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  assert.equal(first.recorded, true);
  assert.equal(first.replay, false);

  const replay = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  assert.equal(replay.recorded, false);
  assert.equal(replay.replay, true);
  assert.equal(replay.event.event_id, first.event.event_id);
  assert.deepEqual(replay.event, first.event);

  const stored = await listPaymentEvents(store);
  assert.equal(stored.length, 1);
});

test("idempotency: distinct source references are never collapsed", async (t) => {
  const store = tempStore(t);
  const anchor = { transactionId: "mk_txn_a", merchantReference: "mk_txn_a" };
  const first = paystackPaymentEvent(
    paystackTransaction({ reference: "ps_456" }),
    PAYSTACK_OPTIONS,
    anchor,
  );
  const second = paystackPaymentEvent(
    paystackTransaction({ reference: "ps_999", id: 999 }),
    PAYSTACK_OPTIONS,
    anchor,
  );
  assert.notEqual(buildIdempotencyKey(first), buildIdempotencyKey(second));
  const storedFirst = await ingestPaymentEvent(store, first, {
    now: NOW_EPOCH,
  });
  const storedSecond = await ingestPaymentEvent(store, second, {
    now: NOW_EPOCH,
  });
  assert.notEqual(storedFirst.event.event_id, storedSecond.event.event_id);
  const stored = await listPaymentEvents(store);
  assert.equal(stored.length, 2);
});

test("ids: event identity is deterministic and prefixed", () => {
  const draft = paystackDraft({
    transactionId: "mk_txn_a",
    merchantReference: "mk_txn_a",
  });
  const key = buildIdempotencyKey(draft);
  assert.equal(buildIdempotencyKey(draft), key);
  const id = buildPaymentEventId(key);
  assert.ok(id.startsWith("pevt_"));
  assert.equal(buildPaymentEventId(key), id);
});

test("wallet: a success debit ledger entry normalizes to SUCCESS evidence", async (t) => {
  const store = tempStore(t);
  const entry = walletLedgerEntry();
  const eventOrNull = walletLedgerToPaymentEvent(entry);
  assert.notEqual(eventOrNull, null);
  const event = eventOrNull as PaymentEventInput;
  assert.equal(event.payment_source, "INTERNAL_WALLET");
  assert.equal(event.status, "SUCCESS");
  assert.equal(event.payment_source_reference, "wld_1");
  assert.equal(event.source_event_id, "wl_1");
  assert.equal(event.transaction_id, "mk_txn_c");
  assert.equal(event.merchant_reference, "mk_txn_c");
  assert.equal(event.amount, 1000);
  assert.equal(event.occurred_at, NOW_EPOCH);

  const result = await ingestPaymentEvent(store, event, { now: NOW_EPOCH });
  const report = reconcilePaymentEvents([result.event], TEST_CONFIG);
  const matched = merchantResult(report, "mk_txn_c");
  assert.equal(matched?.outcome, "MATCH");
});

test("wallet: OPENING_BALANCE has no payment semantics; failures map to FAILED", () => {
  assert.equal(
    walletLedgerToPaymentEvent(walletLedgerEntry({ type: "OPENING_BALANCE" })),
    null,
  );
  const failed = walletLedgerToPaymentEvent(
    walletLedgerEntry({ type: "DEBIT_FAILED" }),
  );
  assert.equal(failed?.status, "FAILED");
});

test("manual CSV: imported confidence survives through reconciliation", async (t) => {
  const store = tempStore(t);
  const draft = manualCsvPaymentEvent(
    {
      reference: "mk_txn_d",
      amountMinor: 1000,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "row_1",
    },
    { transactionId: "mk_txn_d" },
  );
  assert.equal(draft.payment_source, "MANUAL_CSV");
  assert.equal(draft.source_confidence, "IMPORTED");
  const { event } = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  const result = merchantResult(report, "mk_txn_d");
  assert.equal(result?.outcome, "MATCH");
  assert.equal(result?.source_attributes.source_confidence, "IMPORTED");
});

test("anchoring: a reference mismatch surfaces missing and unmatched records", async (t) => {
  const store = tempStore(t);
  const draft = paystackDraft({
    transactionId: "mk_txn_b",
    merchantReference: "mk_txn_a",
  });
  const { event } = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  assert.equal(report.summary.totalRecords, 2);
  assert.equal(report.summary.matched, 0);
  assert.equal(report.summary.missingProviderRecords, 1);
  assert.equal(report.summary.unmatchedProviderRecords, 1);
  const outcomes = report.results.map((result) => result.outcome);
  assert.ok(outcomes.includes("MISSING_PROVIDER_RECORD"));
  assert.ok(outcomes.includes("UNMATCHED_PROVIDER_RECORD"));
});

test("UNKNOWN is distinct from a missing status", async (t) => {
  const store = tempStore(t);

  const unknownEvent = paystackPaymentEvent(
    paystackTransaction({ status: "halted" }),
    PAYSTACK_OPTIONS,
    { transactionId: "mk_txn_u", merchantReference: "mk_txn_u" },
  );
  const storedUnknown = await ingestPaymentEvent(store, unknownEvent, {
    now: NOW_EPOCH,
  });
  assert.equal(storedUnknown.event.status, "UNKNOWN");
  const unknownReport = reconcilePaymentEvents(
    [storedUnknown.event],
    TEST_CONFIG,
  );
  const unknownResult = merchantResult(unknownReport, "mk_txn_u");
  assert.equal(unknownResult?.outcome, "UNRESOLVED");
  assert.deepEqual(unknownResult?.discrepancy_codes, ["STATUS_UNRESOLVED"]);

  const missing = bankTransferPaymentEvent(
    {
      amountMinor: 1000,
      currency: "NGN",
      occurredAt: NOW,
      sourceEventId: "row_m1",
    },
    { transactionId: "mk_txn_m", merchantReference: "mk_txn_m" },
  );
  assert.equal(missing.status, null);
  const storedMissing = await ingestPaymentEvent(store, missing, {
    now: NOW_EPOCH,
  });
  const missingReport = reconcilePaymentEvents(
    [storedMissing.event],
    TEST_CONFIG,
  );
  const missingResult = merchantResult(missingReport, "mk_txn_m");
  assert.equal(missingResult?.outcome, "MISSING_PROVIDER_RECORD");
  assert.equal(missingResult?.provider_record, null);
});

test("missing timestamps stay missing without fabricating an anomaly", async (t) => {
  const store = tempStore(t);
  const draft = bankTransferPaymentEvent(
    {
      amountMinor: 1000,
      currency: "NGN",
      occurredAt: null,
      status: "SUCCESS",
      sourceEventId: "row_e1",
    },
    { transactionId: "mk_txn_e", merchantReference: "mk_txn_e" },
  );
  assert.equal(draft.occurred_at, null);
  const { event } = await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  const report = reconcilePaymentEvents([event], TEST_CONFIG);
  const result = merchantResult(report, "mk_txn_e");
  assert.equal(result?.outcome, "MATCH");
  assert.deepEqual(result?.discrepancy_codes, []);
});

test("conflicting amounts across two same-anchor events are never silently paired", async (t) => {
  const store = tempStore(t);
  const bank = bankTransferPaymentEvent(
    {
      amountMinor: 1100,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceReference: "bt_1",
    },
    { transactionId: "mk_txn_y", merchantReference: "mk_txn_y" },
  );
  const csv = manualCsvPaymentEvent(
    {
      reference: "mk_txn_y",
      amountMinor: 900,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "csv_2",
    },
    { transactionId: "mk_txn_y" },
  );
  await ingestPaymentEvent(store, bank, { now: NOW_EPOCH });
  await ingestPaymentEvent(store, csv, { now: NOW_EPOCH });
  const events = await listPaymentEvents(store);
  const report = reconcilePaymentEvents(events, TEST_CONFIG);
  assert.equal(report.summary.matched, 0);
  assert.equal(report.summary.heldAmbiguous, 4);
  assert.equal(report.summary.totalRecords, 4);
  for (const result of report.results) {
    assert.equal(result.outcome, "HELD_AMBIGUOUS");
    assert.ok(result.discrepancy_codes.includes("CONFLICTING_ATTRIBUTES"));
  }
});

test("ingest: an event with no source identity is rejected, not collapsed", async (t) => {
  const store = tempStore(t);
  const anonymous = paystackPaymentEvent(
    paystackTransaction({ reference: null, id: null }),
    PAYSTACK_OPTIONS,
    { transactionId: null, merchantReference: null },
  );
  assert.equal(anonymous.payment_source_reference, null);
  assert.equal(anonymous.source_event_id, null);
  await assert.rejects(
    ingestPaymentEvent(store, anonymous, { now: NOW_EPOCH }),
    (error: unknown) =>
      error instanceof PaymentSourceError &&
      error.code === "PAYMENT_EVENT_NO_SOURCE_IDENTITY",
  );
  assert.equal((await listPaymentEvents(store)).length, 0);
});

test("all four sources reach the same reconcile boundary in one report", async (t) => {
  const store = tempStore(t);
  const bank = bankTransferPaymentEvent(
    {
      amountMinor: 5000,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "row_b1",
    },
    { transactionId: "mk_b", merchantReference: "mk_b" },
  );
  const csv = manualCsvPaymentEvent(
    {
      reference: "mk_d",
      amountMinor: 1000,
      currency: "NGN",
      occurredAt: NOW,
      status: "SUCCESS",
      sourceEventId: "row_d1",
    },
    { transactionId: "mk_d" },
  );
  const walletEvent = walletLedgerToPaymentEvent(
    walletLedgerEntry({
      id: "wl_c",
      reference: "wld_c",
      transactionId: "mk_c",
    }),
  );
  assert.notEqual(walletEvent, null);
  const drafts: readonly PaymentEventInput[] = [
    paystackDraft({ transactionId: "mk_a", merchantReference: "mk_a" }),
    bank,
    csv,
    walletEvent as PaymentEventInput,
  ];
  for (const draft of drafts) {
    await ingestPaymentEvent(store, draft, { now: NOW_EPOCH });
  }
  const events = await listPaymentEvents(store);
  assert.equal(events.length, 4);
  const report = reconcilePaymentEvents(events, TEST_CONFIG);
  assert.equal(report.summary.matched, 4);
  assert.equal(report.summary.totalRecords, 8);
  for (const id of ["mk_a", "mk_b", "mk_d", "mk_c"]) {
    assert.equal(merchantResult(report, id)?.outcome, "MATCH");
  }
});
