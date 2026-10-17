import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import {
  createLedgerEntry,
  deriveWalletBalance,
  findWalletByCustomer,
  getWalletBalance,
  WALLET_FIXED_TIMESTAMP,
} from "../../src/marketplace/wallet.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import type {
  ExecuteTransactionInput,
  ExecuteTransactionResult,
} from "../../src/marketplace/transactions.ts";
import { buildTransactionTruth } from "../../src/marketplace/truth.ts";
import { marketplaceReconcileConfig } from "../../src/marketplace/reconcile-bridge.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import {
  ingestWalletLedgerEntries,
  recordedWalletEvents,
} from "../../src/marketplace/payment-sources/wallet-ingest.ts";
import { walletLedgerToPaymentEvent } from "../../src/marketplace/payment-sources/adapters/wallet.ts";
import {
  reconcilePaymentEvents,
  toReconcileKitRequest,
} from "../../src/marketplace/payment-sources/to-reconcilekit.ts";
import { listPaymentEvents } from "../../src/marketplace/payment-sources/ingest.ts";
import { demoDeps } from "./demo-deps.ts";
import type {
  MarketplaceTransaction,
  MarketplaceWallet,
  WalletLedgerEntry,
} from "../../src/marketplace/types.ts";
import type {
  MatchResult,
  ReconciliationConfig,
  ReconciliationReport,
} from "../../../src/domain/model.ts";

const prisma = getPrismaClient();
const NOW = WALLET_FIXED_TIMESTAMP;
const NOW_EPOCH = Date.parse(NOW);

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-wallet-lifecycle-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function input(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
    ...overrides,
  };
}

async function walletFor(
  repos: Repositories,
  customerId: string,
): Promise<MarketplaceWallet> {
  const wallet = await findWalletByCustomer(repos, customerId);
  assert.notEqual(wallet, null);
  return wallet!;
}

async function ledgerForWallet(
  repos: Repositories,
  walletId: string,
): Promise<readonly WalletLedgerEntry[]> {
  return repos.walletLedger.listByWallet(walletId);
}

async function entriesForTransaction(
  repos: Repositories,
  transactionId: string,
): Promise<readonly WalletLedgerEntry[]> {
  return repos.walletLedger.listByTransaction(transactionId);
}

function merchantResult(
  report: ReconciliationReport,
  merchantRecordId: string,
): MatchResult | undefined {
  return report.results.find(
    (result) => result.merchant_record?.merchant_record_id === merchantRecordId,
  );
}

const CONFIG: ReconciliationConfig =
  marketplaceReconcileConfig(buildDemoCatalog());

test("wallet lifecycle: a real debit entry normalizes with the anchor as the only join surface", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    await walletFor(repos, "cus_demo");
    const debit = (
      await entriesForTransaction(repos, result.transaction.id)
    ).find((entry) => entry.type === "DEBIT_SUCCESS");
    assert.ok(debit);

    const draft = walletLedgerToPaymentEvent(debit);
    assert.notEqual(draft, null);
    assert.notEqual(debit.reference, result.transaction.id);
    assert.ok(debit.reference.startsWith("wld_"));
    assert.ok(result.transaction.id.startsWith("mk_txn_"));

    assert.equal(draft?.transaction_id, result.transaction.id);
    assert.equal(draft?.merchant_reference, result.transaction.id);
    assert.equal(draft?.payment_source, "INTERNAL_WALLET");
    assert.equal(draft?.payment_source_reference, debit.reference);
    assert.equal(draft?.source_event_id, debit.id);
    assert.equal(draft?.event_type, "PAYMENT");
    assert.equal(draft?.amount, 1000);
    assert.equal(draft?.currency, "NGN");
    assert.equal(draft?.status, "SUCCESS");
    assert.equal(draft?.occurred_at, NOW_EPOCH);
    assert.equal(draft?.source_confidence, "OBSERVED");
    assert.equal(
      draft?.source_attributes.wallet_ledger_reference,
      debit.reference,
    );

    assert.ok(!JSON.stringify(draft).includes("provider_reference"));

    const outcome = await ingestWalletLedgerEntries(store, [debit], {
      now: NOW_EPOCH,
    });
    const events = recordedWalletEvents(outcome);
    assert.equal(events.length, 1);
    assert.equal(
      events[0].idempotency_key,
      `INTERNAL_WALLET|${debit.reference}|PAYMENT|${debit.id}`,
    );
    assert.equal(events[0].id, events[0].event_id);
    assert.ok(events[0].event_id.startsWith("pevt_"));
  });
});

