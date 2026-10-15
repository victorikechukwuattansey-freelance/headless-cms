import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../../src/auth/passwords.ts";

test("passwords: hash produces a PHC-encoded argon2id string", async () => {
  const hash = await hashPassword("correct-horse-battery-staple");
  assert.match(hash, /^\$argon2id\$/);
  assert.match(hash, /m=19456,t=2,p=1/);
});

test("passwords: verify accepts the correct plaintext", async () => {
  const hash = await hashPassword("demo-password");
  assert.equal(await verifyPassword(hash, "demo-password"), true);
});

test("passwords: verify rejects the wrong plaintext", async () => {
  const hash = await hashPassword("demo-password");
  assert.equal(await verifyPassword(hash, "demo-passwore"), false);
});

test("passwords: hashing is non-deterministic (random salt)", async () => {
  const a = await hashPassword("same-input");
  const b = await hashPassword("same-input");
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(a, "same-input"), true);
  assert.equal(await verifyPassword(b, "same-input"), true);
});

test("passwords: verify returns false on a malformed hash", async () => {
  assert.equal(await verifyPassword("not-a-hash", "anything"), false);
  assert.equal(await verifyPassword("", "anything"), false);
});
