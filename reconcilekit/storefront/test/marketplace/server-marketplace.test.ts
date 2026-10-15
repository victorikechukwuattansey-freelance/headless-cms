import { test } from "node:test";
import assert from "node:assert/strict";
import { startSeededServer } from "./seeded-server.ts";

test("transaction detail page explains money provider and ReconcileKit result", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/transactions/${app.reference}`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /What happened to your money/);
    assert.match(html, /Provider response/);
    assert.match(html, /ReconcileKit determination/);
    assert.match(html, /Simulated data/);
  } finally {
    await app.close();
  }
});

test("home page loads with dashboard data", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /ReconcileKit/);
    assert.match(html, /Dashboard/);
  } finally {
    await app.close();
  }
});

test("login page loads with demo identity", async (t) => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/login`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Sign in to MarketPlace/);
    assert.match(html, /name="email"/);
    assert.match(html, /name="password"/);
    assert.match(html, /demo@example\.com/);
  } finally {
    await app.close();
  }
});

test("dashboard page shows wallet and transactions", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/dashboard`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Wallet/);
    assert.match(html, /Recent transactions/);
  } finally {
    await app.close();
  }
});

test("wallet page shows balance and ledger", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/wallet`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Available/);
    assert.match(html, /Ledger/);
  } finally {
    await app.close();
  }
});

test("catalog page lists service groups", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/catalog`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /CORE VTU BILL PAYMENT/);
    assert.match(html, /DIGITAL GOODS/);
  } finally {
    await app.close();
  }
});

test("service detail page for airtime", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/services/svc_airtime_mtn`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Airtime/);
    assert.match(html, /MTN/);
  } finally {
    await app.close();
  }
});

test("checkout page for airtime shows form and scenario selector", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/checkout/svc_airtime_mtn`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Checkout/);
    assert.match(html, /scenario/);
  } finally {
    await app.close();
  }
});

test("transactions list page", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/transactions`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Transactions/);
  } finally {
    await app.close();
  }
});

test("receipt page renders", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(
      `${app.baseUrl}/transactions/${app.reference}/receipt`,
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Receipt/);
    assert.match(html, /ReconcileKit/);
  } finally {
    await app.close();
  }
});

test("evidence page renders with provider facts", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(
      `${app.baseUrl}/transactions/${app.reference}/evidence`,
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Evidence pack/);
    assert.match(html, /Provider facts/);
  } finally {
    await app.close();
  }
});

test("notifications page", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/notifications`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Notifications/);
  } finally {
    await app.close();
  }
});

test("disputes page", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/disputes`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Disputes/);
  } finally {
    await app.close();
  }
});

test("profile page", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/profile`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Profile/);
    assert.match(html, /Demo Customer/);
  } finally {
    await app.close();
  }
});

test("admin dashboard loads", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/admin`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Admin/);
    assert.match(html, /Operational overview/);
  } finally {
    await app.close();
  }
});

test("admin queue page for HEALTHY", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/admin/queues/healthy`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Healthy/);
  } finally {
    await app.close();
  }
});

test("admin transaction detail", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(
      `${app.baseUrl}/admin/transactions/${app.reference}`,
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Transaction/);
    assert.match(html, /Money/);
    assert.match(html, /ReconcileKit determination/);
  } finally {
    await app.close();
  }
});

test("admin evidence detail", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(
      `${app.baseUrl}/admin/transactions/${app.reference}/evidence`,
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Evidence detail/);
    assert.match(html, /Evidence pack contents/);
  } finally {
    await app.close();
  }
});

test("assets are served", async () => {
  const app = await startSeededServer();
  try {
    const css = await fetch(`${app.baseUrl}/assets/app.css`);
    assert.equal(css.status, 200);
    assert.match(css.headers.get("content-type") ?? "", /text\/css/);

    const js = await fetch(`${app.baseUrl}/assets/app.js`);
    assert.equal(js.status, 200);
    assert.match(js.headers.get("content-type") ?? "", /text\/javascript/);
  } finally {
    await app.close();
  }
});

test("unknown marketplace route returns 404 HTML", async () => {
  const app = await startSeededServer();
  try {
    const res = await fetch(`${app.baseUrl}/nonexistent-page`);
    assert.equal(res.status, 404);
    const html = await res.text();
    assert.match(html, /Error 404/);
    assert.match(html, /Dashboard/); // back link to dashboard
  } finally {
    await app.close();
  }
});

test("POST /checkout creates transaction and redirects", async () => {
  const app = await startSeededServer();
  try {
    const form = new URLSearchParams({
      service: "svc_airtime_mtn",
      scenario: "SUCCESS",
      "inputs[network]": "MTN",
      "inputs[recipient]": "08030000000",
      "inputs[amount]": "1000",
    });
    const res = await fetch(`${app.baseUrl}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      redirect: "manual",
    });
    assert.equal(res.status, 303);
    const location = res.headers.get("location");
    assert.ok(location?.startsWith("/transactions/"));
  } finally {
    await app.close();
  }
});
