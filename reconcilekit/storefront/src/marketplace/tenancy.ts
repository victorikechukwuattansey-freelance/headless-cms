import type { Repositories } from "../db/repositories/index.ts";
import type { JsonlStore } from "../store/jsonl-store.ts";
import type {
  MarketplaceCustomer,
  MembershipRecord,
  MembershipRole,
  OrganizationRecord,
} from "./types.ts";

/**
 * Tenancy layer for the storefront. Phase 5A.2.
 *
 * Phase 5B.1c-1b: reads and writes go through repositories. Organizations,
 * memberships, and the org dimension on marketplace_customers now live in
 * Postgres.
 *
 * The wallet-evidence invariant is unaffected: wallet_ledger and
 * evidence_packs carry no org_id at any layer; scoping flows through
 * marketplace_customers.org_id, which is now a real Postgres column.
 */

export const DEMO_ORG_ID = "org_demo";
export const DEMO_ORG_NAME = "Demo Organization";
export const DEMO_MEMBERSHIP_ID = "mem_demo";

export async function getOrganization(
  repos: Repositories,
  orgId: string,
): Promise<OrganizationRecord | null> {
  return repos.organizations.readLatestById(orgId);
}

export async function listOrganizations(
  repos: Repositories,
): Promise<readonly OrganizationRecord[]> {
  return repos.organizations.list();
}

export async function getMembership(
  repos: Repositories,
  userId: string,
  orgId: string,
): Promise<MembershipRecord | null> {
  return repos.memberships.findByUserAndOrg(userId, orgId);
}

export async function listMembershipsForUser(
  repos: Repositories,
  userId: string,
): Promise<readonly MembershipRecord[]> {
  return repos.memberships.listByUser(userId);
}

export async function listCustomersInOrg(
  store: JsonlStore,
  orgId: string,
): Promise<readonly MarketplaceCustomer[]> {
  const all = await store.readAll<MarketplaceCustomer>("marketplace_customers");
  const latest = new Map<string, MarketplaceCustomer>();
  for (const record of all) {
    if (record.org_id === orgId) {
      latest.set(record.id, record);
    }
  }
  return Array.from(latest.values());
}

export async function customerBelongsToOrg(
  store: JsonlStore,
  customerId: string,
  orgId: string,
): Promise<boolean> {
  const record = await store.readLatestById<MarketplaceCustomer>(
    "marketplace_customers",
    customerId,
  );
  return record !== null && record.org_id === orgId;
}

export function assertMembershipRole(
  membership: MembershipRecord,
  allowed: readonly MembershipRole[],
): void {
  if (!allowed.includes(membership.role)) {
    throw new Error(
      `membership ${membership.id} has role ${membership.role}; required one of ${allowed.join(", ")}`,
    );
  }
}
