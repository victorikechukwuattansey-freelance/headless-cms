import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  paystackWebhookPaymentEvent,
  type PaystackWebhookPayload,
} from "../../src/marketplace/payment-sources/webhook-payload.ts";
import type {
  PaystackAdapterOptions,
  PaystackTransactionData,
} from "../../../src/adapters/providers/paystack/paystack.ts";
import { PaystackAdapterError } from "../../../src/adapters/providers/paystack/paystack.ts";

const NOW = "2026-01-01T12:00:00.000Z";
const NOW_EPOCH = Date.parse(NOW);
const OPTIONS: PaystackAdapterOptions = {
  supportedCurrencies: ["NGN", "USD", "GBP"],
  timestampField: "paid_at",
};

function webhook(
  event: string,
  overrides: Partial<PaystackTransactionData> = {},
): PaystackWebhookPayload {
  return {
    event,
    data: {
      id: 1943896549,
      reference: "ps_456",
      amount: 1000,
      currency: "NGN",
      status: "success",
      created_at: NOW,
      paid_at: NOW,
      ...overrides,
    },
  };
}

function normalize(payload: PaystackWebhookPayload) {
  return paystackWebhookPaymentEvent(payload, OPTIONS, JSON.stringify(payload));
}

test("paystack webhook: charge.success becomes CONFIRMED payment evidence", () => {
  const payload = webhook("charge.success");
  const event = normalize(payload);
  assert.notEqual(event, null);
  if (event === null) {
    return;
  }

  assert.equal(event.transaction_id, null);
  assert.equal(event.merchant_reference, null);
  assert.equal(event.payment_source, "PAYSTACK");
  assert.equal(event.payment_source_reference, "ps_456");
  assert.equal(event.source_event_id, "charge.success:1943896549");
  assert.equal(event.event_type, "PAYMENT");
  assert.equal(event.amount, 1000);
  assert.equal(event.currency, "NGN");
  assert.equal(event.status, "SUCCESS");
  assert.equal(event.occurred_at, NOW_EPOCH);
  assert.equal(event.source_confidence, "CONFIRMED");
  assert.equal(event.source_attributes.original_status, "success");
  assert.equal(event.source_attributes.webhook_event, "charge.success");
  assert.equal(
    event.source_attributes.payload_hash,
    createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex"),
  );
});

test("paystack webhook: charge.failed maps to FAILED and keeps a distinct identity", () => {
  const success = normalize(webhook("charge.success"));
  const failed = normalize(webhook("charge.failed", { status: "success" }));
  assert.notEqual(success, null);
  assert.notEqual(failed, null);
  if (success === null || failed === null) {
    return;
  }

  assert.equal(failed.status, "FAILED");
  assert.equal(failed.source_event_id, "charge.failed:1943896549");
  assert.notEqual(failed.source_event_id, success.source_event_id);
});

test("paystack webhook: paid_at is preferred and created_at is the fallback", () => {
  const paid = normalize(webhook("charge.success"));
  const fallback = normalize(
    webhook("charge.success", {
      paid_at: null,
      created_at: NOW,
    }),
  );
  assert.notEqual(paid, null);
  assert.notEqual(fallback, null);
  if (paid === null || fallback === null) {
    return;
  }

  assert.equal(paid.occurred_at, NOW_EPOCH);
  assert.equal(fallback.occurred_at, NOW_EPOCH);
  assert.equal(fallback.source_attributes.paid_at, undefined);
  assert.equal(fallback.source_attributes.created_at, NOW);
});

test("paystack webhook: unsupported events return null", () => {
  assert.equal(normalize(webhook("refund.processed")), null);
  assert.equal(normalize(webhook("transfer.success")), null);
  assert.equal(normalize(webhook("charge.dispute.created")), null);
});

test("paystack webhook: a missing id falls back to the reference for identity", () => {
  const event = normalize(
    webhook("charge.success", {
      id: null,
      reference: "ps_789",
    }),
  );
  assert.notEqual(event, null);
  if (event === null) {
    return;
  }

  assert.equal(event.source_event_id, "charge.success:ps_789");
  assert.equal(event.payment_source_reference, "ps_789");
});

test("paystack webhook: invalid amounts still fail through the root adapter", () => {
  assert.throws(
    () => normalize(webhook("charge.success", { amount: -1 })),
    (error: unknown) =>
      error instanceof PaystackAdapterError &&
      error.code === "PAYSTACK_INVALID_AMOUNT",
  );
});
