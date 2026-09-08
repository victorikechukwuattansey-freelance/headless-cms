import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type {
  MarketplacePaymentRecord,
  WalletLedgerEntry,
  WalletLedgerType,
} from "../../src/marketplace/types.ts";
import {
  advancePaymentLifecycle,
  checkLedgerConsistency,
  completeRefund,
  createLedgerEntry,
  createWallet,
  debitWallet,
  describePaymentLifecycle,
  deriveWalletBalance,
  fundWallet,
  getWallet,
  getWalletBalance,
  initiateRefund,
  InvalidPaymentTransitionError,
  paymentLifecycleToCanonical,
  reverseDebit,
  settlePayment,
  toWalletPaymentRecord,
  WALLET_FIXED_TIMESTAMP,
} from "../../src/marketplace/wallet.ts";

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-wallet-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function entry(
  input: Partial<WalletLedgerEntry> & { readonly type: WalletLedgerType },
): WalletLedgerEntry {
  return {
    id: input.id ?? "entry_1",
    walletId: input.walletId ?? "wl_cus_demo",
    transactionId: input.transactionId ?? null,
    type: input.type,
    amountMinor: input.amountMinor ?? 0,
    currency: input.currency ?? "NGN",
    status: input.status ?? "POSTED",
    reference: input.reference ?? "ref_1",
    occurredAt: input.occurredAt ?? NOW,
    metadata: input.metadata ?? {},
    simulated: true,
  };
}

async function newWallet(
  store: JsonlStore,
  customerId = "cus_demo",
  opening = 500_000,
) {
  return createWallet(store, {
    customerId,
    currency: "NGN",
    openingBalanceMinor: opening,
    now: NOW,
  });
}

test("wallet balance applies debit refund and reversal entries", () => {
  const balance = deriveWalletBalance("wallet_1", "NGN", [
    entry({
      id: "e1",
      walletId: "wallet_1",
      type: "OPENING_BALANCE",
      amountMinor: 500_000,
    }),
    entry({
      id: "e2",
      walletId: "wallet_1",
      type: "DEBIT_SUCCESS",
      amountMinor: 100_000,
      transactionId: "txn_1",
    }),
    entry({
      id: "e3",
      walletId: "wallet_1",
      type: "REFUND_COMPLETED",
      amountMinor: 25_000,
      transactionId: "txn_1",
    }),
    entry({
      id: "e4",
      walletId: "wallet_1",
      type: "REVERSAL_COMPLETED",
      amountMinor: 50_000,
      transactionId: "txn_2",
    }),
  ]);

  assert.equal(balance.availableMinor, 475_000);
  assert.equal(balance.currency, "NGN");
});

test("pending debit affects pending balance, not confirmed available balance", () => {
  const balance = deriveWalletBalance("wallet_1", "NGN", [
    entry({
      id: "e1",
      walletId: "wallet_1",
      type: "OPENING_BALANCE",
      amountMinor: 500_000,
    }),
    entry({
      id: "e2",
      walletId: "wallet_1",
      type: "DEBIT_PENDING",
      amountMinor: 40_000,
      transactionId: "txn_1",
    }),
    entry({
      id: "e3",
      walletId: "wallet_1",
      type: "SETTLEMENT_PENDING",
      amountMinor: 10_000,
      transactionId: "txn_2",
    }),
  ]);

  assert.equal(balance.availableMinor, 500_000);
  assert.equal(balance.pendingMinor, 50_000);
});

test("failed operations do not change available balance", () => {
  const balance = deriveWalletBalance("wallet_1", "NGN", [
    entry({
      id: "e1",
      walletId: "wallet_1",
      type: "OPENING_BALANCE",
      amountMinor: 500_000,
    }),
    entry({
      id: "e2",
      walletId: "wallet_1",
      type: "FUNDING_FAILED",
      amountMinor: 10_000,
    }),
    entry({
      id: "e3",
      walletId: "wallet_1",
      type: "DEBIT_FAILED",
      amountMinor: 20_000,
      transactionId: "txn_1",
    }),
    entry({
      id: "e4",
      walletId: "wallet_1",
      type: "AUTHORIZATION_FAILED",
      amountMinor: 20_000,
      transactionId: "txn_2",
    }),
  ]);

  assert.equal(balance.availableMinor, 500_000);
});

