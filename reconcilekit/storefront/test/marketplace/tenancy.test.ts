import { test } from "node:test";
import assert from "node:assert/strict";
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

const prisma = getPrismaClient();

test("tenancy: seed creates the demo org", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const org = await getOrganization(repos, DEMO_ORG_ID);
    assert.ok(org !== null);
    assert.equal(org.id, "org_demo");
    const all = await listOrganizations(repos);
    assert.equal(all.length, 1);
  });
});

test("tenancy: seed creates a membership tying the demo user to the demo org", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const membership = await getMembership(repos, DEMO_USER_ID, DEMO_ORG_ID);
    assert.ok(membership !== null);
    assert.equal(membership.id, DEMO_MEMBERSHIP_ID);
    assert.equal(membership.role, "OWNER");

    const forUser = await listMembershipsForUser(repos, DEMO_USER_ID);
    assert.equal(forUser.length, 1);
  });
});

test("tenancy: seed creates the demo customer with org_id set", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const customer =
      await repos.marketplaceCustomers.readLatestById(DEMO_CUSTOMER_ID);
    assert.ok(customer !== null);
    assert.equal(customer.org_id, DEMO_ORG_ID);
  });
});

test("tenancy: customerProfile returns the org_id from the stored record", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const profile = await customerProfile(repos, DEMO_CUSTOMER_ID);
    assert.equal(profile.org_id, DEMO_ORG_ID);
  });
});

test("tenancy: customerBelongsToOrg is true for the demo org", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    assert.equal(
      await customerBelongsToOrg(repos, DEMO_CUSTOMER_ID, DEMO_ORG_ID),
      true,
    );
  });
});

test("tenancy: customerBelongsToOrg is false for an unrelated org", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    assert.equal(
      await customerBelongsToOrg(repos, DEMO_CUSTOMER_ID, "org_other"),
      false,
    );
  });
});

test("tenancy: customerBelongsToOrg is false for an unknown customer", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    assert.equal(
      await customerBelongsToOrg(repos, "cus_does_not_exist", DEMO_ORG_ID),
      false,
    );
  });
});

test("tenancy: listCustomersInOrg scopes correctly", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const inDemo = await listCustomersInOrg(repos, DEMO_ORG_ID);
    assert.ok(inDemo.length >= 1);
    for (const customer of inDemo) {
      assert.equal(customer.org_id, DEMO_ORG_ID);
    }
    const inOther = await listCustomersInOrg(repos, "org_other");
    assert.equal(inOther.length, 0);
  });
});

test("tenancy: seed is idempotent — no duplicate org, membership, or customers", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    const customersAfterFirst =
      await repos.marketplaceCustomers.listByOrg(DEMO_ORG_ID);

    await seedDemoData(repos);

    const orgs = await repos.organizations.list();
    assert.equal(orgs.length, 1);

    const mems = await repos.memberships.listByUser(DEMO_USER_ID);
    assert.equal(mems.length, 1);

    const customersAfterSecond =
      await repos.marketplaceCustomers.listByOrg(DEMO_ORG_ID);
    assert.equal(
      customersAfterSecond.length,
      customersAfterFirst.length,
      "second seed run must not add customers",
    );
  });
});

test("tenancy: no org dimension is fabricated on wallet evidence", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoData(repos);
    // Frozen invariant (handoff section 3): wallet_ledger and evidence_packs
    // carry no org_id. Scoping flows wallet_ledger.wallet_id ->
    // wallets.customer_id -> marketplace_customers.org_id.
    // Post-1e this kind is Postgres-only; the previous JSONL read returned
    // [] vacuously. Read the persisted rows inside this rollback transaction
    // and assert the invariant at row level.
    const ledgerRows = await tx.walletLedgerEntry.findMany();
    assert.ok(ledgerRows.length > 0, "seed must produce wallet evidence");
    for (const entry of ledgerRows) {
      assert.equal("orgId" in entry, false, "ledger entry carries no orgId");
      assert.equal("org_id" in entry, false, "ledger entry carries no org_id");
      assert.equal(
        "organizationId" in entry,
        false,
        "ledger entry carries no organizationId",
      );
    }
  });
});
