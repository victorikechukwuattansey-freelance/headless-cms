import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { OrganizationRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function sampleOrg(
  overrides: Partial<OrganizationRecord> = {},
): OrganizationRecord {
  return {
    id: "org_demo",
    name: "Demo Organization",
    created_at: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("organizations: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const record = sampleOrg();
    const saved = await repos.organizations.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.organizations.readLatestById("org_demo");
    assert.ok(found !== null);
    assert.equal(found.name, "Demo Organization");
    assert.equal(found.simulated, true);
  });
});

test("organizations: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.organizations.readLatestById("org_missing"), null);
  });
});

test("organizations: list returns all in id order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.organizations.insert(sampleOrg({ id: "org_c", name: "C" }));
    await repos.organizations.insert(sampleOrg({ id: "org_a", name: "A" }));
    await repos.organizations.insert(sampleOrg({ id: "org_b", name: "B" }));

    const rows = await repos.organizations.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["org_a", "org_b", "org_c"],
    );
  });
});
