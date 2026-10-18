import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  executeMarketplaceTransaction,
  type ExecuteTransactionInput,
} from "../../src/marketplace/transactions.ts";
import {
  listTransactionEvents,
  TransactionEventType,
} from "../../src/marketplace/timeline.ts";
import {
  reconcileMarketplaceTransaction,
  type MarketplaceReconcileDeps,
} from "../../src/marketplace/reconcile.ts";
import { issueReceipt, renderReceipt } from "../../src/marketplace/receipts.ts";
import { buildTransactionTruth } from "../../src/marketplace/truth.ts";
import { notificationsForTruth } from "../../src/marketplace/notifications.ts";
import { giftCardArtifactId } from "../../src/marketplace/artifacts.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer, seedEvidencePack } from "../db/fixtures.ts";
import type { Repositories } from "../../src/db/repositories/index.ts";
import type { GiftCardArtifact } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();

const NOW = WALLET_FIXED_TIMESTAMP;

const FULL_CODE_PATTERN = /GC-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}/;

function reconcileDeps(repos: Repositories): MarketplaceReconcileDeps {
  return { repos, catalog: buildDemoCatalog() };
}

function giftInput(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_giftcard_amazon",
    scenario: "SUCCESS",
    inputs: {
      brand: "Amazon",
      region: "US",
      denomination: "$25",
      quantity: "1",
    },
    now: NOW,
    ...overrides,
  };
}

async function artifactsFor(
  repos: Repositories,
  transactionId: string,
): Promise<readonly GiftCardArtifact[]> {
  return repos.giftCardArtifacts.listByTransaction(transactionId);
}

test("gift card SUCCESS delivers a masked code and snapshots an evidence facet", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(
      demoDeps(repos),
      giftInput({ scenario: "SUCCESS" }),
    );

    assert.equal(result.replayed, false);
    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
    assert.equal(result.transaction.resolutionStatus, "NONE");

    const artists = await artifactsFor(repos, result.transaction.id);
    assert.equal(artists.length, 1);
    const artifact = artists[0];
    assert.equal(artifact.id, giftCardArtifactId(result.transaction.id));
    assert.equal(artifact.deliveryStatus, "DELIVERED");
    assert.equal(artifact.redemptionStatus, "UNREDEEMED");

    assert.ok(result.evidence !== null);
    const facet = result.evidence.giftCard;
    assert.ok(facet !== undefined);
    assert.equal(facet.brand, "Amazon");
    assert.equal(facet.region, "US");
    assert.equal(facet.deliveryStatus, "DELIVERED");
    assert.equal(facet.redemptionStatus, "UNREDEEMED");
    assert.ok(facet.maskedCodePreview !== null);
    assert.match(facet.maskedCodePreview, /^GC-[a-z0-9_]{4}-\*{4}$/);

    const events = await listTransactionEvents(repos, result.transaction.id);
    assert.ok(
      events.some(
        (event) => event.type === TransactionEventType.GiftCardDelivered,
      ),
    );
    assert.ok(
      !events.some(
        (event) =>
          event.type === TransactionEventType.GiftCardFulfillmentFailed,
      ),
    );
  });
});

test("gift card delivered code material is never written in full", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(
      demoDeps(repos),
      giftInput({ scenario: "SUCCESS" }),
    );
    const events = await listTransactionEvents(repos, result.transaction.id);
    const packResult = await reconcileMarketplaceTransaction(
      reconcileDeps(repos),
      { transactionId: result.transaction.id, now: NOW },
    );

    const serialized = [
      result,
      await repos.giftCardArtifacts.listByTransaction(result.transaction.id),
      await repos.marketplaceProviderAttempts.list(),
      events,
      packResult.pack,
    ].map((value) => JSON.stringify(value));

    for (const json of serialized) {
      assert.ok(
        !FULL_CODE_PATTERN.test(json),
        `full gift code material leaked into ${json.slice(0, 200)}`,
      );
    }
  });
});

