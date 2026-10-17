import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { truncateCommittedState } from "../db/isolation.ts";
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
  demoAliasFor,
} from "../../src/marketplace/demo-scenarios.ts";
import type { GiftCardArtifact } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

// (existing lines)

after(async () => {
  await truncateCommittedState(prisma);
});

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
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-walkthrough-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  // Phase 5A.3b — protected routes require a session; seed the demo user so
  // the login helper can authenticate against this server.
  await seedDemoUser(repos);
  const seeded = await seedDemoData(store, repos);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      repos,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
        verifyTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
      },
      marketplace: demoDeps(store, repos),
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

const ORDER_SCENARIO_NAMES = DEMO_SCENARIO_NAMES.filter(
  (name) => name !== WALLET_FUNDING_SCENARIO_NAME,
);

test("every seeded order scenario serves detail, evidence and receipt over HTTP", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    for (const name of ORDER_SCENARIO_NAMES) {
      const entry = app.seeded.byName[name] as SeededOrderEntry;
      assert.ok(entry, `seed entry ${name}`);
      const base = `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}`;

      const detail = await fetch(base, withCookie(app.cookie));
      assert.equal(detail.status, 200, `${name} detail status`);
      const detailHtml = await detail.text();
      assert.match(detailHtml, /What happened to your money/);
      assert.match(detailHtml, /Provider response/);
      assert.match(detailHtml, /ReconcileKit determination/);
      assert.match(detailHtml, /Simulated data/);

      const evidence = await fetch(`${base}/evidence`, withCookie(app.cookie));
      assert.equal(evidence.status, 200, `${name} evidence status`);
      const evidenceHtml = await evidence.text();
      assert.match(evidenceHtml, /Evidence pack/);

      const receipt = await fetch(`${base}/receipt`, withCookie(app.cookie));
      assert.equal(receipt.status, 200, `${name} receipt status`);
      const receiptHtml = await receipt.text();
      assert.match(receiptHtml, /Receipt/);
    }
  } finally {
    await app.close();
  }
});

test("money-at-risk transactions surface the badge on the detail page", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const entry = app.seeded.byName["manual_review"] as SeededOrderEntry;
    const detail = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}`,
      withCookie(app.cookie),
    );
    assert.equal(detail.status, 200);
    const detailHtml = await detail.text();
    assert.match(detailHtml, /Money at risk/);
  } finally {
    await app.close();
  }
});

test("wallet funding failure exposes no marketplace transaction page", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const res = await fetch(
      `${app.baseUrl}/transactions/${demoAliasFor(WALLET_FUNDING_SCENARIO_NAME)}`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.match(html, /Error 404/);
  } finally {
    await app.close();
  }
});

test("gift card surfaces only masked code material", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const successId = (
      app.seeded.byName["successful_gift_card"] as SeededOrderEntry
    ).transactionId;
    const successCards = (
      await app.store.readAll<GiftCardArtifact>("gift_card_artifacts")
    ).filter((artifact) => artifact.transactionId === successId);
    assert.equal(successCards.length, 1);
    const preview = successCards[0]?.maskedCodePreview;
    assert.ok(preview, "successful gift card must carry a masked preview");
    assert.match(preview, /^GC-[^-]+-\*\*\*\*$/);

    const successEntry = app.seeded.byName[
      "successful_gift_card"
    ] as SeededOrderEntry;
    const successDetail = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(successEntry.reference)}`,
      withCookie(app.cookie),
    );
    const successDetailHtml = await successDetail.text();
    assert.ok(
      successDetailHtml.includes(preview),
      "detail page must show the masked preview",
    );
    assert.match(successDetailHtml, /Only masked code previews are shown/);
    const withoutPreview = successDetailHtml.split(preview).join("");
    assert.doesNotMatch(
      withoutPreview,
      /GC-/,
      "no code material other than the masked preview may appear on the detail page",
    );

    const successEvidence = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(successEntry.reference)}/evidence`,
      withCookie(app.cookie),
    );
    const successEvidenceHtml = await successEvidence.text();
    assert.match(successEvidenceHtml, /sensitive values masked/i);

    const failureId = (
      app.seeded.byName["gift_card_fulfillment_failure"] as SeededOrderEntry
    ).transactionId;
    const failureCards = (
      await app.store.readAll<GiftCardArtifact>("gift_card_artifacts")
    ).filter((artifact) => artifact.transactionId === failureId);
    assert.equal(failureCards.length, 1);
    assert.equal(
      failureCards[0]?.maskedCodePreview,
      null,
      "failed fulfillment must expose no code preview",
    );

    const failureEntry = app.seeded.byName[
      "gift_card_fulfillment_failure"
    ] as SeededOrderEntry;
    const failureDetail = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(failureEntry.reference)}`,
      withCookie(app.cookie),
    );
    const failureDetailHtml = await failureDetail.text();
    const withoutMasked = failureDetailHtml.replace(/GC-[^-]+-\*\*\*\*/g, "");
    assert.doesNotMatch(
      withoutMasked,
      /GC-/,
      "failed gift card must not expose anything beyond masked code previews",
    );
  } finally {
    await app.close();
  }
});

test("pending airline ticket shows no code until issued", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const entry = app.seeded.byName[
      "airline_booking_pending"
    ] as SeededOrderEntry;
    const detail = await fetch(
      `${app.baseUrl}/transactions/${encodeURIComponent(entry.reference)}`,
      withCookie(app.cookie),
    );
    assert.equal(detail.status, 200);
    const detailHtml = await detail.text();
    assert.match(detailHtml, /not issued/);
  } finally {
    await app.close();
  }
});

test("admin dashboard lists queues and moneys at risk", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/admin`, withCookie(app.cookie));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Operational overview/);
    assert.match(html, /marketplace transactions tracked/);
    assert.match(html, /Mismatch/);
    assert.match(html, /Manual review/);
    assert.match(html, /Refund queue/);
    assert.match(html, /Reversal queue/);
    assert.match(html, /Pending provider/);
    assert.match(html, /Money at risk/);
  } finally {
    await app.close();
  }
});

test("admin mismatch queue contains the provider_mismatch transaction", async (t) => {
  const app = await startFullySeededServer(t);
  try {
    const entry = app.seeded.byName["provider_mismatch"] as SeededOrderEntry;
    const res = await fetch(
      `${app.baseUrl}/admin/queues/mismatch`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Mismatch/);
    assert.ok(html.includes(entry.reference));
  } finally {
    await app.close();
  }
});
