import type { JsonlStore } from "../store/jsonl-store.ts";
import type { UserRecord } from "../marketplace/types.ts";
import { hashPassword, verifyPassword } from "./passwords.ts";

/**
 * User identity. A user is anyone who can hold a session. Membership (the
 * user's relation to an org) is a 5A.2 concern and is not modeled here.
 */

export const DEMO_USER_ID = "usr_demo";
export const DEMO_USER_EMAIL = "demo@example.com";
export const DEMO_USER_PASSWORD = "demo-password";
export const DEMO_USER_DISPLAY_NAME = "Demo User";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function getUserByEmail(
  store: JsonlStore,
  email: string,
): Promise<UserRecord | null> {
  const target = normalizeEmail(email);
  const all = await store.readAll<UserRecord>("users");
  // Latest record per id wins, so scan and keep the last match.
  let latest: UserRecord | null = null;
  for (const user of all) {
    if (user.email === target) {
      latest = user;
    }
  }
  return latest;
}

export async function getUserById(
  store: JsonlStore,
  userId: string,
): Promise<UserRecord | null> {
  return store.readLatestById<UserRecord>("users", userId);
}

export interface RegisterUserInput {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly id?: string;
  readonly now?: Date;
}

export async function registerUser(
  store: JsonlStore,
  input: RegisterUserInput,
): Promise<UserRecord> {
  const email = normalizeEmail(input.email);
  if (email === "") {
    throw new Error("registerUser: email must be non-empty");
  }
  if (input.password.length < 8) {
    throw new Error("registerUser: password must be at least 8 characters");
  }
  const existing = await getUserByEmail(store, email);
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
  await store.insert("users", user);
  return user;
}

export interface LoginResult {
  readonly user: UserRecord;
}

export async function loginUser(
  store: JsonlStore,
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await getUserByEmail(store, email);
  if (user === null) {
    // Still hash to avoid a timing oracle on email existence.
    await hashPassword(password);
    return null;
  }
  const ok = await verifyPassword(user.password_hash, password);
  return ok ? user : null;
}

/**
 * Idempotent demo user seeding. Called from the demo-seed path. Repeated
 * calls are safe: the deterministic id means the store's last-write-wins
 * reduction collapses to a single record.
 */
export async function seedDemoUser(store: JsonlStore): Promise<UserRecord> {
  const existing = await getUserById(store, DEMO_USER_ID);
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
  await store.insert("users", user);
  return user;
}
