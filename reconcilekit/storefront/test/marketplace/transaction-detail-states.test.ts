import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { loadConfig } from "../../src/config.ts";
import { createStorefrontServer } from "../../src/server.ts";
import { demoDeps } from "./demo-deps.ts";
import {
  seedDemoData,
  type SeededDemoData,
  type SeededOrderEntry,
} from "../../src/marketplace/seed.ts";
import { seedDemoUser } from "../../src/auth/identity.ts";
import { loginAndGetCookie, withCookie } from "../auth/helpers.ts";
import {
  DEMO_SCENARIO_NAMES,
  WALLET_FUNDING_SCENARIO_NAME,
} from "../../src/marketplace/demo-scenarios.ts";
import type { WalletLedgerEntry } from "../../src/marketplace/types.ts";

interface WalkthroughServer {
  readonly baseUrl: string;
  readonly cookie: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
  readonly seeded: SeededDemoData;
}

async function startFullySeededServer(t: {
  after: (fn: () => void) => void;
}): Promise<WalkthroughServer> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-detail-states-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  const seeded = await seedDemoData(store);
  await seedDemoUser(store);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
        verifyTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
      },
      marketplace: demoDeps(store),
    },
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await loginAndGetCookie(baseUrl);

  return {
    baseUrl,
    cookie,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    store,
    seeded,
  };
}

async function fetchDetail(
  app: WalkthroughServer,
  name: string,
): Promise<{ entry: SeededOrderEntry; html: string }> {
  const entry = app.seeded.byName[name] as SeededOrderEntry;
  assert.ok(entry, `seed entry ${name}`);
  const res = await fetch(
    `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}`,
    withCookie(app.cookie),
  );
  assert.equal(res.status, 200, `${name} detail status`);
  return { entry, html: await res.text() };
}

const ORDER_SCENARIO_NAMES = DEMO_SCENARIO_NAMES.filter(
  (name) => name !== WALLET_FUNDING_SCENARIO_NAME,
);

test("detail page keeps the three transaction truths visibly distinct on every render state", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    for (const name of ORDER_SCENARIO_NAMES) {
      const { html } = await fetchDetail(app, name);
      assert.match(html, /What happened to your money/);
      assert.match(html, /Provider response/);
      assert.match(html, /Ledger truth/);
      assert.match(html, /Fulfillment truth/);
      assert.match(html, /ReconcileKit determination/);
      assert.match(html, /What happens next/);
      assert.match(html, /Simulated data/);
      assert.match(html, /three separate records/i);
      assert.match(
        html,
        /payment success does not mean the service was delivered/i,
        `${name} makes payment/fulfillment separation explicit`,
      );
    }
  } finally {
    await app.close();
  }
});

test("SUCCESS render state: successful_airtime lines up and claims no risk", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { entry, html } = await fetchDetail(app, "successful_airtime");
    assert.equal(entry.truth.reconcileOutcome, "MATCH");
    assert.equal(entry.truth.moneyAtRisk, false);
    assert.match(html, /MATCH/);
    assert.match(html, /records line up/);
    assert.match(html, /Money not at risk/);
    assert.ok(html.includes(entry.truth.nextAction), "next action shown");
    assert.doesNotMatch(html, /do not give us enough evidence/);
    assert.doesNotMatch(html, /the records do not line up/);
  } finally {
    await app.close();
  }
});

test("DISCREPANCY render state: provider_mismatch surfaces codes as-is", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { entry, html } = await fetchDetail(app, "provider_mismatch");
    assert.equal(entry.truth.reconcileOutcome, "DISCREPANCY");
    assert.equal(entry.truth.moneyAtRisk, true);
    assert.match(html, /DISCREPANCY/);
    assert.match(html, /the records do not line up/);
    assert.match(html, /AMOUNT_MISMATCH/);
    assert.match(html, /Money at risk/);
    assert.doesNotMatch(html, /do not give us enough evidence/);
    assert.doesNotMatch(html, /records line up/);
  } finally {
    await app.close();
  }
});