test("wallet lifecycle: exact reconciliation joins on mk_txn, never on wld", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const debit = await entriesForTransaction(repos, result.transaction.id);
    const outcomes = await ingestWalletLedgerEntries(store, debit, {
      now: NOW_EPOCH,
    });
    const events = recordedWalletEvents(outcomes);
    assert.equal(events.length, 1);

    const report = reconcilePaymentEvents(events, CONFIG);
    const matched = merchantResult(report, result.transaction.id);
    assert.equal(matched?.outcome, "MATCH");
    assert.deepEqual(matched?.discrepancy_codes, []);
    assert.equal(report.summary.matched, 1);
    assert.equal(report.summary.totalRecords, 2);
  });
});

test("wallet lifecycle: source-reference isolation keeps wld out of the join key", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const debit = (
      await entriesForTransaction(repos, result.transaction.id)
    ).find((entry) => entry.type === "DEBIT_SUCCESS");
    assert.ok(debit);

    const outcomes = await ingestWalletLedgerEntries(store, [debit], {
      now: NOW_EPOCH,
    });
    const report = reconcilePaymentEvents(
      recordedWalletEvents(outcomes),
      CONFIG,
    );
    const matched = merchantResult(report, result.transaction.id);
    assert.equal(matched?.outcome, "MATCH");

    assert.equal(matched?.provider_record?.reference, result.transaction.id);
    assert.equal(
      matched?.source_attributes.payment_source_reference,
      debit.reference,
    );
    assert.ok(debit.reference.startsWith("wld_"));

    const providerJson = JSON.stringify(matched?.provider_record);
    assert.ok(!providerJson.includes(debit.reference));
    assert.ok(!providerJson.includes("provider_reference"));
  });
});

test("wallet lifecycle: replay and process restart store a single stable event", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const wallet = await walletFor(repos, "cus_demo");
    const ledgerBefore = await ledgerForWallet(repos, wallet.id);
    const entries = await entriesForTransaction(repos, result.transaction.id);

    const first = await ingestWalletLedgerEntries(store, entries, {
      now: NOW_EPOCH,
    });
    const events = recordedWalletEvents(first);
    assert.equal(events.length, 1);
    assert.equal(events[0].observed_at, NOW_EPOCH);

    const second = await ingestWalletLedgerEntries(store, entries, {
      now: NOW_EPOCH,
    });
    assert.equal(second[0].skipped, false);
    assert.equal((second[0] as { replay: boolean }).replay, true);
    assert.equal(
      events[0].event_id,
      (await listPaymentEvents(store))[0].event_id,
    );
    assert.equal((await listPaymentEvents(store)).length, 1);

    const restarted = new JsonlStore(store.dataDir);
    const afterRestart = await ingestWalletLedgerEntries(restarted, entries, {
      now: NOW_EPOCH,
    });
    assert.equal(afterRestart[0].skipped, false);
    assert.equal((afterRestart[0] as { replay: boolean }).replay, true);
    assert.equal(
      (afterRestart[0] as { event: { event_id: string } }).event.event_id,
      events[0].event_id,
    );
    assert.equal((await listPaymentEvents(restarted)).length, 1);

    const ledgerAfter = await ledgerForWallet(repos, wallet.id);
    assert.deepEqual(ledgerAfter, ledgerBefore);
  });
});

test("wallet lifecycle: OPENING_BALANCE never becomes a payment event", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const wallet = await walletFor(repos, "cus_demo");
    const ledger = await ledgerForWallet(repos, wallet.id);

    const opening = ledger.find((entry) => entry.type === "OPENING_BALANCE");
    const debit = ledger.find((entry) => entry.type === "DEBIT_SUCCESS");
    assert.ok(opening);
    assert.ok(debit);

    assert.equal(walletLedgerToPaymentEvent(opening), null);

    const outcomes = await ingestWalletLedgerEntries(store, ledger, {
      now: NOW_EPOCH,
    });
    assert.equal(outcomes.filter((outcome) => outcome.skipped).length, 1);
    const events = recordedWalletEvents(outcomes);
    assert.equal(events.length, 1);
    assert.equal(events[0].payment_source_reference, debit.reference);
    assert.equal(events[0].transaction_id, result.transaction.id);
  });
});

