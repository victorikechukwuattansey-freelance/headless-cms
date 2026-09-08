import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileRecords } from "../../../src/application/reconcile-records.ts";
import type {
  CanonicalPaymentStatus,
  Outcome,
  ReconciliationCode,
  ReconciliationConfig,
} from "../../../src/domain/model.ts";
import type { TransactionReconciliationFacts } from "../../src/marketplace/transactions.ts";
import {
  buildMarketplaceReconcileInput,
  marketplaceReconcileConfig,
  type MarketplaceReconcileContext,
} from "../../src/marketplace/reconcile-bridge.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import type {
  MockProviderScenario,
  ProviderAttempt,
} from "../../src/marketplace/types.ts";

const NOW = "2026-01-01T12:00:00.000Z";
const NOW_EPOCH = Date.parse(NOW);
const LATER = "2026-01-01T12:05:00.000Z";

const TEST_CONFIG: ReconciliationConfig = {
  timestampValidation: { enabled: true, toleranceMs: 60_000 },
  supportedCurrencies: ["NGN", "USD", "GBP"],
};

interface ScenarioExpectation {
  readonly merchantStatus: CanonicalPaymentStatus;
  readonly providerPresent: boolean;
  readonly providerStatus: CanonicalPaymentStatus | null;
  readonly providerAmount: number | null;
  readonly outcome: Outcome;
  readonly codes: readonly ReconciliationCode[];
  readonly flags: readonly ReconciliationCode[];
}

const SCENARIOS: Readonly<Record<MockProviderScenario, ScenarioExpectation>> = {
  SUCCESS: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "SUCCESS",
    providerAmount: 1000,
    outcome: "MATCH",
    codes: [],
    flags: [],
  },
  FAILED: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "FAILED",
    providerAmount: 1000,
    outcome: "DISCREPANCY",
    codes: ["STATUS_MISMATCH"],
    flags: ["STATUS_MISMATCH"],
  },
  PENDING: {
    merchantStatus: "PENDING",
    providerPresent: false,
    providerStatus: null,
    providerAmount: null,
    outcome: "MISSING_PROVIDER_RECORD",
    codes: [],
    flags: ["STATUS_UNRESOLVED"],
  },
  TIMEOUT: {
    merchantStatus: "PENDING",
    providerPresent: false,
    providerStatus: null,
    providerAmount: null,
    outcome: "MISSING_PROVIDER_RECORD",
    codes: [],
    flags: ["STATUS_UNRESOLVED"],
  },
  DUPLICATE: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "SUCCESS",
    providerAmount: 1000,
    outcome: "MATCH",
    codes: [],
    flags: ["DUPLICATE_PROVIDER_RECORD"],
  },
  MISMATCH: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "SUCCESS",
    providerAmount: 1100,
    outcome: "DISCREPANCY",
    codes: ["AMOUNT_MISMATCH"],
    flags: ["AMOUNT_MISMATCH"],
  },
  PARTIAL_SUCCESS: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "SUCCESS",
    providerAmount: 500,
    outcome: "DISCREPANCY",
    codes: ["AMOUNT_MISMATCH"],
    flags: ["AMOUNT_MISMATCH"],
  },
  REVERSED: {
    merchantStatus: "CANCELLED",
    providerPresent: true,
    providerStatus: "CANCELLED",
    providerAmount: 1000,
    outcome: "MATCH",
    codes: [],
    flags: [],
  },
  REFUND_PENDING: {
    merchantStatus: "PENDING",
    providerPresent: false,
    providerStatus: null,
    providerAmount: null,
    outcome: "MISSING_PROVIDER_RECORD",
    codes: [],
    flags: [],
  },
  REFUND_COMPLETED: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "SUCCESS",
    providerAmount: 1000,
    outcome: "MATCH",
    codes: [],
    flags: [],
  },
  UNKNOWN: {
    merchantStatus: "SUCCESS",
    providerPresent: true,
    providerStatus: "UNKNOWN",
    providerAmount: 1000,
    outcome: "UNRESOLVED",
    codes: ["STATUS_UNRESOLVED"],
    flags: ["STATUS_UNRESOLVED"],
  },
};

const SCENARIO_LIST: readonly MockProviderScenario[] = [
  "SUCCESS",
  "FAILED",
  "PENDING",
  "TIMEOUT",
  "DUPLICATE",
  "MISMATCH",
  "PARTIAL_SUCCESS",
  "REVERSED",
  "REFUND_PENDING",
  "REFUND_COMPLETED",
  "UNKNOWN",
];