test("UNRESOLVED render state: unknown evidence gets an explicit no-guess explanation", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { entry, html } = await fetchDetail(app, "manual_review");
    assert.notEqual(entry.truth.reconcileOutcome, "MATCH");
    assert.notEqual(entry.truth.reconcileOutcome, "DISCREPANCY");
    assert.equal(entry.truth.moneyAtRisk, true);
    assert.match(
      html,
      /do not give us enough evidence to confirm exactly what happened/,
    );
    assert.match(html, /refuses to guess/);
    assert.match(html, /not proof that anything failed/);
    assert.doesNotMatch(html, /records line up/);
    assert.doesNotMatch(html, /Reconciliation outcome matches expectations/);
  } finally {
    await app.close();
  }
});

test("UNRESOLVED family (pending provider) also avoids a definitive claim", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { entry, html } = await fetchDetail(app, "provider_timeout");
    assert.notEqual(entry.truth.reconcileOutcome, "MATCH");
    assert.match(
      html,
      /do not give us enough evidence to confirm exactly what happened/,
    );
    assert.ok(html.includes(entry.truth.nextAction), "next action shown");
  } finally {
    await app.close();
  }
});

test("ledger truth surfaces the real wallet ledger entries for the transaction", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { entry, html } = await fetchDetail(app, "successful_airtime");
    const ledger = (
      await app.store.readAll<WalletLedgerEntry>("wallet_ledger")
    ).filter((row) => row.transactionId === entry.transactionId);
    assert.ok(ledger.length >= 1, "transaction must have ledger movement");
    for (const row of ledger) {
      assert.ok(
        html.includes(row.reference),
        `ledger reference ${row.reference}`,
      );
      assert.ok(
        html.includes(row.type.replace(/_/g, " ").toLowerCase()) ||
          html.includes(row.type.replace(/_/g, " ")),
        `ledger type ${row.type}`,
      );
    }
  } finally {
    await app.close();
  }
});

test("masked evidence: no full gift-card code leaks on detail or evidence responses", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const { html } = await fetchDetail(app, "successful_gift_card");
    assert.match(html, /GC-[^-]+-\*\*\*\*/);
    const withoutPreview = html.replace(/GC-[^-]+-\*\*\*\*/g, "");
    assert.doesNotMatch(withoutPreview, /GC-/, "no unmasked code material");

    const entry = app.seeded.byName["successful_gift_card"] as SeededOrderEntry;
    const evidence = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}/evidence`,
      withCookie(app.cookie),
    );
    assert.equal(evidence.status, 200);
    const evidenceHtml = await evidence.text();
    assert.match(evidenceHtml, /sensitive values masked/i);
    assert.doesNotMatch(evidenceHtml, /"code":"/);
  } finally {
    await app.close();
  }
});

test("identifier semantics: join anchor and provider reference stay distinct rows", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const res = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent("txn_provider_mismatch")}`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 200);
    const html = await res.text();

    const matches = Array.from(html.matchAll(/Transaction id/g));
    assert.equal(matches.length, 1, "one Transaction id row");

    const entry = app.seeded.byName["provider_mismatch"] as SeededOrderEntry;
    assert.match(entry.transaction.id, /^mk_txn_/);
    assert.ok(html.includes(entry.transaction.id), "join anchor rendered");
    assert.ok(
      html.includes(entry.pack.providerReference ?? "never"),
      "provider reference rendered",
    );
    assert.notEqual(
      entry.transaction.id,
      entry.pack.providerReference,
      "join anchor and provider reference are different identifiers",
    );
  } finally {
    await app.close();
  }
});

test("receipt and evidence links still resolve on the enhanced detail page", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    for (const name of [
      "successful_airtime",
      "provider_mismatch",
      "manual_review",
    ]) {
      const entry = app.seeded.byName[name] as SeededOrderEntry;
      const receipt = await fetch(
        `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}/receipt`,
        withCookie(app.cookie),
      );
      assert.equal(receipt.status, 200, `${name} receipt`);
      assert.match(await receipt.text(), /Receipt/);
      const evidence = await fetch(
        `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}/evidence`,
        withCookie(app.cookie),
      );
      assert.equal(evidence.status, 200, `${name} evidence`);
      assert.match(await evidence.text(), /Evidence pack/);
    }
  } finally {
    await app.close();
  }
});
