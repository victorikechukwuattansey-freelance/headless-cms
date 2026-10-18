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
import { seedDemoUser } from "../../src/auth/identity.ts";
import { lookupSession } from "../../src/auth/sessions.ts";
import { seedDemoTenancy } from "../../src/marketplace/seed.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

interface FlowServer {
  readonly baseUrl: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
}

async function startServer(t: {
  after: (fn: () => void) => void;
}): Promise<FlowServer> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-login-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  await seedDemoUser(repos);
  await seedDemoTenancy(repos);
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
      marketplace: demoDeps(repos),
    },
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    store,
  };
}

function extractSessionCookie(headers: Headers): string | null {
  const header = headers.get("set-cookie");
  if (header === null) return null;
  const match = /^rk_session=([^;]+)/.exec(header);
  return match === null ? null : match[1];
}

test("login flow: correct credentials set a session cookie and redirect", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: "demo@example.com",
        password: "demo-password",
      }).toString(),
      redirect: "manual",
    });
    assert.equal(res.status, 303);
    assert.equal(res.headers.get("location"), "/");
    const token = extractSessionCookie(res.headers);
    assert.ok(token !== null, "session cookie set");
    const record = await lookupSession(repos, token);
    assert.ok(record !== null, "session record exists");
    assert.equal(record.user_id, "usr_demo");
    assert.equal(record.active_org_id, "org_demo");
  } finally {
    await app.close();
  }
});

test("login flow: wrong password returns 401 and does not set a cookie", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: "demo@example.com",
        password: "wrong-password",
      }).toString(),
      redirect: "manual",
    });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get("set-cookie"), null);
  } finally {
    await app.close();
  }
});

test("login flow: missing fields returns 401 with an error page", async (t) => {
  const app = await startServer(t);
  try {
    const res = await fetch(`${app.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ email: "", password: "" }).toString(),
      redirect: "manual",
    });
    assert.equal(res.status, 401);
    const body = await res.text();
    assert.match(body, /Email and password are required/);
  } finally {
    await app.close();
  }
});

test("login flow: logout revokes the session and clears the cookie", async (t) => {
  const app = await startServer(t);
  try {
    const loginRes = await fetch(`${app.baseUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: "demo@example.com",
        password: "demo-password",
      }).toString(),
      redirect: "manual",
    });
    const token = extractSessionCookie(loginRes.headers);
    assert.ok(token !== null);

    const logoutRes = await fetch(`${app.baseUrl}/logout`, {
      method: "POST",
      headers: { Cookie: `rk_session=${token}` },
      redirect: "manual",
    });
    assert.equal(logoutRes.status, 303);
    assert.equal(logoutRes.headers.get("location"), "/login");
    const cleared = logoutRes.headers.get("set-cookie") ?? "";
    assert.match(cleared, /Max-Age=0/);

    const record = await lookupSession(repos, token);
    assert.equal(record, null);
  } finally {
    await app.close();
  }
});

test("login flow: sessions persist across a server restart", async (t) => {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-login-restart-"));
  t.after(() => rmSync(dataDir, { recursive: true, force: true }));
  const store = new JsonlStore(dataDir);
  await seedDemoUser(repos);
  await seedDemoTenancy(repos);

  const config = loadConfig({ STOREFRONT_DATA_DIR: dataDir });
  const deps = {
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
    marketplace: demoDeps(repos),
  };

  const server1 = createStorefrontServer(config, deps);
  await new Promise<void>((r) => server1.listen(0, "127.0.0.1", r));
  const port1 = (server1.address() as AddressInfo).port;
  const loginRes = await fetch(`http://127.0.0.1:${port1}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: "demo@example.com",
      password: "demo-password",
    }).toString(),
    redirect: "manual",
  });
  const token = extractSessionCookie(loginRes.headers);
  await new Promise<void>((r, j) => server1.close((e) => (e ? j(e) : r())));

  const server2 = createStorefrontServer(config, deps);
  await new Promise<void>((r) => server2.listen(0, "127.0.0.1", r));
  try {
    const record = await lookupSession(repos, token as string);
    assert.ok(record !== null, "session survives restart (stored on disk)");
  } finally {
    await new Promise<void>((r, j) => server2.close((e) => (e ? j(e) : r())));
  }
});
