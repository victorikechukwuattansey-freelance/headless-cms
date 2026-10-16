import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { UserRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleUser(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: "usr_test_1",
    email: "test@example.com",
    password_hash: "$argon2id$v=19$m=19456,t=2,p=1$placeholder",
    display_name: "Test User",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("users: insert persists and findById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const record = sampleUser();
    const saved = await repos.users.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.users.findById("usr_test_1");
    assert.ok(found !== null);
    assert.equal(found.email, "test@example.com");
    assert.equal(found.display_name, "Test User");
    assert.equal(found.simulated, true);
  });
});

test("users: findById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.users.findById("usr_missing"), null);
  });
});

test("users: insert with an existing id overwrites (upsert, not throw)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.users.insert(sampleUser());
    await repos.users.insert(
      sampleUser({
        display_name: "Updated Name",
        updated_at: "2026-01-02T00:00:00.000Z",
      }),
    );
    const found = await repos.users.findById("usr_test_1");
    assert.ok(found !== null);
    assert.equal(found.display_name, "Updated Name");
    assert.equal(found.updated_at, "2026-01-02T00:00:00.000Z");
  });
});

test("users: findByEmail normalizes case and whitespace", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.users.insert(sampleUser({ email: "case@example.com" }));
    assert.ok((await repos.users.findByEmail("case@example.com")) !== null);
    assert.ok((await repos.users.findByEmail("CASE@example.com")) !== null);
    assert.ok((await repos.users.findByEmail("  case@example.com  ")) !== null);
    assert.equal(await repos.users.findByEmail("other@example.com"), null);
  });
});