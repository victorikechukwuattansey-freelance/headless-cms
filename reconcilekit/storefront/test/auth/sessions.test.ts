import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { seedOrg, seedUser } from "../db/fixtures.ts";
import {
  createSession,
  lookupSession,
  revokeSession,
  sessionRecordId,
} from "../../src/auth/sessions.ts";

const prisma = getPrismaClient();

async function seedContext(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_demo");
  await seedUser(tx, { id: "usr_demo" });
}

test("sessions: createSession persists a record with the expected shape", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const { token, record } = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 72,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    assert.ok(token.length >= 32);
    assert.equal(record.id, sessionRecordId(token));
    assert.equal(record.user_id, "usr_demo");
    assert.equal(record.active_org_id, "org_demo");
    assert.equal(record.revoked_at, null);
    assert.equal(record.created_at, "2026-01-01T00:00:00.000Z");
    assert.equal(record.expires_at, "2026-01-04T00:00:00.000Z");
    assert.equal(record.simulated, true);
  });
});

test("sessions: lookupSession finds a valid session", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const { token } = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 72,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const found = await lookupSession(
      repos,
      token,
      new Date("2026-01-02T00:00:00Z"),
    );
    assert.ok(found !== null);
    assert.equal(found.user_id, "usr_demo");
  });
});

test("sessions: lookupSession returns null for an unknown token", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await lookupSession(repos, "no-such-token"), null);
  });
});

test("sessions: lookupSession rejects an expired session", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const { token } = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 1,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const found = await lookupSession(
      repos,
      token,
      new Date("2026-01-01T02:00:00Z"),
    );
    assert.equal(found, null);
  });
});

test("sessions: revokeSession marks the latest record revoked", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const { token } = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 72,
      now: new Date("2026-01-01T00:00:00Z"),
    });
    const revoked = await revokeSession(
      repos,
      token,
      new Date("2026-01-01T01:00:00Z"),
    );
    assert.equal(revoked, true);
    const found = await lookupSession(
      repos,
      token,
      new Date("2026-01-01T02:00:00Z"),
    );
    assert.equal(found, null);
  });
});

test("sessions: revokeSession is idempotent", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const { token } = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 1,
    });
    assert.equal(await revokeSession(repos, token), true);
    assert.equal(await revokeSession(repos, token), false);
  });
});

test("sessions: distinct calls produce distinct tokens", async () => {
  await withRollback(prisma, async (tx) => {
    await seedContext(tx);
    const repos = buildRepositories(tx);
    const a = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 1,
    });
    const b = await createSession(repos, {
      userId: "usr_demo",
      activeOrgId: "org_demo",
      ttlHours: 1,
    });
    assert.notEqual(a.token, b.token);
  });
});