test("gift card FAILED keeps money moved, flags a provider discrepancy, and notifies the customer", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(
      demoDeps(repos),
      giftInput({ scenario: "FAILED" }),
    );

    assert.equal(result.transaction.paymentStatus, "SUCCESS");
    assert.equal(result.transaction.fulfillmentStatus, "FAILED");
    assert.equal(result.transaction.customerStatus, "NEEDS_ATTENTION");
    assert.equal(result.transaction.adminStatus, "PROVIDER_FAILED");
    assert.equal(result.order.status, "FAILED");

    const artifact = (await artifactsFor(repos, result.transaction.id))[0];
    assert.equal(artifact.deliveryStatus, "FAILED");
    assert.equal(artifact.maskedCodePreview, null);
    assert.ok(result.evidence !== null);
    assert.equal(result.evidence.giftCard?.deliveryStatus, "FAILED");
    assert.equal(result.evidence.giftCard?.maskedCodePreview, null);

    const events = await listTransactionEvents(repos, result.transaction.id);
    assert.ok(
      events.some(
        (event) =>
          event.type === TransactionEventType.GiftCardFulfillmentFailed,
      ),
    );
    assert.ok(
      !events.some(
        (event) => event.type === TransactionEventType.GiftCardDelivered,
      ),
    );

    const reconcile = await reconcileMarketplaceTransaction(
      reconcileDeps(repos),
      { transactionId: result.transaction.id, now: NOW },
    );
    assert.equal(reconcile.truth.reconcileOutcome, "DISCREPANCY");
    assert.equal(reconcile.truth.customerStatus, "NEEDS_ATTENTION");
    assert.equal(reconcile.truth.adminStatus, "PROVIDER_FAILED");
    assert.equal(reconcile.truth.moneyAtRisk, true);
    assert.deepEqual(reconcile.pack.mismatchFlags, ["STATUS_MISMATCH"]);

    const notifications = notificationsForTruth(reconcile.truth, {
      customerId: "cus_demo",
      transactionId: result.transaction.id,
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].kind, "needs_attention");
  });
});

test("gift card SUCCESS reconciles clean and issues an evidence-linked receipt", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(
      demoDeps(repos),
      giftInput({ scenario: "SUCCESS" }),
    );

    const reconcile = await reconcileMarketplaceTransaction(
      reconcileDeps(repos),
      { transactionId: result.transaction.id, now: NOW },
    );
    assert.equal(reconcile.truth.reconcileOutcome, "MATCH");
    assert.equal(reconcile.truth.customerStatus, "CONFIRMED");
    assert.equal(reconcile.truth.adminStatus, "HEALTHY");
    assert.equal(reconcile.truth.moneyAtRisk, false);
    assert.equal(reconcile.pack.id, `evp_${result.transaction.id}`);
    assert.deepEqual(reconcile.pack.mismatchFlags, []);

    const facet = result.evidence?.giftCard;
    assert.ok(facet !== undefined);
    const receiptInput = {
      transactionId: result.transaction.id,
      customerReference: result.order.customerReference,
      providerReference: result.providerResult?.providerReference ?? null,
      amountMinor: reconcile.pack.amountMinor,
      currency: reconcile.pack.currency,
      label: "gift_card_delivery",
      reconciliationOutcome: reconcile.truth.reconcileOutcome,
      issuedAt: NOW,
    };
    const receipt = await issueReceipt(repos, receiptInput);
    assert.equal(receipt.id, `rcpt_${result.transaction.id}`);
    assert.equal(receipt.evidencePackId, `evp_${result.transaction.id}`);

    const stored = await repos.receipts.readLatestById(receipt.id);
    assert.ok(stored !== null);
    assert.equal(stored.evidencePackId, receipt.evidencePackId);

    const rendered = renderReceipt(receiptInput);
    assert.match(rendered, /gift_card_delivery/);
    assert.match(rendered, /Reconcile Kit: MATCH/);
    assert.ok(!FULL_CODE_PATTERN.test(rendered));
  });
});

