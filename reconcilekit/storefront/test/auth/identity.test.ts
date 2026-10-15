import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import {
  DEMO_USER_EMAIL,
  DEMO_USER_ID,
  DEMO_USER_PASSWORD,
  getUserByEmail,
  getUserById,
  loginUser,
  registerUser,
  seedDemoUser,
} from "../../src/auth/identity.ts";

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-id-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

test("identity: registerUser stores a record with a hashed password", async (t) => {
  const store = tempStore(t);
  const user = await registerUser(store, {
    email: "Alice@Example.com",
    password: "strong-password",
    displayName: "Alice",
  });
  assert.equal(user.email, "alice@example.com");
  assert.match(user.password_hash, /^\$argon2id\$/);
  assert.equal(user.simulated, true);
});

test("identity: registerUser rejects an already-registered email", async (t) => {
  const store = tempStore(t);
  await registerUser(store, {
    email: "x@y.z",
    password: "password12",
    displayName: "X",
  });
  await assert.rejects(
    () =>
      registerUser(store, {
        email: "X@Y.Z",
        password: "password12",
        displayName: "X",
      }),
    /already registered/,
  );
});

test("identity: registerUser rejects a short password", async (t) => {
  const store = tempStore(t);
  await assert.rejects(
    () =>
      registerUser(store, {
        email: "a@b.c",
        password: "short",
        displayName: "A",
      }),
    /at least 8 characters/,
  );
});

test("identity: getUserByEmail is case-insensitive", async (t) => {
  const store = tempStore(t);
  await registerUser(store, {
    email: "Mixed@Case.com",
    password: "password12",
    displayName: "M",
  });
  const found = await getUserByEmail(store, "mixed@case.com");
  assert.ok(found !== null);
  assert.equal(found.email, "mixed@case.com");
});

test("identity: loginUser returns the user for correct credentials", async (t) => {
  const store = tempStore(t);
  await registerUser(store, {
    email: "user@example.com",
    password: "correct-password",
    displayName: "User",
  });
  const user = await loginUser(store, "user@example.com", "correct-password");
  assert.ok(user !== null);
});

test("identity: loginUser returns null for wrong password", async (t) => {
  const store = tempStore(t);
  await registerUser(store, {
    email: "user@example.com",
    password: "correct-password",
    displayName: "User",
  });
  assert.equal(
    await loginUser(store, "user@example.com", "wrong-password"),
    null,
  );
});

test("identity: loginUser returns null for an unknown email", async (t) => {
  const store = tempStore(t);
  assert.equal(
    await loginUser(store, "nobody@example.com", "anything"),
    null,
  );
});

test("identity: seedDemoUser is idempotent", async (t) => {
  const store = tempStore(t);
  const first = await seedDemoUser(store);
  const second = await seedDemoUser(store);
  assert.equal(first.id, DEMO_USER_ID);
  assert.equal(second.id, DEMO_USER_ID);
  assert.equal(first.created_at, second.created_at);
  const found = await getUserById(store, DEMO_USER_ID);
  assert.ok(found !== null);
  assert.equal(found.email, DEMO_USER_EMAIL);
});

test("identity: seedDemoUser credentials log in successfully", async (t) => {
  const store = tempStore(t);
  await seedDemoUser(store);
  const user = await loginUser(store, DEMO_USER_EMAIL, DEMO_USER_PASSWORD);
  assert.ok(user !== null);
  assert.equal(user.id, DEMO_USER_ID);
});