test("duplicate debit decreases available balance twice and is detected", () => {
  const entries = [
    entry({
      id: "e1",
      walletId: "wallet_1",
      type: "OPENING_BALANCE",
      amountMinor: 100_000,
      reference: "ref_opening",
    }),
    entry({
      id: "e2",
      walletId: "wallet_1",
      type: "DEBIT_SUCCESS",
      amountMinor: 30_000,
      transactionId: "txn_1",
    }),
    entry({
      id: "e3",
      walletId: "wallet_1",
      type: "DUPLICATE_DEBIT",
      amountMinor: 30_000,
      transactionId: "txn_1",
      reference: "ref_2",
    }),
  ];

  const balance = deriveWalletBalance("wallet_1", "NGN", entries);
  const report = checkLedgerConsistency("wallet_1", "NGN", entries);

  assert.equal(balance.availableMinor, 40_000);
  assert.equal(report.duplicateDebitDetected, true);
  assert.equal(report.consistent, true);
});

test("ledger consistency detects foreign wallet entries and negative balance", () => {
  const report = checkLedgerConsistency("wallet_1", "NGN", [
    entry({
      id: "e1",
      walletId: "wallet_1",
      type: "OPENING_BALANCE",
      amountMinor: 100_000,
    }),
    entry({
      id: "e2",
      walletId: "wallet_other",
      type: "OPENING_BALANCE",
      amountMinor: 999_999,
    }),
    entry({
      id: "e3",
      walletId: "wallet_1",
      type: "DEBIT_SUCCESS",
      amountMinor: 150_000,
      transactionId: "txn_1",
    }),
  ]);

  assert.equal(report.totalEntries, 2);
  assert.equal(report.consistent, false);
  assert.equal(
    report.violations.some((violation) => violation.includes("negative")),
    true,
  );
});

test("createWallet writes a wallet and an opening ledger entry", async (t) => {
  const store = tempStore(t);
  const outcome = await newWallet(store);

  const stored = await store.readLatestById("wallets", outcome.wallet.id);
  const ledger = await store.readAll<WalletLedgerEntry>("wallet_ledger");

  assert.equal(
    (stored as { customerId?: string } | null)?.customerId,
    "cus_demo",
  );
  assert.equal(outcome.wallet.status, "ACTIVE");
  assert.equal(outcome.wallet.simulated, true);
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0]?.type, "OPENING_BALANCE");
  assert.equal(ledger[0]?.status, "POSTED");
  assert.equal(ledger[0]?.amountMinor, 500_000);
  assert.equal(outcome.balance.availableMinor, 500_000);
});

test("getWallet derives balance from persisted ledger, not a stored mutable balance", async (t) => {
  const store = tempStore(t);
  await newWallet(store);
  await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_demo_001",
    customerId: "cus_demo",
    serviceId: "svc_airtime",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  const wallet = await getWallet(store, "cus_demo");
  assert.equal(wallet?.wallet.currency, "NGN");
  assert.equal(wallet?.balance.availableMinor, 400_000);
  const walletRecord = await store.readAll("wallets");
  assert.equal(
    "balance" in ((walletRecord[0] as Record<string, unknown>) ?? {}),
    false,
  );
});

test("successful wallet funding credits the wallet and leaves a ledger trail", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  const outcome = await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
    relatedTransactionId: "txn_fund_001",
  });

  assert.equal(outcome.lifecycle, "SETTLED");
  assert.equal(outcome.providerResult.canonicalPaymentStatus, "SUCCESS");
  assert.equal(outcome.balance.availableMinor, 600_000);
  assert.deepEqual(
    outcome.ledgerEntries.map((entry) => entry.type),
    ["FUNDING_INITIATED", "FUNDING_SUCCESS"],
  );
  assert.equal(outcome.evidence.internalTransactionId, "txn_fund_001");
  assert.equal(outcome.evidence.paymentState, "SETTLED");
});

