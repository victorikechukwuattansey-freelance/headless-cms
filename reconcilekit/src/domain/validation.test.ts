import assert from "node:assert/strict";
import { test } from "node:test";
import type { MerchantPayment } from "./model.ts";
import { merchant, provider, DEFAULT_CONFIG } from "./fixtures.ts";
import {
  validateAmount,
  validateCurrency,
  validatePaymentInput,
  validateStatus,
  validateTimestamp,
} from "./validation.ts";

test("validateAmount: equal integer amounts pass", () => {
  const result = validateAmount(
    merchant({ amount: 45000 }),
    provider({ amount: 45000 }),
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, true);
  assert.equal(result.code, null);
});

test("validateAmount: differing amounts produce AMOUNT_MISMATCH", () => {
  const result = validateAmount(
    merchant({ amount: 45000 }),
    provider({ amount: 45001 }),
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, false);
  assert.equal(result.code, "AMOUNT_MISMATCH");
});

test("validateCurrency: equal currencies pass", () => {
  const result = validateCurrency(
    merchant({ currency: "USD" }),
    provider({ currency: "USD" }),
  );
  assert.equal(result.passed, true);
});

test("validateCurrency: differing supported currencies produce CURRENCY_MISMATCH", () => {
  const result = validateCurrency(
    merchant({ currency: "NGN" }),
    provider({ currency: "USD" }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.code, "CURRENCY_MISMATCH");
});

test("validateStatus: equal known statuses pass", () => {
  const result = validateStatus(
    merchant({ status: "PENDING" }),
    provider({ status: "PENDING" }),
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, true);
});

test("validateStatus: differing known statuses produce STATUS_MISMATCH", () => {
  const result = validateStatus(
    merchant({ status: "SUCCESS" }),
    provider({ status: "FAILED" }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.code, "STATUS_MISMATCH");
});

test("validateStatus: UNKNOWN vs known status produces STATUS_UNRESOLVED", () => {
  const result = validateStatus(
    merchant({ status: "UNKNOWN" }),
    provider({ status: "SUCCESS" }),
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, false);
  assert.equal(result.code, "STATUS_UNRESOLVED");
});

test("validateStatus: UNKNOWN vs UNKNOWN produces STATUS_UNRESOLVED, never a match", () => {
  const result = validateStatus(
    merchant({ status: "UNKNOWN" }),
    provider({ status: "UNKNOWN" }),
  );
  assert.equal(result.passed, false);
  assert.equal(result.code, "STATUS_UNRESOLVED");
});

test("validateStatus: missing status makes validation unavailable, not failed", () => {
  const result = validateStatus(
    merchant({ status: null }),
    provider({ status: "SUCCESS" }),
  );
  assert.equal(result.applicable, false);
  assert.equal(result.passed, false);
  assert.equal(result.code, null);
  assert.ok(result.note !== null && result.note.includes("unavailable"));
});

test("validateTimestamp: disabled timestamp validation is not applicable", () => {
  const config = {
    ...DEFAULT_CONFIG,
    timestampValidation: { enabled: false } as const,
  };
  const result = validateTimestamp(merchant(), provider(), config);
  assert.equal(result.applicable, false);
  assert.equal(result.code, null);
  assert.ok(result.note !== null && result.note.includes("disabled"));
});

test("validateTimestamp: missing timestamp makes validation unavailable, not failed", () => {
  const result = validateTimestamp(
    merchant({ occurred_at: null }),
    provider(),
    DEFAULT_CONFIG,
  );
  assert.equal(result.applicable, false);
  assert.equal(result.code, null);
  assert.ok(result.note !== null && result.note.includes("unavailable"));
});

test("validateTimestamp: difference within tolerance passes", () => {
  const result = validateTimestamp(
    merchant({ occurred_at: 1_700_000_000_000 }),
    provider({ occurred_at: 1_700_000_030_000 }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, true);
});

test("validateTimestamp: difference exactly at tolerance passes", () => {
  const result = validateTimestamp(
    merchant({ occurred_at: 1_700_000_000_000 }),
    provider({ occurred_at: 1_700_000_060_000 }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.passed, true);
});

test("validateTimestamp: difference beyond tolerance produces TEMPORAL_ANOMALY", () => {
  const result = validateTimestamp(
    merchant({ occurred_at: 1_700_000_000_000 }),
    provider({ occurred_at: 1_700_000_120_000 }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.applicable, true);
  assert.equal(result.passed, false);
  assert.equal(result.code, "TEMPORAL_ANOMALY");
});

test("validatePaymentInput: valid payment passes", () => {
  const result = validatePaymentInput(merchant(), DEFAULT_CONFIG);
  assert.deepEqual(result, { valid: true });
});

test("validatePaymentInput: non-integer amount is rejected", () => {
  const payment = merchant({ amount: 45000.5 });
  const result = validatePaymentInput(payment, DEFAULT_CONFIG);
  assert.equal(result.valid, false);
  assert.ok(
    result.valid === false &&
      result.note.includes("invalid amount representation"),
  );
});

test("validatePaymentInput: negative amount is rejected", () => {
  const result = validatePaymentInput(
    merchant({ amount: -100 }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.valid, false);
});

test("validatePaymentInput: unsafe integer amount is rejected", () => {
  const result = validatePaymentInput(
    merchant({ amount: 2 ** 53 }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.valid, false);
});

test("validatePaymentInput: unsupported currency is rejected", () => {
  const result = validatePaymentInput(merchant({ currency: "USD" }), {
    timestampValidation: DEFAULT_CONFIG.timestampValidation,
    supportedCurrencies: ["NGN"],
  });
  assert.equal(result.valid, false);
});

test("validatePaymentInput: empty currency is rejected", () => {
  const result = validatePaymentInput(
    merchant({ currency: "" }),
    DEFAULT_CONFIG,
  );
  assert.equal(result.valid, false);
});

test("validatePaymentInput: invalid status value is rejected", () => {
  const payment = merchant({ status: "COMPLETED" as never }) as MerchantPayment;
  const result = validatePaymentInput(payment, DEFAULT_CONFIG);
  assert.equal(result.valid, false);
});

test("validatePaymentInput: invalid timestamp representation is rejected", () => {
  const payment = merchant({ occurred_at: 1_700_000_000_000.5 });
  const result = validatePaymentInput(payment, DEFAULT_CONFIG);
  assert.equal(result.valid, false);
});
