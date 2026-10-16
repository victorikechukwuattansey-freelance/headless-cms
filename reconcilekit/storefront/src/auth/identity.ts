import type { Repositories } from "../db/repositories/index.ts";
import type { UserRecord } from "../marketplace/types.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";

/**
 * User identity. A user is anyone who can hold a session. Membership (the
 * user's relation to an org) is a 5A.2 concern and is not modeled here.
 *
 * Phase 5B.1c-1a: reads and writes go through UserRepository. The
 * repository normalizes email on findByEmail, so the local normalizeEmail
 * helper is used only for registerUser's pre-check and the empty-email
 * guard, which are module policy, not storage.
 */

export const DEMO_USER_ID = "usr_demo";
export const DEMO_USER_EMAIL = "demo@example.com";
export const DEMO_USER_PASSWORD = "demo-password";
export const DEMO_USER_DISPLAY_NAME = "Demo User";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUserByEmail(
  repos: Repositories,
  email: string,
): Promise<UserRecord | null> {
  return repos.users.findByEmail(email);
}

export async function getUserById(
  repos: Repositories,
  userId: string,
): Promise<UserRecord | null> {
  return repos.users.findById(userId);
}

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly id?: string;
  readonly now?: Date;
}

export async function registerUser(
  repos: Repositories,
  input: RegisterUserInput,
): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  if (email === "") {
    throw new Error("registerUser: email must be non-empty");
  }
  if (input.password.length < 8) {
    throw new Error("registerUser: password must be at least 8 characters");
  }
  const existing = await getUserByEmail(repos, email);
  if (existing !== null) {
    throw new Error(`registerUser: email ${email} already registered`);
  }
  const now = input.now ?? new Date();
  const password_hash = await hashPassword(input.password);
  const user: UserRecord = {
    id:
      input.id ??
      `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    email,
    password_hash,
    display_name: input.displayName,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    simulated: true,
  };
  await repos.users.insert(user);
  return user;
}

export interface LoginResult {
  readonly user: UserRecord;
}

export async function loginUser(
  repos: Repositories,
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await getUserByEmail(repos, email);
  if (user === null) {
    // Still hash to avoid a timing oracle on email existence.
    await hashPassword(password);
    return null;
  }
  const ok = await verifyPassword(user.password_hash, password);
  return ok ? user : null;
}

/**
 * Idempotent demo user seeding. Called from the demo-seed path and by the
 * HTTP test fixtures. Repeated calls are safe: the deterministic id means
 * the repository's upsert returns the existing record.
 */
export async function seedDemoUser(repos: Repositories): Promise<UserRecord> {
  const existing = await getUserById(repos, DEMO_USER_ID);
  if (existing !== null) {
    return existing;
  }
  const now = new Date();
  const password_hash = await hashPassword(DEMO_USER_PASSWORD);
  const user: UserRecord = {
    id: DEMO_USER_ID,
    email: DEMO_USER_EMAIL,
    password_hash,
    display_name: DEMO_USER_DISPLAY_NAME,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    simulated: true,
  };
  await repos.users.insert(user);
  return user;
}
