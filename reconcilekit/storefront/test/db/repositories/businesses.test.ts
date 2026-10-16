import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { Business } from "../../../src/domain/types.ts";

const prisma = getPrismaClient();

function sampleBusiness(overrides: Partial<Business> = {}): Business {
  return {
    id: "biz_test_1",
    name: "Test Business",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("businesses: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const record = sampleBusiness();
    const saved = await repos.businesses.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.businesses.readLatestById("biz_test_1");
    assert.ok(found !== null);
    assert.equal(found.name, "Test Business");
    assert.equal(found.createdAt, "2026-01-01T00:00:00.000Z");
  });
});

test("businesses: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.businesses.readLatestById("biz_missing"), null);
  });
});

test("businesses: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.businesses.insert(sampleBusiness({ name: "Old Name" }));
    await repos.businesses.insert(sampleBusiness({ name: "New Name" }));

    const found = await repos.businesses.readLatestById("biz_test_1");
    assert.ok(found !== null);
    assert.equal(found.name, "New Name");
  });
});