test("wallet lifecycle: an unanchored ledger entry is never heuristically associated", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const orphan = createLedgerEntry({
      walletId: "wlt_orphan",
      transactionId: null,
      type: "DEBIT_SUCCESS",
      amountMinor: 5000,
      currency: "NGN",
      status: "POSTED",
      reference: "wld_orphan_1",
      occurredAt: NOW,
      metadata: { simulated: "true" },
      seq: 1,
    });
    // Wallets FK: orphan must have an existing wallet parent. The wallet_ledger
    // schema enforces walletId -> wallets.id, so seed a placeholder wallet.
    await repos.wallets.insert({
      id: "wlt_orphan",
      customerId: "cus_demo",
      currency: "NGN",
      openingBalanceMinor: 0,
      status: "ACTIVE",
      simulated: true,
      createdAt: NOW,
    });
    await repos.walletLedger.insert(orphan);

    const outcomes = await ingestWalletLedgerEntries(store, [orphan], {
      now: NOW_EPOCH,
    });
    const events = recordedWalletEvents(outcomes);
    assert.equal(events.length, 1);
    assert.equal(events[0].transaction_id, null);
    assert.equal(events[0].merchant_reference, null);
    assert.equal(events[0].payment_source_reference, "wld_orphan_1");

    const request = toReconcileKitRequest(events, CONFIG);
    assert.equal(request.providerPayments.length, 0);

    const report = reconcilePaymentEvents(events, CONFIG);
    assert.equal(report.results.length, 1);
    const resultRecord = report.results[0];
    assert.equal(resultRecord.outcome, "MISSING_REFERENCE");
    assert.equal(resultRecord.merchant_record?.merchant_record_id, null);
    assert.equal(resultRecord.merchant_record?.merchant_reference, null);
  });
});

test("wallet lifecycle: reconciliation leaves the ledger and wallet untouched", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const wallet = await walletFor(repos, "cus_demo");

    const ledgerBefore = await ledgerForWallet(repos, wallet.id);
    const walletBefore = await repos.wallets.readLatestById(wallet.id);
    const balanceBefore = await getWalletBalance(
      repos,
      wallet.id,
      wallet.currency,
    );

    const entries = await entriesForTransaction(repos, result.transaction.id);
    await ingestWalletLedgerEntries(store, entries, { now: NOW_EPOCH });
    const events = await listPaymentEvents(store);
    reconcilePaymentEvents(events, CONFIG);

    const ledgerAfter = await ledgerForWallet(repos, wallet.id);
    const walletAfter = await repos.wallets.readLatestById(wallet.id);
    const balanceAfter = await getWalletBalance(
      repos,
      wallet.id,
      wallet.currency,
    );

    assert.deepEqual(ledgerAfter, ledgerBefore);
    assert.deepEqual(walletAfter, walletBefore);
    assert.deepEqual(balanceAfter, balanceBefore);
    assert.deepEqual(
      balanceAfter,
      deriveWalletBalance(wallet.id, wallet.currency, ledgerAfter),
    );

    const types = ledgerAfter.map((entry) => entry.type);
    assert.ok(!types.includes("REVERSAL_INITIATED"));
    assert.ok(!types.includes("REVERSAL_COMPLETED"));
    assert.ok(!types.includes("REFUND_INITIATED"));
    assert.ok(!types.includes("REFUND_COMPLETED"));
  });
});

