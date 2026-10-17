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
    await repos.organizations.insert(
      sampleOrg({ id: "test_org_c", name: "C" }),
    );
    await repos.organizations.insert(
      sampleOrg({ id: "test_org_a", name: "A" }),
    );
    await repos.organizations.insert(
      sampleOrg({ id: "test_org_b", name: "B" }),
    );

    // Filter to the rows this test inserted. The DB may already contain
    // demo data (org_demo) committed by HTTP test fixtures that seed
    // outside any transaction, so an unfiltered count is not reliable.
    const all = await repos.organizations.list();
    const testRows = all.filter((row) => row.id.startsWith("test_org_"));
    assert.equal(testRows.length, 3);
    assert.deepEqual(
      testRows.map((row) => row.id),
      ["test_org_a", "test_org_b", "test_org_c"],
    );
  });
});