function attempt(overrides: Partial<ProviderAttempt> = {}): ProviderAttempt {
  return {
    id: "patt_demo_1",
    transactionId: "mk_txn_demo",
    providerId: "mock_vtu",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    requestReference: "req_demo_1",
    providerReference: "air_demo_1",
    status: "SUCCESS",
    canonicalStatus: "SUCCESS",
    amountMinor: 1000,
    currency: "NGN",
    latencyMs: 240,
    sourceAttributes: {
      provider_status: "PROVIDER_SUCCESS",
      provider_status_code: "MOCK_SUCCESS",
      provider_message: "Simulated provider completed the request.",
      request_id: "req_demo_1",
      correlation_id: "corr_demo",
      attempt_number: "1",
      provider_reference: "air_demo_1",
      requested_at: NOW,
      responded_at: NOW,
      latency_ms: "240",
      scenario: "SUCCESS",
      simulated: "true",
      provider_id: "mock_vtu",
    },
    attemptedAt: NOW,
    simulated: true,
    ...overrides,
  };
}

function attemptForScenario(
  scenario: MockProviderScenario,
): ProviderAttempt | null {
  switch (scenario) {
    case "TIMEOUT":
      return attempt({
        scenario,
        status: "TIMEOUT",
        canonicalStatus: "UNKNOWN",
        providerReference: null,
        amountMinor: null,
        latencyMs: 15_000,
        sourceAttributes: {
          provider_status: "PROVIDER_TIMEOUT",
          provider_status_code: "MOCK_TIMEOUT",
          provider_message:
            "Simulated provider did not respond before timeout.",
          request_id: "req_demo_1",
          correlation_id: "corr_demo",
          attempt_number: "1",
          requested_at: NOW,
          latency_ms: "15000",
          scenario,
          simulated: "true",
          provider_id: "mock_vtu",
        },
      });
    case "PENDING":
    case "REFUND_PENDING":
      return attempt({
        scenario,
        status: "PENDING",
        canonicalStatus: "PENDING",
      });
    case "FAILED":
      return attempt({ scenario, status: "FAILED", canonicalStatus: "FAILED" });
    case "DUPLICATE":
      return attempt({
        scenario,
        status: "DUPLICATE",
        canonicalStatus: "SUCCESS",
      });
    case "PARTIAL_SUCCESS":
      return attempt({
        scenario,
        status: "SUCCESS",
        canonicalStatus: "SUCCESS",
        amountMinor: 500,
      });
    case "MISMATCH":
      return attempt({
        scenario,
        status: "MISMATCH",
        canonicalStatus: "SUCCESS",
        amountMinor: 1100,
      });
    case "REVERSED":
      return attempt({
        scenario,
        status: "SUCCESS",
        canonicalStatus: "CANCELLED",
      });
    case "REFUND_COMPLETED":
      return attempt({
        scenario,
        status: "SUCCESS",
        canonicalStatus: "SUCCESS",
      });
    case "UNKNOWN":
      return attempt({
        scenario,
        status: "UNKNOWN",
        canonicalStatus: "UNKNOWN",
      });
    default:
      return attempt({ scenario });
  }
}

function facts(
  scenario: MockProviderScenario,
  overrides: Partial<TransactionReconciliationFacts> = {},
): TransactionReconciliationFacts {
  const attemptRow = attemptForScenario(scenario);
  const expectation = SCENARIOS[scenario];
  return {
    transactionId: "mk_txn_demo",
    orderId: "ord_demo",
    customerReference: "cust_demo",
    providerId: "mock_vtu",
    serviceId: "svc_airtime_mtn",
    serviceKind: "AIRTIME",
    scenario,
    expectedAmountMinor: 1000,
    paymentAmountMinor: attemptRow?.amountMinor ?? null,
    providerAmountMinor: attemptRow?.amountMinor ?? null,
    currency: "NGN",
    paymentState: expectation.merchantStatus,
    providerState: attemptRow?.canonicalStatus ?? null,
    fulfillmentState: "PENDING",
    providerReference: attemptRow?.providerReference ?? null,
    requestedAt: NOW,
    respondedAt: attemptRow?.attemptedAt ?? null,
    providerAttemptHistory: attemptRow === null ? [] : [attemptRow],
    evidenceLedgerEntryIds: [],
    reversal: { status: "NONE" },
    refund: { status: "NONE" },
    flags: expectation.flags,
    simulated: true,
    ...overrides,
  };
}

function declinedDebitFacts(): TransactionReconciliationFacts {
  return facts("SUCCESS", {
    paymentState: "FAILED",
    paymentAmountMinor: null,
    providerAmountMinor: null,
    providerReference: null,
    providerState: null,
    providerAttemptHistory: [],
    flags: [],
    respondedAt: null,
  });
}