test("wallet lifecycle: a failed fulfillment keeps payment/ledger truth separate from fulfillment truth", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(
      deps,
      input({ scenario: "FAILED" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "FAILED");
    assert.equal(result.transaction.customerStatus, "NEEDS_ATTENTION");
    assert.equal(result.transaction.adminStatus, "PROVIDER_FAILED");
    assert.ok(result.facts?.flags.includes("STATUS_MISMATCH"));

    const debit = (
      await entriesForTransaction(repos, result.transaction.id)
    ).find((entry) => entry.type === "DEBIT_SUCCESS");
    assert.ok(debit);

    const events = recordedWalletEvents(
      await ingestWalletLedgerEntries(store, [debit], { now: NOW_EPOCH }),
    );
    const report = reconcilePaymentEvents(events, CONFIG);
    const matched = merchantResult(report, result.transaction.id);
    assert.equal(matched?.outcome, "MATCH");

    const attempts = (
      await store.readAll<{
        transactionId: string;
        canonicalStatus: string | null;
      }>("marketplace_provider_attempts")
    ).filter((attempt) => attempt.transactionId === result.transaction.id);
    assert.equal(attempts.at(-1)?.canonicalStatus, "FAILED");

    const truth = buildTransactionTruth({
      transactionId: result.transaction.id,
      outcome: matched!.outcome,
      codes: matched!.discrepancy_codes,
      paymentState: result.facts!.paymentState,
      resolutionStatus: result.transaction.resolutionStatus,
      expectedAmountMinor: result.facts!.expectedAmountMinor,
      currency: result.facts!.currency,
      providerAmountMinor: result.facts!.providerAmountMinor,
    });
    assert.equal(truth.reconcileOutcome, "MATCH");
    assert.equal(truth.customerStatus, "CONFIRMED");
    assert.equal(truth.moneyAtRisk, false);

    const storedTx = await store.readLatestById<MarketplaceTransaction>(
      "marketplace_transactions",
      result.transaction.id,
    );
    assert.equal(storedTx?.fulfillmentStatus, "FAILED");
    assert.equal(storedTx?.customerStatus, "NEEDS_ATTENTION");
    assert.equal(storedTx?.adminStatus, "PROVIDER_FAILED");
  });
});

test("wallet lifecycle: reconciliation never causes provider side effects", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const wallet = await walletFor(repos, "cus_demo");

    const before = {
      paymentEvents: (await store.readAll("payment_events")).length,
      ledger: (await ledgerForWallet(repos, wallet.id)).length,
      payments: (await store.readAll("payments")).length,
      attempts: (await store.readAll("marketplace_provider_attempts")).length,
      tickets: (await store.readAll("ticket_artifacts")).length,
      gifts: (await store.readAll("gift_card_artifacts")).length,
      transactions: (await store.readAll("marketplace_transactions")).length,
    };

    const entries = await entriesForTransaction(repos, result.transaction.id);
    await ingestWalletLedgerEntries(store, entries, { now: NOW_EPOCH });
    const events = await listPaymentEvents(store);
    reconcilePaymentEvents(events, CONFIG);

    const after = {
      paymentEvents: (await store.readAll("payment_events")).length,
      ledger: (await ledgerForWallet(repos, wallet.id)).length,
      payments: (await store.readAll("payments")).length,
      attempts: (await store.readAll("marketplace_provider_attempts")).length,
      tickets: (await store.readAll("ticket_artifacts")).length,
      gifts: (await store.readAll("gift_card_artifacts")).length,
      transactions: (await store.readAll("marketplace_transactions")).length,
    };

    assert.deepEqual(after, {
      ...before,
      paymentEvents: before.paymentEvents + 1,
    });
  });
});