test("failed wallet funding does not move the balance and preserves distinct statuses", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  const outcome = await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "FAILED",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "FAILED");
  assert.equal(outcome.providerResult.providerStatus, "PROVIDER_FAILED");
  assert.equal(outcome.providerResult.canonicalPaymentStatus, "FAILED");
  assert.equal(outcome.balance.availableMinor, 500_000);
  assert.equal(
    outcome.ledgerEntries.some((entry) => entry.type === "FUNDING_FAILED"),
    true,
  );
  assert.equal(outcome.evidence.providerRawStatus, "PROVIDER_FAILED");
});

test("pending wallet funding stays pending with no confirmed balance movement", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  const outcome = await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "PENDING",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "PENDING");
  assert.equal(outcome.providerResult.canonicalPaymentStatus, "PENDING");
  assert.equal(outcome.balance.availableMinor, 500_000);
  assert.equal(outcome.balance.pendingMinor, 0);
});

test("funding is deterministic: same input produces identical ledger entries", async (t) => {
  const storeA = tempStore(t);
  const storeB = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(storeA);
  await newWallet(storeB);

  const input = {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 25_000,
    currency: "NGN",
    scenario: "SUCCESS" as const,
    now: NOW,
    relatedTransactionId: "txn_fund_deterministic",
  };
  const first = await fundWallet(storeA, registry.payment, input);
  const second = await fundWallet(storeB, registry.payment, input);

  assert.deepEqual(second.ledgerEntries, first.ledgerEntries);
  assert.deepEqual(second.balance, first.balance);
  assert.deepEqual(second.evidence, first.evidence);
});

test("authorization approves and declines through the lifecycle", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const approved = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_auth_1",
    customerId: "cus_demo",
    serviceId: "svc_data",
    amountMinor: 10_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });
  const failStore = tempStore(t);
  await newWallet(failStore);
  const declined = await debitWallet(failStore, {
    walletId: "wl_cus_demo",
    transactionId: "txn_auth_2",
    customerId: "cus_demo",
    serviceId: "svc_data",
    amountMinor: 10_000,
    currency: "NGN",
    scenario: "FAILED",
    now: NOW,
  });

  assert.equal(approved.lifecycle, "SETTLED");
  assert.equal(declined.lifecycle, "FAILED");
  assert.equal(
    declined.ledgerEntries.some((entry) => entry.type === "DEBIT_FAILED"),
    true,
  );
});

test("successful wallet debit reduces available balance", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_debit_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "SETTLED");
  assert.equal(outcome.balance.availableMinor, 400_000);
  assert.deepEqual(
    outcome.ledgerEntries.map((entry) => entry.type),
    ["DEBIT_SUCCESS"],
  );
});

test("failed debit leaves balance unchanged and records the failure reason", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_debit_fail",
    customerId: "cus_demo",
    serviceId: "svc_data",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "FAILED",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "FAILED");
  assert.equal(outcome.balance.availableMinor, 500_000);
  assert.equal(outcome.ledgerEntries[0]?.type, "DEBIT_FAILED");
  assert.equal(outcome.evidence.metadata.reason, "DEBIT_FAILED");
});

test("insufficient balance rejects the debit with a distinct reason", async (t) => {
  const store = tempStore(t);
  await newWallet(store, "cus_low", 5_000);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_low",
    transactionId: "txn_debit_low",
    customerId: "cus_low",
    serviceId: "svc_electricity",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "FAILED");
  assert.equal(outcome.ledgerEntries[0]?.type, "DEBIT_FAILED");
  assert.equal(outcome.evidence.metadata.reason, "INSUFFICIENT_BALANCE");
  assert.equal(outcome.balance.availableMinor, 5_000);
});

test("pending debit creates a pending hold, not an available deduction", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_debit_pending",
    customerId: "cus_demo",
    serviceId: "svc_electricity",
    amountMinor: 50_000,
    currency: "NGN",
    scenario: "PENDING",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "PENDING");
  assert.equal(outcome.balance.availableMinor, 500_000);
  assert.equal(outcome.balance.pendingMinor, 50_000);
  assert.equal(outcome.ledgerEntries[0]?.type, "DEBIT_PENDING");
});

