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
 * Scope: organizations, memberships, and the org dimension on customers.
 * Enforcement at the route level is 5A.3; this module provides the queries
 * and assertions that the view-model layer and the future middleware use.
 *
 * Design: tenancy attaches only to `marketplace_customers`. Wallet, ledger,
 * transactions, and evidence records are scoped transitively through the
 * customer reference — which preserves the wallet-evidence invariant
 * ("no tenant/org dimension is fabricated on wallet evidence").
 */

export const DEMO_ORG_ID = "org_demo";
export const DEMO_ORG_NAME = "Demo Organization";
export const DEMO_MEMBERSHIP_ID = "mem_demo";

export async function getOrganization(
  store: JsonlStore,
  orgId: string,
): Promise<OrganizationRecord | null> {
  return store.readLatestById<OrganizationRecord>("organizations", orgId);
}

export async function listOrganizations(
  store: JsonlStore,
): Promise<readonly OrganizationRecord[]> {
  const all = await store.readAll<OrganizationRecord>("organizations");
  const latest = new Map<string, OrganizationRecord>();
  for (const record of all) {
    latest.set(record.id, record);
  }
  return Array.from(latest.values());
}

export async function getMembership(
  store: JsonlStore,
  userId: string,
  orgId: string,
): Promise<MembershipRecord | null> {
  const all = await store.readAll<MembershipRecord>("memberships");
  let latest: MembershipRecord | null = null;
  for (const record of all) {
    if (record.user_id === userId && record.org_id === orgId) {
      latest = record;
    }
  }
  return latest;
}

export async function listMembershipsForUser(
  store: JsonlStore,
  userId: string,
): Promise<readonly MembershipRecord[]> {
  const all = await store.readAll<MembershipRecord>("memberships");
  const latest = new Map<string, MembershipRecord>();
  for (const record of all) {
    if (record.user_id === userId) {
      latest.set(record.org_id, record);
    }
  }
  return Array.from(latest.values());
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
