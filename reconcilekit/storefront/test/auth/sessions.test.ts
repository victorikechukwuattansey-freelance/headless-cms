import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  createSession,
  lookupSession,
  revokeSession,
  sessionRecordId,
} from "../../src/auth/sessions.ts";

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-auth-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("sessions: createSession persists a record with the expected shape", async (t) => {
  const store = tempStore(t);
  const { token, record } = await createSession(store, {
    userId: "usr_demo",
    ttlHours: 72,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  assert.ok(token.length >= 32);
  assert.equal(record.id, sessionRecordId(token));
  assert.equal(record.user_id, "usr_demo");
  assert.equal(record.revoked_at, null);
  assert.equal(record.created_at, "2026-01-01T00:00:00.000Z");
  assert.equal(record.expires_at, "2026-01-04T00:00:00.000Z");
  assert.equal(record.simulated, true);
});

test("sessions: lookupSession finds a valid session", async (t) => {
  const store = tempStore(t);
  const { token } = await createSession(store, {
    userId: "usr_demo",
    ttlHours: 72,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  const found = await lookupSession(
    store,
    token,
    new Date("2026-01-02T00:00:00Z"),
  );
  assert.ok(found !== null);
  assert.equal(found.user_id, "usr_demo");
});

test("sessions: lookupSession returns null for an unknown token", async (t) => {
  const store = tempStore(t);
  assert.equal(await lookupSession(store, "no-such-token"), null);
});

test("sessions: lookupSession rejects an expired session", async (t) => {
  const store = tempStore(t);
  const { token } = await createSession(store, {
    userId: "usr_demo",
    ttlHours: 1,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  const found = await lookupSession(
    store,
    token,
    new Date("2026-01-01T02:00:00Z"),
  );
  assert.equal(found, null);
});

test("sessions: revokeSession marks the latest record revoked", async (t) => {
  const store = tempStore(t);
  const { token } = await createSession(store, {
    userId: "usr_demo",
    ttlHours: 72,
    now: new Date("2026-01-01T00:00:00Z"),
  });
  const revoked = await revokeSession(
    store,
    token,
    new Date("2026-01-01T01:00:00Z"),
  );
  assert.equal(revoked, true);
  const found = await lookupSession(
    store,
    token,
    new Date("2026-01-01T02:00:00Z"),
  );
  assert.equal(found, null);
});

test("sessions: revokeSession is idempotent", async (t) => {
  const store = tempStore(t);
  const { token } = await createSession(store, {
    userId: "usr_demo",
    ttlHours: 1,
  });
  assert.equal(await revokeSession(store, token), true);
  assert.equal(await revokeSession(store, token), false);
});

test("sessions: distinct calls produce distinct tokens", async (t) => {
  const store = tempStore(t);
  const a = await createSession(store, { userId: "u", ttlHours: 1 });
  const b = await createSession(store, { userId: "u", ttlHours: 1 });
  assert.notEqual(a.token, b.token);
});
