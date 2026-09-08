import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type {
  PaymentProvider,
  PaymentProviderRequest,
  PaymentProviderResult,
  ProviderRequestContext,
} from "../../src/marketplace/providers/contracts.ts";
import { MockPaymentProvider } from "../../src/marketplace/providers/mock-provider.ts";
import {
  classifyWalletFunding,
  runWalletFunding,
} from "../../src/marketplace/providers/payment-provider.ts";
import {
  createWallet,
  fundWallet,
  WALLET_FIXED_TIMESTAMP,
} from "../../src/marketplace/wallet.ts";
import type { MockProviderScenario } from "../../src/marketplace/types.ts";

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-payment-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function context(
  scenario: MockProviderScenario,
  overrides: Partial<ProviderRequestContext> = {},
): ProviderRequestContext {
  return {
    transactionId: "txn_fund_001",
    customerId: "cus_demo",
    serviceId: "svc_wallet_funding",
    providerId: "mock_payment_provider",
    providerName: "Mock Payment Provider",
    requestId: "req_fund_001",
    correlationId: "corr_fund_001",
    attemptNumber: 1,
    customerReference: "cust_demo",
    idempotencyKey: "idem_fund_001",
    requestedAt: NOW,
    scenario,
    amountMinor: 100_000,
    currency: "NGN",
    metadata: {},
    ...overrides,
  };
}

function paymentRequest(): PaymentProviderRequest {
  return {
    paymentIntentId: "pi_fund_001",
    paymentReference: "pay_ref_001",
    authorizationState: "REQUESTED",
    settlementState: "PENDING",
    amountMinor: 100_000,
    currency: "NGN",
  };
}

test("funding success classifies as funded with canonical success", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("SUCCESS"),
    paymentRequest(),
  );

  assert.equal(decision.funded, true);
  assert.equal(decision.failed, false);
  assert.equal(decision.pending, false);
  assert.equal(decision.providerResult.canonicalPaymentStatus, "SUCCESS");
  assert.equal(decision.providerResult.providerStatus, "PROVIDER_SUCCESS");
});

test("funding failure is classified as failed", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("FAILED"),
    paymentRequest(),
  );

  assert.equal(decision.failed, true);
  assert.equal(decision.funded, false);
  assert.equal(decision.providerResult.canonicalPaymentStatus, "FAILED");
});

test("funding pending stays pending without confirmed movement", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("PENDING"),
    paymentRequest(),
  );

  assert.equal(decision.pending, true);
  assert.equal(decision.funded, false);
  assert.equal(decision.providerResult.canonicalPaymentStatus, "PENDING");
});

test("funding timeout is pending with no confirmation facts", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("TIMEOUT"),
    paymentRequest(),
  );

  assert.equal(decision.pending, true);
  assert.equal(decision.providerResult.providerReference, null);
  assert.equal(decision.providerResult.reconciliationFacts, null);
});

test("duplicate funding is funded once with a duplicate flag", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("DUPLICATE"),
    paymentRequest(),
  );

  assert.equal(decision.funded, true);
  assert.equal(decision.duplicate, true);
  assert.equal(decision.providerResult.providerStatus, "PROVIDER_DUPLICATE");
});

test("funding mismatch is flagged without collapsing provider status into payment state", async () => {
  const provider = new MockPaymentProvider();
  const decision = await runWalletFunding(
    provider,
    context("MISMATCH"),
    paymentRequest(),
  );

  assert.equal(decision.mismatch, true);
  assert.equal(decision.funded, true);
  assert.equal(decision.providerResult.canonicalPaymentStatus, "SUCCESS");
  assert.equal(decision.providerResult.attemptStatus, "MISMATCH");
});

test("reversal and refund scenarios surface provider lifecycle states", async () => {
  const provider = new MockPaymentProvider();

  const reversed = await runWalletFunding(
    provider,
    context("REVERSED"),
    paymentRequest(),
  );
  const refundPending = await runWalletFunding(
    provider,
    context("REFUND_PENDING"),
    paymentRequest(),
  );
  const refunded = await runWalletFunding(
    provider,
    context("REFUND_COMPLETED"),
    paymentRequest(),
  );

  assert.equal(reversed.reversed, true);
  assert.equal(reversed.providerResult.canonicalPaymentStatus, "CANCELLED");
  assert.equal(refundPending.refundPending, true);
  assert.equal(
    refundPending.providerResult.providerStatus,
    "PROVIDER_REFUND_PENDING",
  );
  assert.equal(refunded.refunded, true);
  assert.equal(
    refunded.providerResult.providerStatus,
    "PROVIDER_REFUND_COMPLETED",
  );
});

