import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
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

const prisma = getPrismaClient();

test("identity: registerUser stores a record with a hashed password", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const user = await registerUser(repos, {
      email: "Alice@Example.com",
      password: "strong-password",
      displayName: "Alice",
    });
    assert.equal(user.email, "alice@example.com");
    assert.match(user.password_hash, /^\$argon2id\$/);
    assert.equal(user.simulated, true);
  });
});

test("identity: registerUser rejects an already-registered email", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await registerUser(repos, {
      email: "x@y.z",
      password: "password12",
      displayName: "X",
    });
    await assert.rejects(
      () =>
        registerUser(repos, {
          email: "X@Y.Z",
          password: "password12",
          displayName: "X",
        }),
      /already registered/,
    );
  });
});

test("identity: registerUser rejects a short password", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await assert.rejects(
      () =>
        registerUser(repos, {
          email: "a@b.c",
          password: "short",
          displayName: "A",
        }),
      /at least 8 characters/,
    );
  });
});

test("identity: getUserByEmail is case-insensitive", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await registerUser(repos, {
      email: "Mixed@Case.com",
      password: "password12",
      displayName: "M",
    });
    const found = await getUserByEmail(repos, "mixed@case.com");
    assert.ok(found !== null);
    assert.equal(found.email, "mixed@case.com");
  });
});

test("identity: loginUser returns the user for correct credentials", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await registerUser(repos, {
      email: "user@example.com",
      password: "correct-password",
      displayName: "User",
    });
    const user = await loginUser(repos, "user@example.com", "correct-password");
    assert.ok(user !== null);
  });
});

test("identity: loginUser returns null for wrong password", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await registerUser(repos, {
      email: "user@example.com",
      password: "correct-password",
      displayName: "User",
    });
    assert.equal(
      await loginUser(repos, "user@example.com", "wrong-password"),
      null,
    );
  });
});

test("identity: loginUser returns null for an unknown email", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(
      await loginUser(repos, "nobody@example.com", "anything"),
      null,
    );
  });
});

test("identity: seedDemoUser is idempotent", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const first = await seedDemoUser(repos);
    const second = await seedDemoUser(repos);
    assert.equal(first.id, DEMO_USER_ID);
    assert.equal(second.id, DEMO_USER_ID);
    assert.equal(first.created_at, second.created_at);
    const found = await getUserById(repos, DEMO_USER_ID);
    assert.ok(found !== null);
    assert.equal(found.email, DEMO_USER_EMAIL);
  });
});

test("identity: seedDemoUser credentials log in successfully", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedDemoUser(repos);
    const user = await loginUser(repos, DEMO_USER_EMAIL, DEMO_USER_PASSWORD);
    assert.ok(user !== null);
    assert.equal(user.id, DEMO_USER_ID);
  });
});
