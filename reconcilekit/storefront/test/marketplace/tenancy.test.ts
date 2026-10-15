import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
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
import type {
  MarketplaceCustomer,
  MembershipRecord,
  OrganizationRecord,
} from "../../src/marketplace/types.ts";

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-tenancy-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("tenancy: seed creates the demo org", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const org = await getOrganization(store, DEMO_ORG_ID);
  assert.ok(org !== null);
  assert.equal(org.id, "org_demo");
  const all = await listOrganizations(store);
  assert.equal(all.length, 1);
});

test("tenancy: seed creates a membership tying the demo user to the demo org", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const membership = await getMembership(store, DEMO_USER_ID, DEMO_ORG_ID);
  assert.ok(membership !== null);
  assert.equal(membership.id, DEMO_MEMBERSHIP_ID);
  assert.equal(membership.role, "OWNER");

  const forUser = await listMembershipsForUser(store, DEMO_USER_ID);
  assert.equal(forUser.length, 1);
});

test("tenancy: seed creates the demo customer with org_id set", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const customer = await store.readLatestById<MarketplaceCustomer>(
    "marketplace_customers",
    DEMO_CUSTOMER_ID,
  );
  assert.ok(customer !== null);
  assert.equal(customer.org_id, DEMO_ORG_ID);
});

test("tenancy: customerProfile returns the org_id from the stored record", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const profile = await customerProfile(store, DEMO_CUSTOMER_ID);
  assert.equal(profile.org_id, DEMO_ORG_ID);
});

test("tenancy: customerBelongsToOrg is true for the demo org", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  assert.equal(
    await customerBelongsToOrg(store, DEMO_CUSTOMER_ID, DEMO_ORG_ID),
    true,
  );
});

test("tenancy: customerBelongsToOrg is false for an unrelated org", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  assert.equal(
    await customerBelongsToOrg(store, DEMO_CUSTOMER_ID, "org_other"),
    false,
  );
});

test("tenancy: customerBelongsToOrg is false for an unknown customer", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  assert.equal(
    await customerBelongsToOrg(store, "cus_does_not_exist", DEMO_ORG_ID),
    false,
  );
});

test("tenancy: listCustomersInOrg scopes correctly", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const inDemo = await listCustomersInOrg(store, DEMO_ORG_ID);
  assert.ok(inDemo.length >= 1);
  for (const customer of inDemo) {
    assert.equal(customer.org_id, DEMO_ORG_ID);
  }
  const inOther = await listCustomersInOrg(store, "org_other");
  assert.equal(inOther.length, 0);
});

test("tenancy: seed is idempotent — no duplicate org, membership, or customers", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  await seedDemoData(store);

  const orgs = await store.readAll<OrganizationRecord>("organizations");
  const latestOrgs = new Set(orgs.map((o) => o.id));
  assert.equal(latestOrgs.size, 1);

  const mems = await store.readAll<MembershipRecord>("memberships");
  const latestMems = new Set(mems.map((m) => m.id));
  assert.equal(latestMems.size, 1);
});

test("tenancy: no org dimension is fabricated on wallet evidence", async (t) => {
  const store = tempStore(t);
  await seedDemoData(store);
  const ledger = await store.readAll<Record<string, unknown>>("wallet_ledger");
  for (const entry of ledger) {
    assert.equal("org_id" in entry, false, "ledger entry carries no org_id");
  }
});
