import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing for storefront accounts.
 *
 * Argon2id via @node-rs/argon2 (prebuilt binary, no compile step).
 * Parameters follow the OWASP 2024 minimum for Argon2id:
 *   m = 19456 KiB (19 MiB), t = 2, p = 1, 32-byte output.
 *
 * Algorithm and Version are declared as ambient const enums by the package
 * and cannot be imported under `verbatimModuleSyntax`. Their numeric values
 * are fixed by the Argon2 spec and used directly here.
 *   Argon2id = 2
 *   Version 0x13 = 1
 */

const HASH_OPTIONS = {
  algorithm: 2 as const, // Argon2id
  version: 1 as const, // 0x13
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  outputLen: 32,
};

export async function hashPassword(plaintext: string): Promise<string> {
  return hash(plaintext, HASH_OPTIONS);
}

export async function verifyPassword(
  passwordHash: string,
  plaintext: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plaintext);
  } catch {
    // Malformed hash → treat as failure, never throw to callers.
    return false;
  }
}