test("gift card REFUND_COMPLETED moves the resolution state and notifies refunded", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(
      demoDeps(repos),
      giftInput({ scenario: "REFUND_COMPLETED" }),
    );
    assert.equal(result.transaction.resolutionStatus, "REFUNDED");
    assert.equal(result.transaction.customerStatus, "REFUNDED");
    assert.equal(result.transaction.adminStatus, "HEALTHY");

    const truth = buildTransactionTruth({
      transactionId: result.transaction.id,
      outcome: "MATCH",
      codes: [],
      paymentState: "SUCCESS",
      resolutionStatus: "REFUNDED",
      expectedAmountMinor: 2500,
      currency: "USD",
      providerAmountMinor: 2500,
    });
    const notifications = notificationsForTruth(truth, {
      customerId: "cus_demo",
      transactionId: result.transaction.id,
    });
    assert.equal(notifications.length, 1);
    assert.equal(notifications[0].kind, "refunded");
  });
});

test("gift card replay is idempotent and never duplicates rows or events", async (t) => {
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const input = giftInput({ scenario: "SUCCESS" });
    const first = await executeMarketplaceTransaction(demoDeps(repos), input);
    const eventsBefore = await listTransactionEvents(
      repos,
      first.transaction.id,
    );

    const replay = await executeMarketplaceTransaction(demoDeps(repos), input);
    assert.equal(replay.replayed, true);
    assert.equal(replay.evidence, null);

    assert.equal(
      (await repos.giftCardArtifacts.listByTransaction(first.transaction.id))
        .length,
      1,
    );
    assert.equal(
      (await repos.marketplaceTransactions.list()).filter(
        (row) => row.id === first.transaction.id,
      ).length,
      1,
    );
    assert.equal(
      (await repos.marketplacePayments.list()).filter(
        (row) => row.transactionId === first.transaction.id,
      ).length,
      1,
    );
    assert.equal(
      (
        await repos.marketplaceProviderAttempts.listByTransaction(
          first.transaction.id,
        )
      ).length,
      1,
    );
    assert.equal(
      (await repos.walletLedger.listByTransaction(first.transaction.id)).length,
      1,
    );

    const eventsAfter = await listTransactionEvents(
      repos,
      first.transaction.id,
    );
    assert.equal(eventsAfter.length, eventsBefore.length);

    await seedEvidencePack(tx, {
      id: `evp_${first.transaction.id}`,
      transactionId: first.transaction.id,
      customerReference: "cus_demo",
      amountMinor: 2500,
      currency: "USD",
    });
    await issueReceipt(repos, {
      transactionId: first.transaction.id,
      customerReference: "cus_demo",
      providerReference: null,
      amountMinor: 2500,
      currency: "USD",
      label: "gift_card_delivery",
      reconciliationOutcome: "MATCH",
    });
    await issueReceipt(repos, {
      transactionId: first.transaction.id,
      customerReference: "cus_demo",
      providerReference: null,
      amountMinor: 2500,
      currency: "USD",
      label: "gift_card_delivery",
      reconciliationOutcome: "MATCH",
    });
    const receiptFirst = await repos.receipts.readLatestById(
      `rcpt_${first.transaction.id}`,
    );
    const receiptReplay = await repos.receipts.readLatestById(
      `rcpt_${first.transaction.id}`,
    );
    assert.ok(receiptFirst !== null);
    assert.deepEqual(receiptReplay, receiptFirst);

    const latest = await repos.marketplaceTransactions.readLatestById(
      first.transaction.id,
    );
    assert.ok(latest !== null);
    assert.equal(latest.paymentStatus, "SUCCESS");
    assert.equal(latest.fulfillmentStatus, "FULFILLED");
  });
});
