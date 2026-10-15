import type { IncomingMessage } from "node:http";
import type { JsonlStore } from "../store/jsonl-store.ts";
import type { SessionRecord, UserRecord } from "../marketplace/types.ts";
import { parseCookies } from "./cookies.ts";
import { lookupSession } from "./sessions.ts";
import { getUserById } from "./identity.ts";

/**
 * Request-level session resolution.
 *
 * 5A.1 exposes this for login/logout. Route protection (calling it in
 * front of protected paths) is 5A.3.
 */

export interface AuthenticatedSession {
  readonly session: SessionRecord;
  readonly user: UserRecord;
  readonly token: string;
}

export interface RequireSessionOptions {
  readonly store: JsonlStore;
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
  const session = await lookupSession(options.store, token, options.now);
  if (session === null) {
    return null;
  }
  const user = await getUserById(options.store, session.user_id);
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