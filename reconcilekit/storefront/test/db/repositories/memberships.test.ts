import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedOrg, seedUser } from "../fixtures.ts";
import type { MembershipRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedContext(tx: Parameters<typeof seedOrg>[0]): Promise<void> {
  await seedOrg(tx, "org_demo");
  await seedOrg(tx, "org_other");
  await seedUser(tx, { id: "usr_demo" });
  await seedUser(tx, { id: "usr_other" });
}

function sampleMembership(
  overrides: Partial<MembershipRecord> = {},
): MembershipRecord {
  return {
    id: "mem_demo",
    user_id: "usr_demo",
    org_id: "org_demo",
    role: "OWNER",
    created_at: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("memberships: insert persists and findByUserAndOrg reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedContext(tx);
    const record = sampleMembership();
    const saved = await repos.memberships.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.memberships.findByUserAndOrg(
      "usr_demo",
      "org_demo",
    );
    assert.ok(found !== null);
    assert.equal(found.role, "OWNER");
    assert.equal(found.simulated, true);
  });
});

test("memberships: findByUserAndOrg returns null for an unknown pair", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedContext(tx);
    assert.equal(
      await repos.memberships.findByUserAndOrg("usr_demo", "org_missing"),
      null,
    );
    assert.equal(
      await repos.memberships.findByUserAndOrg("usr_missing", "org_demo"),
      null,
    );
  });
});

test("memberships: insert with an existing id overwrites (role change)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedContext(tx);
    await repos.memberships.insert(sampleMembership({ role: "VIEWER" }));
    await repos.memberships.insert(sampleMembership({ role: "OWNER" }));

    const found = await repos.memberships.findByUserAndOrg(
      "usr_demo",
      "org_demo",
    );
    assert.ok(found !== null);
    assert.equal(found.role, "OWNER");
  });
});

test("memberships: listByUser isolates users and orders by id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedOrg(tx, "test_org_1");
    await seedOrg(tx, "test_org_2");
    await seedUser(tx, { id: "test_usr_1" });
    await seedUser(tx, { id: "test_usr_2" });

    // Use test-scoped (user, org) pairs: the unique constraint is on
    // (user_id, org_id), and HTTP test fixtures commit the demo pair
    // outside any transaction, so the demo pair must not be reused here.
    await repos.memberships.insert(
      sampleMembership({
        id: "test_mem_b",
        user_id: "test_usr_1",
        org_id: "test_org_2",
      }),
    );
    await repos.memberships.insert(
      sampleMembership({
        id: "test_mem_a",
        user_id: "test_usr_1",
        org_id: "test_org_1",
      }),
    );
    await repos.memberships.insert(
      sampleMembership({
        id: "test_mem_z",
        user_id: "test_usr_2",
        org_id: "test_org_1",
      }),
    );

    const demo = await repos.memberships.listByUser("test_usr_1");
    assert.equal(demo.length, 2);
    assert.deepEqual(
      demo.map((row) => row.id),
      ["test_mem_a", "test_mem_b"],
    );
    for (const row of demo) {
      assert.equal(row.user_id, "test_usr_1");
    }
  });
});
