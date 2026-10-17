import type { IncomingMessage } from "node:http";
import type { Repositories } from "../db/repositories/index.ts";
import type { SessionRecord, UserRecord } from "../marketplace/types.ts";
import { parseCookies } from "./cookies.ts";
import { lookupSession } from "./sessions.ts";
import { getUserById } from "./identity.ts";

/**
 * Request-level session resolution.
 *
 * Phase 5B.1c-1c: both session and user lookups go through `repos`.
 * The dual store+repos shape from 1a is gone — nothing in this module
 * touches JSONL anymore.
 */

export interface AuthenticatedSession {
  readonly session: SessionRecord;
  readonly user: UserRecord;
  readonly token: string;
}

export interface RequireSessionOptions {
  readonly repos: Repositories;
  readonly cookieName: string;
  readonly now?: Date;
}

export async function requireSession(
  req: IncomingMessage,
  options: RequireSessionOptions,
): Promise<AuthenticatedSession | null> {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[options.cookieName];
  if (token === undefined || token === "") {
    return null;
  }
  const session = await lookupSession(options.repos, token, options.now);
  if (session === null) {
    return null;
  }
  const user = await getUserById(options.repos, session.user_id);
  if (user === null) {
    return null;
  }
  return { session, user, token };
}

export function readSessionToken(
  req: IncomingMessage,
  cookieName: string,
): string | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[cookieName];
  return token === undefined || token === "" ? null : token;
}
