import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedOrg, seedUser } from "../fixtures.ts";
import type { SessionRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedContext(tx: Parameters<typeof seedOrg>[0]): Promise<void> {
  await seedOrg(tx, "org_demo");
  await seedUser(tx, { id: "usr_demo" });
}

function sampleSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "sess_token_abc",
    user_id: "usr_demo",
    active_org_id: "org_demo",
    created_at: "2026-01-01T12:00:00.000Z",
    expires_at: "2026-01-02T12:00:00.000Z",
    revoked_at: null,
    simulated: true,
    ...overrides,
  };
}

test("sessions: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedContext(tx);
    const record = sampleSession();
    const saved = await repos.sessions.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.sessions.readLatestById("sess_token_abc");
    assert.ok(found !== null);
    assert.equal(found.user_id, "usr_demo");
    assert.equal(found.active_org_id, "org_demo");
    assert.equal(found.revoked_at, null);
  });
});

test("sessions: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.sessions.readLatestById("sess_missing"), null);
  });
});

test("sessions: insert with an existing id overwrites (revocation wins)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedContext(tx);
    await repos.sessions.insert(sampleSession({ revoked_at: null }));
    await repos.sessions.insert(
      sampleSession({ revoked_at: "2026-01-01T13:00:00.000Z" }),
    );

    const found = await repos.sessions.readLatestById("sess_token_abc");
    assert.ok(found !== null);
    assert.equal(found.revoked_at, "2026-01-01T13:00:00.000Z");
  });
});
