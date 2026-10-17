import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import { seedDemoData } from "../../src/marketplace/seed.ts";
import {
  DEMO_MEMBERSHIP_ID,
  DEMO_ORG_ID,
  customerBelongsToOrg,
  getMembership,
  getOrganization,
  listCustomersInOrg,
  listMembershipsForUser,
  listOrganizations,
} from "../../src/marketplace/tenancy.ts";
import { DEMO_USER_ID } from "../../src/auth/identity.ts";
import { customerProfile, DEMO_CUSTOMER_ID } from "../../src/ui/client.ts";
import type { MarketplaceCustomer } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-tenancy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("tenancy: seed creates the demo org", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const org = await getOrganization(repos, DEMO_ORG_ID);
    assert.ok(org !== null);
    assert.equal(org.id, "org_demo");
    const all = await listOrganizations(repos);
    assert.equal(all.length, 1);
  });
});

test("tenancy: seed creates a membership tying the demo user to the demo org", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const membership = await getMembership(repos, DEMO_USER_ID, DEMO_ORG_ID);
    assert.ok(membership !== null);
    assert.equal(membership.id, DEMO_MEMBERSHIP_ID);
    assert.equal(membership.role, "OWNER");

    const forUser = await listMembershipsForUser(repos, DEMO_USER_ID);
    assert.equal(forUser.length, 1);
  });
});

test("tenancy: seed creates the demo customer with org_id set (JSONL)", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const customer = await store.readLatestById<MarketplaceCustomer>(
      "marketplace_customers",
      DEMO_CUSTOMER_ID,
    );
    assert.ok(customer !== null);
    assert.equal(customer.org_id, DEMO_ORG_ID);
  });
});

test("tenancy: customerProfile returns the org_id from the stored record", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const profile = await customerProfile(store, DEMO_CUSTOMER_ID);
    assert.equal(profile.org_id, DEMO_ORG_ID);
  });
});

test("tenancy: customerBelongsToOrg is true for the demo org", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    assert.equal(
      await customerBelongsToOrg(store, DEMO_CUSTOMER_ID, DEMO_ORG_ID),
      true,
    );
  });
});

test("tenancy: customerBelongsToOrg is false for an unrelated org", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    assert.equal(
      await customerBelongsToOrg(store, DEMO_CUSTOMER_ID, "org_other"),
      false,
    );
  });
});

test("tenancy: customerBelongsToOrg is false for an unknown customer", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    assert.equal(
      await customerBelongsToOrg(store, "cus_does_not_exist", DEMO_ORG_ID),
      false,
    );
  });
});

test("tenancy: listCustomersInOrg scopes correctly", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const inDemo = await listCustomersInOrg(store, DEMO_ORG_ID);
    assert.ok(inDemo.length >= 1);
    for (const customer of inDemo) {
      assert.equal(customer.org_id, DEMO_ORG_ID);
    }
    const inOther = await listCustomersInOrg(store, "org_other");
    assert.equal(inOther.length, 0);
  });
});

test("tenancy: seed is idempotent — no duplicate org, membership, or customers", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    await seedDemoData(store, repos);

    const orgs = await repos.organizations.list();
    assert.equal(orgs.length, 1);

    const mems = await repos.memberships.listByUser(DEMO_USER_ID);
    assert.equal(mems.length, 1);

    const customers = await store.readAll<MarketplaceCustomer>(
      "marketplace_customers",
    );
    const unique = new Set(customers.map((c) => c.id));
    assert.equal(unique.size, 2);
  });
});

test("tenancy: no org dimension is fabricated on wallet evidence", async (t) => {
  const store = tempStore(t);
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(store, repos);
    const ledger =
      await store.readAll<Record<string, unknown>>("wallet_ledger");
    for (const entry of ledger) {
      assert.equal("org_id" in entry, false, "ledger entry carries no org_id");
    }
  });
});
