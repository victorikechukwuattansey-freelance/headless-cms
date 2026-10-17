import { randomBytes } from "node:crypto";
import type { Repositories } from "../db/repositories/index.ts";
import type { SessionRecord } from "../marketplace/types.ts";

/**
 * Server-side sessions. The cookie stores an opaque random token; the
 * session record is stored under `sess_<token>`.
 *
 * Revocation is append-only by semantics: a new record with `revoked_at`
 * set is written, and the latest record wins. Under Postgres the
 * repository's upsert-on-id gives the same observable behaviour.
 *
 * Phase 5B.1c-1c: reads and writes go through SessionRepository. The
 * expiry/revocation logic does not move — the repository returns the
 * stored record and never invents a time comparison.
 */

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionRecordId(token: string): string {
  return `sess_${token}`;
}

export interface CreateSessionInput {
  readonly userId: string;
  readonly activeOrgId: string;
  readonly ttlHours: number;
  readonly now?: Date;
}

export async function createSession(
  repos: Repositories,
  input: CreateSessionInput,
): Promise<{ token: string; record: SessionRecord }> {
  const now = input.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + input.ttlHours * 3600 * 1000,
  ).toISOString();
  const token = newSessionToken();
  const record: SessionRecord = {
    id: sessionRecordId(token),
    user_id: input.userId,
    active_org_id: input.activeOrgId,
    created_at: now.toISOString(),
    expires_at: expiresAt,
    revoked_at: null,
    simulated: true,
  };
  await repos.sessions.insert(record);
  return { token, record };
}

export async function lookupSession(
  repos: Repositories,
  token: string,
  now: Date = new Date(),
): Promise<SessionRecord | null> {
  const record = await repos.sessions.readLatestById(sessionRecordId(token));
  if (record === null) {
    return null;
  }
  if (record.revoked_at !== null) {
    return null;
  }
  if (Date.parse(record.expires_at) <= now.getTime()) {
    return null;
  }
  return record;
}

export async function revokeSession(
  repos: Repositories,
  token: string,
  now: Date = new Date(),
): Promise<boolean> {
  const record = await repos.sessions.readLatestById(sessionRecordId(token));
  if (record === null || record.revoked_at !== null) {
    return false;
  }
  const revoked: SessionRecord = {
    ...record,
    revoked_at: now.toISOString(),
  };
  await repos.sessions.insert(revoked);
  return true;
}
