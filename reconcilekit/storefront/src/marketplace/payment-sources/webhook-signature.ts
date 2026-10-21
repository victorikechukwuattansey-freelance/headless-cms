import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_SIGNATURE_PATTERN = /^[0-9a-f]{128}$/i;

/**
 * Verifies Paystack's `x-paystack-signature` header.
 *
 * Paystack signs the exact raw request body with HMAC-SHA512 using the
 * merchant secret key and sends the digest as a hex string. Re-serializing the
 * parsed JSON would change the signed bytes, so callers must pass the body
 * exactly as received.
 */
export function verifyPaystackSignature(
  rawBody: string,
  headerSignature: string,
  secretKey: string,
): boolean {
  if (secretKey === "" || !PAYSTACK_SIGNATURE_PATTERN.test(headerSignature)) {
    return false;
  }

  const expected = createHmac("sha512", secretKey)
    .update(rawBody, "utf8")
    .digest();
  const received = Buffer.from(headerSignature, "hex");

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(expected, received);
}
