import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  buildEvidencePack,
  maskProviderFacts,
  redactEvidencePack,
  type BuildEvidencePackInput,
} from "../../src/marketplace/evidence.ts";
import {
  buildReceipt,
  issueReceipt,
  renderReceipt,
} from "../../src/marketplace/receipts.ts";
import type {
  EvidencePack,
  MarketplaceService,
  ReconciliationSnapshot,
} from "../../src/marketplace/types.ts";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import { ensureReceipt } from "../../src/ui/client.ts";
import {
  seedCustomer,
  seedDemoCustomer,
  seedEvidencePack,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../db/fixtures.ts";
import { demoDeps } from "./demo-deps.ts";

const prisma = getPrismaClient();

const NOW = WALLET_FIXED_TIMESTAMP;

const GIFT_SERVICE: MarketplaceService = {
  id: "svc_gift_mock",
  categoryId: "cat_digital_goods",
  providerId: "mock_gift",
  kind: "GIFT_CARD",
  name: "Mock Gift Card",
  description: "Demo gift card",
  currency: "NGN",
  baseAmountMinor: 5000,
  complianceStatus: "MOCK_ONLY",
  fulfillmentType: "DIGITAL_GOOD",
  availability: "AVAILABLE",
  inputSchema: [],
  simulated: true,
};

function discrepancySnapshot(): ReconciliationSnapshot {
  return {
    outcome: "DISCREPANCY",
    codes: ["STATUS_MISMATCH"],
    notes: ["provider declined after capture"],
    sourceAttributes: { provider_status: "PROVIDER_DECLINED" },
  };
}

function giftCardFailureFixture(): BuildEvidencePackInput {
  return {
    transactionId: "mk_txn_gift_fail",
    customerReference: "cust_demo",
    providerReference: "gft_1111",
    paymentReference: null,
    serviceSnapshot: GIFT_SERVICE,
    amountMinor: 5000,
    currency: "NGN",
    timelineEventIds: ["evt_mk_txn_gift_fail_0001"],
    providerFacts: {
      gift_code: "FULL-MOCK-CODE",
      serial: "SER-1234-5678",
      network: "MTN",
      amount: "5000",
      recipient: "08030000000",
    },
    reconciliation: discrepancySnapshot(),
    mismatchFlags: ["STATUS_MISMATCH", "STATUS_MISMATCH"],
    resolutionStatus: "NONE",
    auditEventIds: [],
    now: NOW,
  };
}

test("evidence pack includes reconciliation result and masks gift card codes", () => {
  const pack = buildEvidencePack(giftCardFailureFixture());
  assert.equal(pack.reconciliation?.outcome, "DISCREPANCY");
  assert.match(pack.providerFacts.maskedCodePreview ?? "", /^\*\*\*\*/);
  assert.equal(JSON.stringify(pack).includes("FULL-MOCK-CODE"), false);
});

test("evidence pack carries the reconcile verdict as supplied, never recomputed", () => {
  const pack = buildEvidencePack(giftCardFailureFixture());
  assert.deepEqual(pack.reconciliation, discrepancySnapshot());
  assert.deepEqual(pack.mismatchFlags, ["STATUS_MISMATCH"]);
  assert.equal(pack.resolutionStatus, "NONE");
});

test("evidence pack preserves non-sensitive provider facts", () => {
  const pack = buildEvidencePack(giftCardFailureFixture());
  assert.equal(pack.providerFacts.network, "MTN");
  assert.equal(pack.providerFacts.recipient, "08030000000");
  assert.equal(pack.providerFacts.gift_code, undefined);
  assert.equal(pack.providerFacts.serial, undefined);
  assert.equal(pack.providerFacts.masked_fields, "gift_code,serial");
  assert.match(pack.providerFacts.maskedCodePreview ?? "", /^\*\*\*\*/);
});

test("evidence pack tolerates missing reconciliation (pre-reconcile surface)", () => {
  const input = giftCardFailureFixture();
  const pack = buildEvidencePack({ ...input, reconciliation: null });
  assert.equal(pack.reconciliation, null);
  assert.match(pack.providerFacts.maskedCodePreview ?? "", /^\*\*\*\*/);
  assert.equal(JSON.stringify(pack).includes("FULL-MOCK-CODE"), false);
});

test("evidence pack keeps a null provider reference explicit", () => {
  const input = giftCardFailureFixture();
  const withoutRef = buildEvidencePack({
    ...input,
    providerReference: null,
    providerFacts: { service: "gift_card", simulated: "true" },
  });
  assert.equal(withoutRef.providerReference, null);
  assert.equal(withoutRef.providerFacts.masked_fields, undefined);
});

test("redactEvidencePack is an immutable display transform of a stored pack", () => {
  const raw: EvidencePack = {
    id: "evp_mk_txn_demo",
    transactionId: "mk_txn_demo",
    customerReference: "cust_demo",
    providerReference: "gft_1000",
    paymentReference: null,
    serviceSnapshot: GIFT_SERVICE,
    amountMinor: 5000,
    currency: "NGN",
    timelineEventIds: ["evt_mk_txn_demo_0001"],
    providerFacts: { gift_code: "FULL-MOCK-CODE", network: "MTN" },
    reconciliation: discrepancySnapshot(),
    mismatchFlags: ["STATUS_MISMATCH"],
    resolutionStatus: "NONE",
    auditEventIds: [],
    createdAt: NOW,
    simulated: true,
  };
  const redacted = redactEvidencePack(raw);
  assert.equal(redacted.id, raw.id);
  assert.deepEqual(redacted.reconciliation, raw.reconciliation);
  assert.equal(redacted.providerFacts.gift_code, undefined);
  assert.equal(redacted.providerFacts.network, "MTN");
  assert.equal(JSON.stringify(redacted).includes("FULL-MOCK-CODE"), false);
});

test("maskProviderFacts never admits raw sensitive material", () => {
  const masked = maskProviderFacts({
    card_number: "5399838383835381",
    pin: "1234",
    secret: "hunter2",
    amount: "5000",
  });
  assert.equal(masked.card_number, undefined);
  assert.equal(masked.pin, undefined);
  assert.equal(masked.secret, undefined);
  assert.match(masked.maskedCodePreview ?? "", /^\*\*\*\*/);
  assert.equal(JSON.stringify(masked).includes("5399838383835381"), false);
});

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-rct-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("receipt links back to the transaction's evidence pack", () => {
  const input = giftCardFailureFixture();
  const receipt = buildReceipt({
    transactionId: input.transactionId,
    customerReference: input.customerReference,
    providerReference: input.providerReference,
    amountMinor: input.amountMinor,
    currency: input.currency,
    label: "gift_card_failure",
    reconciliationOutcome: "DISCREPANCY",
    issuedAt: NOW,
  });
  assert.equal(receipt.id, `rcpt_${input.transactionId}`);
  assert.equal(receipt.evidencePackId, `evp_${input.transactionId}`);
  assert.equal(receipt.amountMinor, 5000);
  assert.equal(receipt.currency, "NGN");
});

test("receipt render is a presentation-safe plain text block", () => {
  const text = renderReceipt({
    transactionId: "mk_txn_gift_fail",
    customerReference: "cust_demo",
    providerReference: "gft_1111",
    amountMinor: 5000,
    currency: "NGN",
    label: "gift_card_failure",
    reconciliationOutcome: "DISCREPANCY",
    issuedAt: NOW,
  });
  assert.match(text, /Amount: 5000 NGN/);
  assert.match(text, /Provider reference: gft_1111/);
  assert.match(text, /Reconcile Kit: DISCREPANCY/);
  assert.equal(text.includes("FULL-MOCK-CODE"), false);
});

test("issueReceipt persists and is idempotent per transaction", async () => {
  await withRollback(prisma, async (tx) => {
    await seedOrg(tx, "org_receipt");
    await seedCustomer(tx, { id: "cus_receipt", orgId: "org_receipt" });
    await seedOrder(tx, { id: "ord_receipt", customerId: "cus_receipt" });
    await seedTransaction(tx, {
      id: "mk_txn_rct_1",
      orderId: "ord_receipt",
      customerId: "cus_receipt",
      reference: "ref_mk_txn_rct_1",
    });
    await seedEvidencePack(tx, {
      id: "evp_mk_txn_rct_1",
      transactionId: "mk_txn_rct_1",
      customerReference: "cust_demo",
      amountMinor: 1000,
      currency: "NGN",
    });
    const repos = buildRepositories(tx);

    const first = await issueReceipt(repos, {
      transactionId: "mk_txn_rct_1",
      customerReference: "cust_demo",
      providerReference: "air_1000",
      amountMinor: 1000,
      currency: "NGN",
      label: "successful_airtime",
      reconciliationOutcome: "MATCH",
      issuedAt: NOW,
    });
    const second = await issueReceipt(repos, {
      transactionId: "mk_txn_rct_1",
      customerReference: "cust_demo",
      providerReference: "air_1000",
      amountMinor: 1000,
      currency: "NGN",
      label: "successful_airtime",
      reconciliationOutcome: "MATCH",
      issuedAt: "2026-01-01T13:00:00.000Z",
    });
    assert.equal(first.id, second.id);
    const latest = await repos.receipts.readLatestById(first.id);
    assert.equal(latest?.issuedAt, "2026-01-01T13:00:00.000Z");
  });
});

test("ensureReceipt reconciles when the evidence pack is missing", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    await seedDemoCustomer(tx);
    const repos = buildRepositories(tx);
    const result = await executeMarketplaceTransaction(demoDeps(store, repos), {
      customerId: "cus_demo",
      serviceId: "svc_airtime_mtn",
      scenario: "SUCCESS",
      inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
      now: NOW,
    });
    const packId = `evp_${result.transaction.id}`;
    assert.equal(await repos.evidencePacks.readLatestById(packId), null);

    const view = await ensureReceipt(
      demoDeps(store, repos),
      result.transaction.id,
    );

    assert.ok(view !== null);
    assert.equal(view.receipt.transactionId, result.transaction.id);
    assert.equal(view.receipt.evidencePackId, packId);
    assert.ok((await repos.evidencePacks.readLatestById(packId)) !== null);
    assert.equal(view.reconciliationOutcome, "MATCH");
  });
});
