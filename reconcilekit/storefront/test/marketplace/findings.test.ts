import { test, beforeEach, after } from "node:test";
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
import { loginAndGetCookie, withCookie } from "../auth/helpers.ts";
import type { EvidencePack } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

beforeEach(async () => {
  await truncateCommittedState(prisma);
});

after(async () => {
  await truncateCommittedState(prisma);
});

interface FindingsServer {
  readonly baseUrl: string;
  readonly cookie: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
  readonly seeded: SeededDemoData;
}

async function startServer(t: {
  after: (fn: () => void) => void;
}): Promise<FindingsServer> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-findings-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  const seeded = await seedDemoData(store, repos);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      repos,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("Paystack not used in findings tests");
        },
        verifyTransaction: async () => {
          throw new Error("Paystack not used in findings tests");
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

function entryOf(app: FindingsServer, name: string): SeededOrderEntry {
  const entry = app.seeded.byName[name] as SeededOrderEntry;
  assert.ok(entry, `seed entry ${name}`);
  return entry;
}

test("3D summary: lists every non-MATCH evidence pack and omits MATCH", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/findings`, withCookie(app.cookie));
    assert.equal(res.status, 200, "summary status");
    const html = await res.text();

    for (const name of [
      "provider_mismatch",
      "provider_timeout",
      "manual_review",
    ]) {
      const entry = entryOf(app, name);
      assert.ok(
        html.includes(entry.reference),
        `summary lists ${name} (${entry.reference})`,
      );
    }

    for (const name of ["successful_airtime", "successful_gift_card"]) {
      const entry = entryOf(app, name);
      assert.equal(
        html.includes(entry.reference),
        false,
        `summary omits MATCH scenario ${name}`,
      );
    }
  } finally {
    await app.close();
  }
});

test("3D summary: shows outcome, codes, and amount for each finding", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/findings`, withCookie(app.cookie));
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /DISCREPANCY|UNRESOLVED|MISSING_PROVIDER_RECORD/);
    assert.match(html, /AMOUNT_MISMATCH/);
  } finally {
    await app.close();
  }
});

test("3D determination: shows merchant side, provider side, and engine outcome", async (t) => {
  const app = await startServer(t);
  try {
    const entry = entryOf(app, "provider_mismatch");
    const res = await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 200);
    const html = await res.text();

    assert.match(html, /What the merchant recorded/);
    assert.match(html, /What the provider recorded/);
    assert.match(html, /What ReconcileKit determined/);
    assert.match(html, /What this means/);
    assert.match(html, /What happens next/);
    assert.match(html, /AMOUNT_MISMATCH/);
    assert.match(html, /DISCREPANCY/);
    assert.ok(html.includes(entry.transaction.id), "join anchor rendered");
    assert.ok(html.includes(entry.reference), "display reference rendered");
  } finally {
    await app.close();
  }
});

test("3D determination: STATUS_UNRESOLVED gets the do-not-fulfill explanation", async (t) => {
  const app = await startServer(t);
  try {
    const entry = entryOf(app, "manual_review");
    const res = await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Do not fulfill/);
    assert.match(html, /leave unresolved/i);
  } finally {
    await app.close();
  }
});

test("3D determination: unknown identifier is a 404", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent("txn_does_not_exist")}`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 404);
  } finally {
    await app.close();
  }
});

test("3D evidence: shows masked provider facts and the reconciliation snapshot", async (t) => {
  const app = await startServer(t);
  try {
    const entry = entryOf(app, "provider_mismatch");
    const res = await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}/evidence`,
      withCookie(app.cookie),
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Reconciliation snapshot/);
    assert.match(html, /Provider facts — sensitive values masked/);
    assert.match(html, /AMOUNT_MISMATCH/);
  } finally {
    await app.close();
  }
});

test("3D evidence: gift-card codes stay masked on the finding evidence route", async (t) => {
  const app = await startServer(t);
  try {
    const entry = entryOf(app, "provider_mismatch");
    const res = await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}/evidence`,
      withCookie(app.cookie),
    );
    const html = await res.text();
    assert.doesNotMatch(html, /"code":"/, "no unmasked code material");
  } finally {
    await app.close();
  }
});

test("3D workflow: summary → determination → evidence reachable in exactly 3 GETs", async (t) => {
  const app = await startServer(t);
  try {
    const summary = await fetch(
      `${app.baseUrl}/findings`,
      withCookie(app.cookie),
    );
    assert.equal(summary.status, 200);
    const summaryHtml = await summary.text();

    const hrefMatch = summaryHtml.match(/href="(\/findings\/[^"]+)"/);
    assert.ok(hrefMatch, "summary exposes a determination link");
    const determinationPath = hrefMatch[1] as string;

    const determination = await fetch(
      `${app.baseUrl}${determinationPath}`,
      withCookie(app.cookie),
    );
    assert.equal(determination.status, 200);
    const determinationHtml = await determination.text();

    const evidenceMatch = determinationHtml.match(
      /href="(\/findings\/[^"]+\/evidence)"/,
    );
    assert.ok(evidenceMatch, "determination exposes an evidence link");
    const evidencePath = evidenceMatch[1] as string;

    const evidence = await fetch(
      `${app.baseUrl}${evidencePath}`,
      withCookie(app.cookie),
    );
    assert.equal(evidence.status, 200);
    const evidenceHtml = await evidence.text();
    assert.match(evidenceHtml, /Reconciliation snapshot/);
  } finally {
    await app.close();
  }
});

test("3D workflow: read-only — no store mutations across the three pages", async (t) => {
  const app = await startServer(t);
  try {
    const before = {
      packs: await app.store.readAll<EvidencePack>("evidence_packs"),
      txns: await repos.marketplaceTransactions.list(),
    };

    await fetch(`${app.baseUrl}/findings`, withCookie(app.cookie));
    const entry = entryOf(app, "provider_mismatch");
    await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}`,
      withCookie(app.cookie),
    );
    await fetch(
      `${app.baseUrl}/findings/${encodeURIComponent(entry.reference)}/evidence`,
      withCookie(app.cookie),
    );

    const after = {
      packs: await app.store.readAll<EvidencePack>("evidence_packs"),
      txns: await repos.marketplaceTransactions.list(),
    };

    assert.deepEqual(after, before, "3D must not mutate the store");
  } finally {
    await app.close();
  }
});

test("3D workflow: does not touch the frozen engine — no new discrepancy codes appear", async (t) => {
  const app = await startServer(t);
  try {
    const packs = await app.store.readAll<EvidencePack>("evidence_packs");
    const codes = new Set<string>();
    for (const pack of packs) {
      for (const code of pack.reconciliation?.codes ?? []) codes.add(code);
      for (const flag of pack.mismatchFlags) codes.add(flag);
    }
    for (const code of codes) {
      assert.ok(
        [
          "AMOUNT_MISMATCH",
          "CURRENCY_MISMATCH",
          "STATUS_MISMATCH",
          "TEMPORAL_ANOMALY",
          "DUPLICATE_MERCHANT_RECORD",
          "DUPLICATE_PROVIDER_RECORD",
          "CONFLICTING_ATTRIBUTES",
          "STATUS_UNRESOLVED",
        ].includes(code),
        `unexpected code ${code}`,
      );
    }
  } finally {
    await app.close();
  }
});

test("3D nav: Findings appears in the customer nav", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/findings`, withCookie(app.cookie));
    const html = await res.text();
    assert.match(html, /href="\/findings"[^>]*>/);
    assert.match(html, />Findings</);
  } finally {
    await app.close();
  }
});