test("classifyWalletFunding handles each provider result deterministically", async () => {
  const provider = new MockPaymentProvider();
  const results = await Promise.all(
    (
      [
        "SUCCESS",
        "FAILED",
        "PENDING",
        "TIMEOUT",
        "DUPLICATE",
        "MISMATCH",
      ] as const
    ).map(async (scenario) =>
      provider.execute(context(scenario), paymentRequest()),
    ),
  );
  const classified = results.map(classifyWalletFunding);

  assert.deepEqual(
    classified.map((decision) => decision.funded),
    [true, false, false, false, true, true],
  );
  assert.deepEqual(
    classified.map((decision) => decision.failed),
    [false, true, false, false, false, false],
  );
  assert.equal(classified[3]?.pending, true);
});

test("mock payment provider is deterministic for identical context and request", async () => {
  const provider = new MockPaymentProvider();
  const first = await provider.execute(context("SUCCESS"), paymentRequest());
  const second = await provider.execute(context("SUCCESS"), paymentRequest());

  assert.deepEqual(second, first);
});

test("wallet layer depends on the PaymentProvider interface, not the concrete mock", async (t) => {
  const store = tempStore(t);
  await createWallet(store, {
    customerId: "cus_demo",
    currency: "NGN",
    openingBalanceMinor: 500_000,
    now: NOW,
  });

  const fakeProvider: PaymentProvider = {
    mode: "MOCK",
    id: "fake_payment_adapter",
    providerId: "fake_payment_provider",
    providerName: "Fake Payment Provider",
    serviceKinds: ["WALLET_FUNDING"],
    async execute(ctx, request): Promise<PaymentProviderResult> {
      return {
        providerId: this.providerId,
        providerName: this.providerName,
        serviceKind: "WALLET_FUNDING",
        scenario: "SUCCESS",
        providerReference: "pay_fake_001",
        requestId: ctx.requestId,
        correlationId: ctx.correlationId,
        attemptNumber: 1,
        requestTimestamp: ctx.requestedAt,
        responseTimestamp: NOW,
        providerStatus: "PROVIDER_SUCCESS",
        providerStatusCode: "MOCK_SUCCESS",
        providerMessage: "Fake provider funded the wallet.",
        attemptStatus: "SUCCESS",
        canonicalPaymentStatus: "SUCCESS",
        amountMinor: request.amountMinor,
        currency: request.currency,
        latencyMs: 1,
        sourceAttributes: { simulated: "true", scenario: "SUCCESS" },
        reconciliationFacts: {
          providerId: this.providerId,
          providerReference: "pay_fake_001",
          amountMinor: request.amountMinor,
          currency: request.currency,
          canonicalStatus: "SUCCESS",
          occurredAt: NOW,
          sourceAttributes: {},
        },
        safeMetadata: { simulated: "true" },
        duplicateResults: [],
        simulated: true,
        paymentReference: request.paymentReference,
        authorizationState: "AUTHORIZED",
        settlementState: "SETTLED",
      };
    },
  };

  const outcome = await fundWallet(store, fakeProvider, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
    relatedTransactionId: "txn_fake_provider",
  });

  assert.equal(outcome.lifecycle, "SETTLED");
  assert.equal(outcome.balance.availableMinor, 600_000);
  assert.equal(outcome.providerResult.providerName, "Fake Payment Provider");
});

test("registry payment adapter satisfies the PaymentProvider contract used by the wallet", () => {
  const registry = createMockProviderRegistry();
  const provider: PaymentProvider = registry.payment;

  assert.equal(provider.id, "mock_payment_adapter");
  assert.equal(provider.mode, "MOCK");
  assert.equal(provider.serviceKinds.includes("WALLET_FUNDING"), true);
  assert.equal(typeof provider.execute, "function");
});
