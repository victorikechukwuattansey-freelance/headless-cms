import type { Prisma, PrismaClient } from "@prisma/client";
import type { MembershipRecord } from "../../marketplace/types.ts";

/**
 * Membership repository (kind: memberships).
 *
 * The schema enforces @@unique([userId, orgId]). The JSONL store
 * tolerated multiple historical membership rows for the same pair and
 * "latest wins" on read; Postgres makes that impossible by construction.
 * This is a schema-stricter-than-store behaviour: no code path today
 * re-creates a membership for a (user, org) pair once it exists, so the
 * constraint is honest. If membership history is ever needed, that is a
 * schema change (add a nullable `superseded_at` or drop the compound
 * unique) — not a repository workaround.
 *
 * `findByUserAndOrg` uses the compound unique as a natural key, replacing
 * the JSONL readAll + scan with a single indexed lookup.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MembershipRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MembershipRecord): Promise<MembershipRecord> {
    await this.client.membership.upsert({
      where: { id: record.id },
      create: toPrismaMembership(record),
      update: toPrismaMembership(record),
    });
    return record;
  }

  async findByUserAndOrg(
    userId: string,
    orgId: string,
  ): Promise<MembershipRecord | null> {
    const row = await this.client.membership.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    return row === null ? null : fromPrismaMembership(row);
  }

  async listByUser(userId: string): Promise<MembershipRecord[]> {
    const rows = await this.client.membership.findMany({
      where: { userId },
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaMembership);
  }
}

interface MembershipRow {
  readonly id: string;
  readonly userId: string;
  readonly orgId: string;
  readonly role: string;
  readonly createdAt: Date;
}

function toPrismaMembership(
  record: MembershipRecord,
): Prisma.MembershipUncheckedCreateInput {
  return {
    id: record.id,
    userId: record.user_id,
    orgId: record.org_id,
    role: record.role,
    createdAt: new Date(record.created_at),
  };
}

function fromPrismaMembership(row: MembershipRow): MembershipRecord {
  return {
    id: row.id,
    user_id: row.userId,
    org_id: row.orgId,
    role: row.role as MembershipRecord["role"],
    created_at: row.createdAt.toISOString(),
    simulated: true,
  };
}
