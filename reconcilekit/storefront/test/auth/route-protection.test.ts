import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { loadConfig } from "../../src/config.ts";
import { createStorefrontServer } from "../../src/server.ts";
import { demoDeps } from "../marketplace/demo-deps.ts";
import { seedDemoData } from "../../src/marketplace/seed.ts";
import { seedDemoUser } from "../../src/auth/identity.ts";
import { loginAndGetCookie, withCookie } from "./helpers.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

interface ProtServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
}

async function startServer(t: {
  after: (fn: () => void) => void;
}): Promise<ProtServer> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-prot-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  await seedDemoData(store, repos);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      repos,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("not used");
        },
        verifyTransaction: async () => {
          throw new Error("not used");
        },
      },
      marketplace: demoDeps(store),
    },
  );
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((res, rej) =>
        server.close((e) => (e ? rej(e) : res())),
      ),
    store,
  };
}

test("route protection: GET /login is public", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Sign in to MarketPlace/);
  } finally {
    await app.close();
  }
});

test("route protection: unauthenticated GET /dashboard redirects to /login", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/dashboard`, {
      redirect: "manual",
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/login");
  } finally {
    await app.close();
  }
});

test("route protection: unauthenticated GET / redirects to /login", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/`, { redirect: "manual" });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/login");
  } finally {
    await app.close();
  }
});

test("route protection: unauthenticated GET /admin redirects to /login", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/admin`, { redirect: "manual" });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/login");
  } finally {
    await app.close();
  }
});

test("route protection: assets are public", async (t) => {
  const app = await startServer(t);
  try {
    const css = await fetch(`${app.baseUrl}/assets/app.css`);
    assert.equal(css.status, 200);
    const js = await fetch(`${app.baseUrl}/assets/app.js`);
    assert.equal(js.status, 200);
  } finally {
    await app.close();
  }
});

test("route protection: authenticated GET /dashboard serves the dashboard", async (t) => {
  const app = await startServer(t);
  try {
    const cookie = await loginAndGetCookie(app.baseUrl);
    const res = await fetch(
      `${app.baseUrl}/dashboard`,
      withCookie(cookie, { redirect: "manual" }),
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Dashboard/);
  } finally {
    await app.close();
  }
});

test("route protection: authenticated GET / serves the home page", async (t) => {
  const app = await startServer(t);
  try {
    const cookie = await loginAndGetCookie(app.baseUrl);
    const res = await fetch(
      `${app.baseUrl}/`,
      withCookie(cookie, { redirect: "manual" }),
    );
    assert.equal(res.status, 200);
  } finally {
    await app.close();
  }
});

test("route protection: authenticated GET /admin serves admin content (OWNER role)", async (t) => {
  const app = await startServer(t);
  try {
    const cookie = await loginAndGetCookie(app.baseUrl);
    const res = await fetch(
      `${app.baseUrl}/admin`,
      withCookie(cookie, { redirect: "manual" }),
    );
    assert.equal(res.status, 200);
  } finally {
    await app.close();
  }
});

test("route protection: revoked session is treated as unauthenticated", async (t) => {
  const app = await startServer(t);
  try {
    const cookie = await loginAndGetCookie(app.baseUrl);
    // Confirm the session works, then revoke it.
    const okRes = await fetch(
      `${app.baseUrl}/dashboard`,
      withCookie(cookie, { redirect: "manual" }),
    );
    assert.equal(okRes.status, 200);

    await fetch(
      `${app.baseUrl}/logout`,
      withCookie(cookie, {
        method: "POST",
        redirect: "manual",
      }),
    );

    const afterRes = await fetch(
      `${app.baseUrl}/dashboard`,
      withCookie(cookie, { redirect: "manual" }),
    );
    assert.equal(afterRes.status, 303);
    assert.equal(afterRes.headers.get("location"), "/login");
  } finally {
    await app.close();
  }
});

test("route protection: POST /logout without a session still redirects to /login", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/logout`, {
      method: "POST",
      redirect: "manual",
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/login");
  } finally {
    await app.close();
  }
});
