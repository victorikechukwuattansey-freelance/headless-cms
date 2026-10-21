import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyPaystackSignature } from "../../src/marketplace/payment-sources/webhook-signature.ts";

const SECRET = "sk_test_5c1_dummy";
const BODY = JSON.stringify({
  event: "charge.success",
  data: {
    id: 1943896549,
    reference: "ps_456",
    amount: 1000,
    currency: "NGN",
    status: "success",
    paid_at: "2026-01-01T12:00:00.000Z",
  },
});
const VALID_SIGNATURE =
  "6ddd548737acb0ade9c707c33439f39fb8915a3883fc5268425344ecf5e7f899c9efa05969d2eb27d224ed14c5810c333a1b632c9f28037acffc6a9d51b7f55f";

test("paystack signature: accepts the exact signed body", () => {
  assert.equal(verifyPaystackSignature(BODY, VALID_SIGNATURE, SECRET), true);
});

test("paystack signature: accepts uppercase hex", () => {
  assert.equal(
    verifyPaystackSignature(BODY, VALID_SIGNATURE.toUpperCase(), SECRET),
    true,
  );
});

test("paystack signature: rejects a changed body", () => {
  assert.equal(
    verifyPaystackSignature(`${BODY} `, VALID_SIGNATURE, SECRET),
    false,
  );
});

test("paystack signature: rejects the wrong secret", () => {
  assert.equal(
    verifyPaystackSignature(BODY, VALID_SIGNATURE, "sk_test_wrong"),
    false,
  );
});

test("paystack signature: rejects missing, malformed, and wrong-length values", () => {
  assert.equal(verifyPaystackSignature(BODY, "", SECRET), false);
  assert.equal(verifyPaystackSignature(BODY, "not-hex", SECRET), false);
  assert.equal(verifyPaystackSignature(BODY, "a".repeat(127), SECRET), false);
  assert.equal(verifyPaystackSignature(BODY, "a".repeat(128), SECRET), false);
});

test("paystack signature: rejects an empty secret", () => {
  assert.equal(verifyPaystackSignature(BODY, VALID_SIGNATURE, ""), false);
});