function context(
  overrides: Partial<MarketplaceReconcileContext> = {},
): MarketplaceReconcileContext {
  return {
    facts: facts("SUCCESS"),
    serviceKind: "AIRTIME",
    artifacts: [],
    resolutionStatus: "NONE",
    config: TEST_CONFIG,
    ...overrides,
  };
}

test("bridge: every scenario produces the documented merchant side", async () => {
  for (const scenario of SCENARIO_LIST) {
    const input = buildMarketplaceReconcileInput(
      context({ facts: facts(scenario) }),
    );
    const expectation = SCENARIOS[scenario];
    const [merchant] = input.merchantPayments;
    assert.equal(merchant.merchant_reference, "mk_txn_demo", scenario);
    assert.equal(merchant.amount, 1000, scenario);
    assert.equal(merchant.currency, "NGN", scenario);
    assert.equal(merchant.status, expectation.merchantStatus, scenario);
    assert.equal(merchant.occurred_at, NOW_EPOCH, scenario);
    assert.equal(merchant.merchant_record_id, "ord_demo", scenario);
  }
});

test("bridge: provider row emission follows the §4.4 policy", () => {
  for (const scenario of SCENARIO_LIST) {
    const input = buildMarketplaceReconcileInput(
      context({ facts: facts(scenario) }),
    );
    const expectation = SCENARIOS[scenario];
    assert.equal(
      input.providerPayments.length,
      expectation.providerPresent ? 1 : 0,
      scenario,
    );
    const provider = input.providerPayments[0];
    if (expectation.providerPresent) {
      assert.equal(provider.amount, expectation.providerAmount, scenario);
      assert.equal(provider.status, expectation.providerStatus, scenario);
      assert.equal(provider.currency, "NGN", scenario);
      assert.equal(provider.provider_id, "mock_vtu", scenario);
      assert.equal(provider.occurred_at, NOW_EPOCH, scenario);
    }
  }
});

test("bridge: no provider row for a declined wallet debit", () => {
  const input = buildMarketplaceReconcileInput(
    context({ facts: declinedDebitFacts() }),
  );
  assert.equal(input.providerPayments.length, 0);
  assert.equal(input.merchantPayments[0]?.status, "FAILED");
});

test("bridge: join key is the marketplace transaction id on both sides, never the provider reference", () => {
  for (const scenario of SCENARIO_LIST) {
    const input = buildMarketplaceReconcileInput(
      context({ facts: facts(scenario) }),
    );
    const merchant = input.merchantPayments[0];
    assert.equal(merchant.merchant_reference, "mk_txn_demo", scenario);
    for (const provider of input.providerPayments) {
      assert.equal(provider.reference, "mk_txn_demo", scenario);
      assert.notEqual(provider.reference, "air_demo_1", scenario);
    }
    if (input.providerPayments.length > 0) {
      assert.equal(
        input.providerPayments[0].reference,
        merchant.merchant_reference,
        scenario,
      );
    }
  }
});

test("bridge: provider reference survives only as source attributes", () => {
  const input = buildMarketplaceReconcileInput(context());
  assert.equal(input.providerSourceAttributes?.length, 1);
  assert.equal(
    input.providerSourceAttributes?.[0]?.provider_reference,
    "air_demo_1",
  );
  assert.equal(
    JSON.stringify(input.providerPayments).includes("air_demo_1"),
    false,
  );
  assert.equal(input.providerPayments[0].reference, "mk_txn_demo");
});

test("bridge: provider source attributes align one-to-one with provider rows", () => {
  for (const scenario of SCENARIO_LIST) {
    const input = buildMarketplaceReconcileInput(
      context({ facts: facts(scenario) }),
    );
    if (input.providerPayments.length === 0) {
      assert.deepEqual(input.providerSourceAttributes, undefined, scenario);
    } else {
      assert.equal(input.providerSourceAttributes?.length, 1, scenario);
    }
  }
});

