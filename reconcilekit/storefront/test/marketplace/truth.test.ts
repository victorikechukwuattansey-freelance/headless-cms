import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  MatchResult,
  Outcome,
  ReconciliationCode,
  ReconciliationReport,
  ReconciliationSummary,
} from "../../../src/domain/model.ts";
import {
  buildMarketplaceTruth,
  buildTransactionTruth,
  findEngineResult,
  toReconciliationSnapshot,
  type TransactionTruth,
  type TruthDeterminationInput,
} from "../../src/marketplace/truth.ts";
import type { MarketplaceReconcileContext } from "../../src/marketplace/reconcile-bridge.ts";
import type { TransactionReconciliationFacts } from "../../src/marketplace/transactions.ts";
import type { ResolutionStatus } from "../../src/marketplace/types.ts";

function summaryFor(outcomes: readonly Outcome[]): ReconciliationSummary {
  return {
    totalRecords: outcomes.length,
    matched: outcomes.filter((o) => o === "MATCH").length,
    discrepancies: outcomes.filter((o) => o === "DISCREPANCY").length,
    unresolved: outcomes.filter((o) => o === "UNRESOLVED").length,
    heldAmbiguous: outcomes.filter((o) => o === "HELD_AMBIGUOUS").length,
    inputErrors: outcomes.filter((o) => o === "INPUT_ERROR").length,
    missingProviderRecords: outcomes.filter(
      (o) => o === "MISSING_PROVIDER_RECORD",
    ).length,
    unmatchedProviderRecords: outcomes.filter(
      (o) => o === "UNMATCHED_PROVIDER_RECORD",
    ).length,
    missingReference: outcomes.filter((o) => o === "MISSING_REFERENCE").length,
    countsByDiscrepancyCode: {
      AMOUNT_MISMATCH: 0,
      CURRENCY_MISMATCH: 0,
      STATUS_MISMATCH: 0,
      TEMPORAL_ANOMALY: 0,
      DUPLICATE_MERCHANT_RECORD: 0,
      DUPLICATE_PROVIDER_RECORD: 0,
      CONFLICTING_ATTRIBUTES: 0,
      STATUS_UNRESOLVED: 0,
    },
  };
}

function resultFor(
  outcome: Outcome,
  codes: readonly ReconciliationCode[] = [],
  notes: readonly string[] = [],
): MatchResult {
  return {
    outcome,
    merchant_record: {
      merchant_reference: "mk_txn_demo",
      amount: 1000,
      currency: "NGN",
      status: "SUCCESS",
      occurred_at: Date.parse("2026-01-01T12:00:00.000Z"),
      merchant_record_id: "ord_demo",
    },
    provider_record:
      outcome === "MISSING_PROVIDER_RECORD" ||
      outcome === "UNMATCHED_PROVIDER_RECORD"
        ? null
        : {
            reference: "mk_txn_demo",
            amount: 1000,
            currency: "NGN",
            status: "SUCCESS",
            occurred_at: Date.parse("2026-01-01T12:00:00.000Z"),
            provider_id: "mock_vtu",
          },
    discrepancy_codes: codes,
    validation_notes: notes,
    source_attributes:
      codes.length > 0 ? { provider_status: "PROVIDER_DECLINED" } : {},
  };
}

function reportWith(result: MatchResult): ReconciliationReport {
  return {
    summary: summaryFor([result.outcome]),
    results: [result],
  };
}

function factsOf(
  overrides: Partial<TransactionReconciliationFacts> = {},
): TransactionReconciliationFacts {
  return {
    transactionId: "mk_txn_demo",
    orderId: "ord_demo",
    customerReference: "cust_demo",
    providerId: "mock_vtu",
    serviceId: "svc_airtime_mtn",
    serviceKind: "AIRTIME",
    scenario: "SUCCESS",
    expectedAmountMinor: 1000,
    paymentAmountMinor: 1000,
    providerAmountMinor: 1000,
    currency: "NGN",
    paymentState: "SUCCESS",
    providerState: "SUCCESS",
    fulfillmentState: "FULFILLED",
    providerReference: "air_demo_1",
    requestedAt: "2026-01-01T12:00:00.000Z",
    respondedAt: "2026-01-01T12:00:00.000Z",
    providerAttemptHistory: [],
    evidenceLedgerEntryIds: [],
    reversal: { status: "NONE" },
    refund: { status: "NONE" },
    flags: [],
    simulated: true,
    ...overrides,
  };
}

function contextOf(
  overrides: Partial<MarketplaceReconcileContext> = {},
): MarketplaceReconcileContext {
  return {
    facts: factsOf(),
    serviceKind: "AIRTIME",
    artifacts: [],
    resolutionStatus: "NONE",
    config: {
      timestampValidation: { enabled: true, toleranceMs: 60_000 },
      supportedCurrencies: ["NGN", "USD", "GBP"],
    },
    ...overrides,
  };
}

function determination(
  overrides: Partial<TruthDeterminationInput> = {},
): TruthDeterminationInput {
  return {
    transactionId: "mk_txn_demo",
    outcome: "MATCH",
    codes: [],
    paymentState: "SUCCESS",
    resolutionStatus: "NONE",
    expectedAmountMinor: 1000,
    currency: "NGN",
    providerAmountMinor: 1000,
    ...overrides,
  };
}

test("truth: MATCH is settlement confirmed — nothing at risk", () => {
  const truth = buildTransactionTruth(determination());
  assert.deepEqual(truth, {
    transactionId: "mk_txn_demo",
    reconcileOutcome: "MATCH",
    customerStatus: "CONFIRMED",
    adminStatus: "HEALTHY",
    moneyAtRisk: false,
    nextAction: "None — payment reconciled.",
    explanation:
      "Reconcile Kit determined MATCH (1000 NGN expected; provider reported 1000 NGN).",
  } satisfies TransactionTruth);
});