test("wallet lifecycle: end-to-end compose produces one stored event, MATCH, and a truthful outcome", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());

    const entries = await entriesForTransaction(repos, result.transaction.id);
    assert.equal(entries.length, 1);
    assert.equal(entries[0].type, "DEBIT_SUCCESS");

    assert.deepEqual(result.facts?.evidenceLedgerEntryIds, [entries[0].id]);

    await ingestWalletLedgerEntries(store, entries, { now: NOW_EPOCH });
    const stored = await listPaymentEvents(store);
    assert.equal(stored.length, 1);
    assert.equal(stored[0].payment_source, "INTERNAL_WALLET");
    assert.equal(stored[0].transaction_id, result.transaction.id);
    assert.equal(stored[0].payment_source_reference, entries[0].reference);
    const persisted = await store.readLatestById(
      "payment_events",
      stored[0].event_id,
    );
    assert.deepEqual(persisted, stored[0]);

    const report = reconcilePaymentEvents(stored, CONFIG);
    const matched = merchantResult(report, result.transaction.id);
    assert.equal(matched?.outcome, "MATCH");
    assert.equal(report.summary.matched, 1);
    assert.equal(matched?.provider_record?.reference, result.transaction.id);
    assert.equal(
      matched?.source_attributes.payment_source_reference,
      entries[0].reference,
    );

    const truth = buildTransactionTruth({
      transactionId: result.transaction.id,
      outcome: matched!.outcome,
      codes: matched!.discrepancy_codes,
      paymentState: result.facts!.paymentState,
      resolutionStatus: result.transaction.resolutionStatus,
      expectedAmountMinor: result.facts!.expectedAmountMinor,
      currency: result.facts!.currency,
      providerAmountMinor: result.facts!.providerAmountMinor,
    });
    assert.deepEqual(truth, {
      transactionId: result.transaction.id,
      reconcileOutcome: "MATCH",
      customerStatus: "CONFIRMED",
      adminStatus: "HEALTHY",
      moneyAtRisk: false,
      nextAction: "None — payment reconciled.",
      explanation: `Reconcile Kit determined MATCH (1000 NGN expected; provider reported 1000 NGN).`,
    });

    const after = await entriesForTransaction(repos, result.transaction.id);
    assert.deepEqual(after, entries);
  });
});

test("wallet lifecycle: identical inputs yield identical IDs, projections, and output", async (t) => {
  const storeA = tempStore(t);
  void storeA;
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);

    const run = async (): Promise<{
      result: ExecuteTransactionResult;
      entries: readonly WalletLedgerEntry[];
      events: readonly { event_id: string; observed_at: number }[];
      report: ReconciliationReport;
      truth: ReturnType<typeof buildTransactionTruth>;
    }> => {
      const dir = mkdtempSync(
        join(tmpdir(), "storefront-wallet-lifecycle-run-"),
      );
      try {
        const store = new JsonlStore(dir);
        const deps = demoDeps(store, repos);
        const result = await executeMarketplaceTransaction(deps, input());
        const entries = await entriesForTransaction(
          repos,
          result.transaction.id,
        );
        await ingestWalletLedgerEntries(store, entries, { now: NOW_EPOCH });
        const events = await listPaymentEvents(store);
        const report = reconcilePaymentEvents(events, CONFIG);
        const truth = buildTransactionTruth({
          transactionId: result.transaction.id,
          outcome: merchantResult(report, result.transaction.id)!.outcome,
          codes: merchantResult(report, result.transaction.id)!
            .discrepancy_codes,
          paymentState: result.facts!.paymentState,
          resolutionStatus: result.transaction.resolutionStatus,
          expectedAmountMinor: result.facts!.expectedAmountMinor,
          currency: result.facts!.currency,
          providerAmountMinor: result.facts!.providerAmountMinor,
        });
        return { result, entries, events, report, truth };
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };

    const first = await run();
    const second = await run();

    assert.equal(second.result.transaction.id, first.result.transaction.id);
    assert.equal(second.entries[0].reference, first.entries[0].reference);
    assert.equal(second.events[0].event_id, first.events[0].event_id);
    assert.equal(second.events[0].observed_at, NOW_EPOCH);
    assert.equal(second.report.summary.matched, first.report.summary.matched);
    assert.equal(
      second.report.summary.totalRecords,
      first.report.summary.totalRecords,
    );
    assert.deepEqual(second.truth, first.truth);
  });
});

test("wallet lifecycle: no tenant/org dimension is fabricated on wallet evidence", async (t) => {
  const store = tempStore(t);
  await seedDemoCustomer(prisma, "cus_demo");
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const deps = demoDeps(store, repos);
    const result = await executeMarketplaceTransaction(deps, input());
    const entries = await entriesForTransaction(repos, result.transaction.id);
    const debit = entries.find((entry) => entry.type === "DEBIT_SUCCESS");
    assert.ok(debit);
    const outcomes = await ingestWalletLedgerEntries(store, [debit], {
      now: NOW_EPOCH,
    });
    const event = outcomes[0].skipped
      ? null
      : (
          outcomes[0] as {
            event: { source_attributes: Record<string, string> };
          }
        ).event;
    assert.ok(event);
    const serialized = JSON.stringify(event);
    for (const key of ["tenant_id", "tenantId", "organization_id", "org_id"]) {
      assert.ok(!serialized.includes(key));
    }
  });
});
