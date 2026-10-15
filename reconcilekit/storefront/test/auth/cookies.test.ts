import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCookies,
  serializeSessionCookie,
  clearSessionCookie,
} from "../../src/auth/cookies.ts";

test("cookies: parses a single cookie", () => {
  assert.deepEqual(parseCookies("rk_session=abc"), { rk_session: "abc" });
});

test("cookies: parses multiple cookies", () => {
  assert.deepEqual(parseCookies("a=1; b=2; rk_session=xyz"), {
    a: "1",
    b: "2",
    rk_session: "xyz",
  });
});

test("cookies: missing header yields an empty map", () => {
  assert.deepEqual(parseCookies(undefined), {});
  assert.deepEqual(parseCookies(""), {});
});

test("cookies: malformed input is swallowed", () => {
  // Should not throw; return whatever the parser can recover.
  assert.doesNotThrow(() => parseCookies("\x00\x01=%"));
});

test("cookies: serialize sets HttpOnly, SameSite, Path, Max-Age", () => {
  const value = serializeSessionCookie("tok123", {
    name: "rk_session",
    maxAgeSeconds: 3600,
    secure: false,
  });
  assert.match(value, /^rk_session=tok123/);
  assert.match(value, /HttpOnly/);
  assert.match(value, /SameSite=Lax/);
  assert.match(value, /Path=\//);
  assert.match(value, /Max-Age=3600/);
  assert.doesNotMatch(value, /Secure/);
});

test("cookies: serialize adds Secure when configured", () => {
  const value = serializeSessionCookie("tok", {
    name: "rk_session",
    maxAgeSeconds: 60,
    secure: true,
  });
  assert.match(value, /Secure/);
});

test("cookies: clearSessionCookie expires the cookie immediately", () => {
  const value = clearSessionCookie("rk_session", false);
  assert.match(value, /^rk_session=;/);
  assert.match(value, /Max-Age=0/);
});