test("truth: STATUS_MISMATCH is a provider-side failure, money at risk", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "DISCREPANCY",
      codes: ["STATUS_MISMATCH"],
      providerAmountMinor: 1000,
    }),
  );
  assert.equal(truth.customerStatus, "NEEDS_ATTENTION");
  assert.equal(truth.adminStatus, "PROVIDER_FAILED");
  assert.equal(truth.moneyAtRisk, true);
  assert.equal(
    truth.nextAction,
    "Investigate the discrepancy between the expected and provider records.",
  );
});

test("truth: AMOUNT_MISMATCH maps to the MISMATCH admin status", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "DISCREPANCY",
      codes: ["AMOUNT_MISMATCH"],
      providerAmountMinor: 1100,
    }),
  );
  assert.equal(truth.adminStatus, "MISMATCH");
  assert.equal(truth.moneyAtRisk, true);
});

test("truth: UNRESOLVED stays unresolved, never failure or match", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "UNRESOLVED",
      codes: ["STATUS_UNRESOLVED"],
      paymentState: "SUCCESS",
    }),
  );
  assert.deepEqual(
    [truth.customerStatus, truth.adminStatus],
    ["NEEDS_ATTENTION", "UNRESOLVED"],
  );
  assert.equal(truth.moneyAtRisk, true);
  assert.match(truth.nextAction, /Await provider clarification/);
});

test("truth: missing provider evidence with a pending hold is unresolved, at risk", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "MISSING_PROVIDER_RECORD",
      paymentState: "PENDING",
      providerAmountMinor: null,
    }),
  );
  assert.deepEqual(
    [truth.customerStatus, truth.adminStatus],
    ["PENDING", "PENDING_PROVIDER"],
  );
  assert.equal(truth.moneyAtRisk, true);
});

test("truth: declined wallet debit is a clean failure — no money at risk", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "MISSING_PROVIDER_RECORD",
      paymentState: "FAILED",
      providerAmountMinor: null,
    }),
  );
  assert.deepEqual(
    [truth.customerStatus, truth.adminStatus],
    ["FAILED", "HEALTHY"],
  );
  assert.equal(truth.moneyAtRisk, false);
});

test("truth: resolved MATCH never reports money at risk", () => {
  for (const resolutionStatus of ["REVERSED", "REFUNDED"] as const) {
    const truth = buildTransactionTruth(
      determination({
        outcome: "MATCH",
        paymentState: resolutionStatus === "REVERSED" ? "CANCELLED" : "SUCCESS",
        resolutionStatus: resolutionStatus,
      }),
    );
    assert.equal(truth.moneyAtRisk, false, resolutionStatus);
    assert.equal(truth.customerStatus, resolutionStatus, resolutionStatus);
    assert.equal(truth.adminStatus, "HEALTHY", resolutionStatus);
  }
});

test("truth: REFUND_PENDING resolution keeps the refund queue visible and money at risk", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "MISSING_PROVIDER_RECORD",
      paymentState: "PENDING",
      resolutionStatus: "REFUND_PENDING",
      providerAmountMinor: null,
    }),
  );
  assert.equal(truth.customerStatus, "REFUND_PENDING");
  assert.equal(truth.adminStatus, "REFUND_QUEUE");
  assert.equal(truth.moneyAtRisk, true);
});

test("truth: buildMarketplaceTruth wires the engine result and facts", () => {
  const report = reportWith(resultFor("DISCREPANCY", ["STATUS_MISMATCH"], []));
  const truth = buildMarketplaceTruth(
    report,
    contextOf({ facts: factsOf({ paymentState: "SUCCESS" }) }),
  );
  assert.equal(truth.reconcileOutcome, "DISCREPANCY");
  assert.equal(truth.adminStatus, "PROVIDER_FAILED");
  assert.equal(truth.moneyAtRisk, true);
  assert.equal(truth.transactionId, "mk_txn_demo");
});

test("truth: no definitive provider evidence wording when provider amount is absent", () => {
  const truth = buildTransactionTruth(
    determination({
      outcome: "MISSING_PROVIDER_RECORD",
      paymentState: "PENDING",
      providerAmountMinor: null,
    }),
  );
  assert.match(truth.explanation, /no definitive provider evidence recorded/);
});

test("truth: toReconciliationSnapshot projects the engine result", () => {
  const snapshot = toReconciliationSnapshot(
    resultFor("DISCREPANCY", ["AMOUNT_MISMATCH"], ["amount mismatch"]),
  );
  assert.deepEqual(snapshot, {
    outcome: "DISCREPANCY",
    codes: ["AMOUNT_MISMATCH"],
    notes: ["amount mismatch"],
    sourceAttributes: { provider_status: "PROVIDER_DECLINED" },
  });
});

test("truth: findEngineResult resolves the merchant-side row by order id", () => {
  const report = reportWith(resultFor("UNRESOLVED", ["STATUS_UNRESOLVED"], []));
  const found = findEngineResult(report, "ord_demo", "mk_txn_demo");
  assert.equal(found.outcome, "UNRESOLVED");
});

test("truth: findEngineResult throws when no merchant-side row exists", () => {
  const report: ReconciliationReport = {
    summary: summaryFor([]),
    results: [],
  };
  assert.throws(
    () => findEngineResult(report, "ord_missing", "mk_txn_missing"),
    /no engine result/,
  );
});