test("payment success after service failure keeps payment and fulfillment states distinct", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_voucher",
    customerId: "cus_demo",
    serviceId: "svc_voucher",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  const serviceFailed = {
    ...outcome.evidence,
    fulfillmentState: "FAILED" as const,
  };
  const paymentRecord = toWalletPaymentRecord(serviceFailed, "ord_voucher");

  assert.equal(serviceFailed.paymentState, "SETTLED");
  assert.equal(serviceFailed.providerStatus, "SUCCESS");
  assert.equal(serviceFailed.fulfillmentState, "FAILED");
  assert.equal(paymentRecord.status, "SUCCESS");
  assert.equal(paymentRecord.walletReference, serviceFailed.walletReference);
});

test("reversal after a successful debit restores the balance and completes lifecycle", async (t) => {
  const store = tempStore(t);
  await newWallet(store);
  await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_reverse_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  const outcome = await reverseDebit(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_reverse_1",
    amountMinor: 100_000,
    currency: "NGN",
    now: NOW,
  });

  assert.equal(outcome.lifecycle, "REVERSED");
  assert.equal(outcome.balance.availableMinor, 500_000);
  assert.deepEqual(
    outcome.ledgerEntries.map((entry) => entry.type),
    ["REVERSAL_INITIATED", "REVERSAL_COMPLETED"],
  );
  assert.equal(outcome.evidence.reversalState, "COMPLETED");
  assert.equal(outcome.evidence.paymentState, "REVERSED");
});

test("refund pending then completed restores balance only at completion", async (t) => {
  const store = tempStore(t);
  await newWallet(store);
  await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_refund_1",
    customerId: "cus_demo",
    serviceId: "svc_data",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  const pending = await initiateRefund(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_refund_1",
    amountMinor: 100_000,
    currency: "NGN",
    now: NOW,
  });
  assert.equal(pending.lifecycle, "REFUND_PENDING");
  assert.equal(pending.balance.availableMinor, 400_000);
  assert.equal(pending.evidence.refundState, "PENDING");
  assert.deepEqual(
    pending.ledgerEntries.map((entry) => entry.type),
    ["REFUND_INITIATED", "REFUND_PENDING"],
  );

  const completed = await completeRefund(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_refund_1",
    amountMinor: 100_000,
    currency: "NGN",
    now: NOW,
  });
  assert.equal(completed.lifecycle, "REFUNDED");
  assert.equal(completed.balance.availableMinor, 500_000);
  assert.equal(completed.evidence.refundState, "COMPLETED");
  assert.equal(completed.ledgerEntries[0]?.type, "REFUND_COMPLETED");
});

test("duplicate debit scenario leaves two inspectable debit ledger entries", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_dup_1",
    customerId: "cus_demo",
    serviceId: "svc_internet",
    amountMinor: 30_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
    duplicate: true,
  });

  assert.deepEqual(
    outcome.ledgerEntries.map((entry) => entry.type),
    ["DEBIT_SUCCESS", "DUPLICATE_DEBIT"],
  );
  assert.equal(outcome.balance.availableMinor, 440_000);
  const all = await store.readAll<WalletLedgerEntry>("wallet_ledger");
  assert.equal(
    checkLedgerConsistency("wl_cus_demo", "NGN", all).duplicateDebitDetected,
    true,
  );
});

test("payment provider mismatch is preserved as a settlement mismatch on the trail", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  const outcome = await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "MISMATCH",
    now: NOW,
    relatedTransactionId: "txn_fund_mismatch",
  });

  assert.equal(
    outcome.ledgerEntries.some((entry) => entry.type === "SETTLEMENT_MISMATCH"),
    true,
  );
  assert.equal(outcome.providerResult.attemptStatus, "MISMATCH");
  assert.equal(outcome.evidence.providerRawStatus, "PROVIDER_MISMATCH");
});

