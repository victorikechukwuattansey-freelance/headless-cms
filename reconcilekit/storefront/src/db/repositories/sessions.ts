import type { Prisma, PrismaClient } from "@prisma/client";
import type { SessionRecord } from "../../marketplace/types.ts";

/**
 * Session repository (kind: sessions).
 *
 * Revocation is append-only in the JSONL store: a new record with
 * `revoked_at` set is written for the same id, and the latest wins.
 * Here that becomes an upsert keyed on the session id — same semantics,
 * one row per session, last write observable.
 *
 * Only two primitives are needed. `lookupSession`'s expiry check stays
 * in sessions.ts (the domain function), not here: the repository
 * returns the record as stored and never invents a time comparison.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class SessionRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: SessionRecord): Promise<SessionRecord> {
    await this.client.session.upsert({
      where: { id: record.id },
      create: toPrismaSession(record),
      update: toPrismaSession(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<SessionRecord | null> {
    const row = await this.client.session.findUnique({ where: { id } });
    return row === null ? null : fromPrismaSession(row);
  }
}

interface SessionRow {
  readonly id: string;
  readonly userId: string;
  readonly activeOrgId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
}

function toPrismaSession(
  record: SessionRecord,
): Prisma.SessionUncheckedCreateInput {
  return {
    id: record.id,
    userId: record.user_id,
    activeOrgId: record.active_org_id,
    createdAt: new Date(record.created_at),
    expiresAt: new Date(record.expires_at),
    revokedAt:
      record.revoked_at === null ? null : new Date(record.revoked_at),
  };
}

function fromPrismaSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    user_id: row.userId,
    active_org_id: row.activeOrgId,
    created_at: row.createdAt.toISOString(),
    expires_at: row.expiresAt.toISOString(),
    revoked_at: row.revokedAt === null ? null : row.revokedAt.toISOString(),
    simulated: true,
  };
}