test("bridge: latest attempt wins when ticketing emits reserve + issue", () => {
  const reserve = attempt({
    id: "patt_demo_1",
    requestReference: "req_demo_1",
    providerReference: "res_demo_1",
    sourceAttributes: { provider_reference: "res_demo_1" },
    attemptedAt: NOW,
  });
  const failedIssue = attempt({
    id: "patt_demo_2",
    requestReference: "req_demo_2",
    providerReference: "iss_demo_2",
    status: "FAILED",
    canonicalStatus: "FAILED",
    sourceAttributes: { provider_reference: "iss_demo_2" },
    attemptedAt: LATER,
  });
  const input = buildMarketplaceReconcileInput(
    context({
      serviceKind: "AIRLINE_TICKET",
      facts: facts("SUCCESS", {
        serviceKind: "AIRLINE_TICKET",
        providerAttemptHistory: [reserve, failedIssue],
        providerReference: "iss_demo_2",
        providerState: "FAILED",
      }),
    }),
  );
  assert.equal(input.providerPayments.length, 1);
  assert.equal(input.providerPayments[0].status, "FAILED");
  assert.equal(
    input.providerSourceAttributes?.[0]?.provider_reference,
    "iss_demo_2",
  );
});

test("bridge: multiple emit scenarios produce identical join-key pairs through the engine", async () => {
  for (const scenario of SCENARIO_LIST) {
    const report = reconcileRecords(
      buildMarketplaceReconcileInput(context({ facts: facts(scenario) })),
    );
    const result = report.results.find(
      (candidate) => candidate.merchant_record !== null,
    );
    const expectation = SCENARIOS[scenario];
    assert.ok(result, `scenario ${scenario} produced no merchant-side result`);
    assert.equal(result.outcome, expectation.outcome, scenario);
    assert.deepEqual(result.discrepancy_codes, expectation.codes, scenario);
  }
});

test("bridge: declined debit resolves to MISSING_PROVIDER_RECORD, never failure", () => {
  const report = reconcileRecords(
    buildMarketplaceReconcileInput(context({ facts: declinedDebitFacts() })),
  );
  const [result] = report.results;
  assert.equal(result.outcome, "MISSING_PROVIDER_RECORD");
});

test("bridge: timeline conversion is ISO to epoch milliseconds", () => {
  const report = reconcileRecords(buildMarketplaceReconcileInput(context()));
  const [result] = report.results;
  assert.equal(result.merchant_record?.occurred_at, NOW_EPOCH);
  assert.equal(result.provider_record?.occurred_at, NOW_EPOCH);
});

test("bridge: temporal tolerance fires only beyond 60s", () => {
  const withinTolerance = reconcileRecords(
    buildMarketplaceReconcileInput(context()),
  );
  assert.equal(withinTolerance.results[0].outcome, "MATCH");

  const wideGap = reconcileRecords(
    buildMarketplaceReconcileInput(
      context({
        facts: facts("SUCCESS", {
          requestedAt: NOW,
          providerAttemptHistory: [attempt({ attemptedAt: LATER })],
        }),
      }),
    ),
  );
  const result = wideGap.results.find(
    (candidate) => candidate.merchant_record !== null,
  );
  assert.equal(result?.outcome, "DISCREPANCY");
  assert.ok(result?.discrepancy_codes.includes("TEMPORAL_ANOMALY"));
});

test("bridge: catalog-aware config carries NGN, USD, GBP with 60s tolerance", () => {
  const config = marketplaceReconcileConfig(buildDemoCatalog());
  assert.deepEqual(config.supportedCurrencies, ["NGN", "USD", "GBP"]);
  assert.deepEqual(config.timestampValidation, {
    enabled: true,
    toleranceMs: 60_000,
  });
});

test("bridge: context config is passed through verbatim as the engine config", () => {
  const input = buildMarketplaceReconcileInput(
    context({ config: TEST_CONFIG }),
  );
  assert.equal(input.config, TEST_CONFIG);
});

test("bridge: multi-currency fixture with NGN, USD and GBP passes engine validation", () => {
  const usdFacts = facts("SUCCESS", {
    currency: "USD",
    expectedAmountMinor: 2500,
    providerAttemptHistory: [
      attempt({
        currency: "USD",
        amountMinor: 2500,
        providerReference: "gift_demo_1",
      }),
    ],
    providerAmountMinor: 2500,
    serviceKind: "GIFT_CARD",
  });
  const gbpFacts = facts("SUCCESS", {
    currency: "GBP",
    expectedAmountMinor: 45000,
    providerAttemptHistory: [
      attempt({
        currency: "GBP",
        amountMinor: 45000,
        providerReference: "air_demo_gbp",
      }),
    ],
    providerAmountMinor: 45000,
    serviceKind: "AIRLINE_TICKET",
  });
  for (const scenarioFacts of [facts("SUCCESS"), usdFacts, gbpFacts]) {
    const report = reconcileRecords(
      buildMarketplaceReconcileInput(
        context({ facts: scenarioFacts, config: TEST_CONFIG }),
      ),
    );
    assert.equal(report.results[0].outcome, "MATCH", scenarioFacts.currency);
  }
});