test("amount discrepancy settlement records expected and actual amounts on evidence", async (t) => {
  const store = tempStore(t);
  await newWallet(store);

  const outcome = await settlePayment(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_amount",
    amountMinor: 10_000,
    currency: "NGN",
    match: false,
    now: NOW,
  });

  assert.deepEqual(
    outcome.ledgerEntries.map((entry) => entry.type),
    ["SETTLEMENT_PENDING", "SETTLEMENT_MISMATCH"],
  );
  assert.equal(outcome.evidence.amountMinor, 10_000);
  assert.equal(outcome.evidence.providerStatus, "UNKNOWN");
  assert.equal(outcome.evidence.attemptStatus, "MISMATCH");
});

test("payment lifecycle state machine enforces valid transitions", () => {
  assert.equal(
    advancePaymentLifecycle("INITIATED", "AUTHORIZATION_REQUESTED"),
    "PENDING",
  );
  assert.equal(
    advancePaymentLifecycle("PENDING", "AUTHORIZATION_APPROVED"),
    "AUTHORIZED",
  );
  assert.equal(
    advancePaymentLifecycle("AUTHORIZED", "DEBIT_SUCCESS"),
    "SETTLED",
  );
  assert.equal(
    advancePaymentLifecycle("SETTLED", "REVERSAL_INITIATED"),
    "REVERSED",
  );
  assert.equal(
    advancePaymentLifecycle("SETTLED", "REFUND_INITIATED"),
    "REFUND_PENDING",
  );
  assert.equal(
    advancePaymentLifecycle("REFUND_PENDING", "REFUND_COMPLETED"),
    "REFUNDED",
  );
  assert.equal(advancePaymentLifecycle("AUTHORIZED", "DEBIT_FAILED"), "FAILED");

  assert.throws(
    () => advancePaymentLifecycle("INITIATED", "REVERSAL_COMPLETED"),
    InvalidPaymentTransitionError,
  );
});

test("payment lifecycle maps to canonical ReconcileKit statuses without leaking provider status", () => {
  assert.equal(paymentLifecycleToCanonical("SETTLED"), "SUCCESS");
  assert.equal(paymentLifecycleToCanonical("AUTHORIZED"), "PENDING");
  assert.equal(paymentLifecycleToCanonical("PENDING"), "PENDING");
  assert.equal(paymentLifecycleToCanonical("FAILED"), "FAILED");
  assert.equal(paymentLifecycleToCanonical("REVERSED"), "CANCELLED");
  assert.equal(paymentLifecycleToCanonical("REFUND_PENDING"), "PENDING");
  assert.equal(paymentLifecycleToCanonical("REFUNDED"), "SUCCESS");
  assert.equal(describePaymentLifecycle("SETTLED").moneyAtRisk, false);
  assert.equal(describePaymentLifecycle("AUTHORIZED").moneyAtRisk, true);
});

test("reconcile-ready evidence preserves every field required for the Phase 2F boundary", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  const outcome = await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 250_000,
    currency: "NGN",
    scenario: "DUPLICATE",
    now: NOW,
    relatedTransactionId: "txn_dup_fund",
  });

  const evidence = outcome.evidence;
  assert.equal(evidence.internalTransactionId, "txn_dup_fund");
  assert.equal(evidence.walletReference.length > 0, true);
  assert.equal(evidence.paymentReference.length > 0, true);
  assert.equal(evidence.providerReference !== null, true);
  assert.equal(evidence.amountMinor, 250_000);
  assert.equal(evidence.currency, "NGN");
  assert.equal(evidence.occurredAt, NOW);
  assert.equal(evidence.paymentState, "SETTLED");
  assert.equal(evidence.providerStatus, "SUCCESS");
  assert.equal(evidence.fulfillmentState, "NOT_STARTED");
  assert.equal(evidence.reversalState, "NONE");
  assert.equal(evidence.refundState, "NONE");
  assert.equal(evidence.scenario, "DUPLICATE");
  assert.equal(evidence.simulated, true);
  assert.equal(evidence.ledgerEntryIds.length > 0, true);

  const paymentRecord: MarketplacePaymentRecord = toWalletPaymentRecord(
    evidence,
    "ord_dup",
  );
  assert.equal(paymentRecord.status, "SUCCESS");
  assert.equal(paymentRecord.walletReference, evidence.walletReference);
  assert.equal(paymentRecord.providerReference, evidence.providerReference);
});

