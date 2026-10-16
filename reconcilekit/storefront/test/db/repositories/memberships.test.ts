import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import { seedOrg, seedUser } from "../fixtures.ts";
import type { MembershipRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedContext(
  tx: Parameters<typeof seedOrg>[0],
): Promise<void> {
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
    await seedContext(tx);

    await repos.memberships.insert(
      sampleMembership({ id: "mem_b", user_id: "usr_demo", org_id: "org_other" }),
    );
    await repos.memberships.insert(
      sampleMembership({ id: "mem_a", user_id: "usr_demo", org_id: "org_demo" }),
    );
    await repos.memberships.insert(
      sampleMembership({ id: "mem_z", user_id: "usr_other", org_id: "org_demo" }),
    );

    const demo = await repos.memberships.listByUser("usr_demo");
    assert.equal(demo.length, 2);
    assert.deepEqual(
      demo.map((row) => row.id),
      ["mem_a", "mem_b"],
    );
    for (const row of demo) {
      assert.equal(row.user_id, "usr_demo");
    }
  });
});