test("every demo scenario leaves an inspectable ledger trail", async (t) => {
  const store = tempStore(t);
  const registry = createMockProviderRegistry();
  await newWallet(store);

  await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "FAILED",
    now: NOW,
    relatedTransactionId: "txn_fund_failed",
  });
  await fundWallet(store, registry.payment, {
    walletId: "wl_cus_demo",
    customerId: "cus_demo",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "PENDING",
    now: NOW,
    relatedTransactionId: "txn_fund_pending",
  });
  await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_demo_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime",
    amountMinor: 100_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
    duplicate: true,
  });
  await reverseDebit(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_demo_2",
    amountMinor: 50_000,
    currency: "NGN",
    now: NOW,
  });
  await initiateRefund(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_demo_3",
    amountMinor: 25_000,
    currency: "NGN",
    now: NOW,
  });
  await completeRefund(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_demo_3",
    amountMinor: 25_000,
    currency: "NGN",
    now: NOW,
  });

  const all = await store.readAll<WalletLedgerEntry>("wallet_ledger");
  const types = all.map((entry) => entry.type);
  const expected = [
    "OPENING_BALANCE",
    "FUNDING_INITIATED",
    "FUNDING_FAILED",
    "DEBIT_SUCCESS",
    "DUPLICATE_DEBIT",
    "REVERSAL_INITIATED",
    "REVERSAL_COMPLETED",
    "REFUND_INITIATED",
    "REFUND_PENDING",
    "REFUND_COMPLETED",
  ];
  for (const type of expected) {
    assert.equal(
      (types as WalletLedgerType[]).includes(type as WalletLedgerType),
      true,
      `missing ledger type ${type}`,
    );
  }
  assert.equal(
    checkLedgerConsistency("wl_cus_demo", "NGN", all).consistent,
    true,
  );
});

test("ledger entries carry correlation references and status details", async (t) => {
  const store = tempStore(t);
  await newWallet(store);
  const debit = await debitWallet(store, {
    walletId: "wl_cus_demo",
    transactionId: "txn_corr_1",
    customerId: "cus_demo",
    serviceId: "svc_edu",
    amountMinor: 60_000,
    currency: "NGN",
    scenario: "SUCCESS",
    now: NOW,
  });

  const all = await store.readAll<WalletLedgerEntry>("wallet_ledger");
  const debitEntries = all.filter(
    (entry) => entry.transactionId === "txn_corr_1",
  );
  assert.equal(debitEntries.length, 1);
  assert.equal(debitEntries[0]?.status, "POSTED");
  assert.equal(debitEntries[0]?.metadata.simulated, "true");
  assert.equal(debitEntries[0]?.metadata.scenario, "SUCCESS");
  for (const entry of all) {
    assert.equal(entry.currency, "NGN");
    assert.equal(entry.walletId, "wl_cus_demo");
  }
  assert.equal(debit.evidence.relatedTransactionId, "txn_corr_1");
});

test("createLedgerEntry builds a deterministic typed entry", () => {
  const created = createLedgerEntry({
    walletId: "wl_cus_demo",
    transactionId: "txn_1",
    type: "DEBIT_PENDING",
    amountMinor: 4_000,
    currency: "NGN",
    status: "PENDING",
    reference: "wld_cus_demo_txn_1_1",
    occurredAt: NOW,
    metadata: { simulated: "true", scenario: "PENDING" },
    seq: 1,
  });

  assert.equal(
    created.id,
    "wl_wl_cus_demo_debit_pending_wld_cus_demo_txn_1_1_1",
  );
  assert.equal(created.type, "DEBIT_PENDING");
  assert.equal(created.simulated, true);
});
