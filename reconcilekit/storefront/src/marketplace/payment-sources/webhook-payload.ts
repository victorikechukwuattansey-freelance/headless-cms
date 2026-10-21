import { createHash } from "node:crypto";
import type {
  PaystackAdapterOptions,
  PaystackTransactionData,
} from "../../../../src/adapters/providers/paystack/paystack.ts";
import { paystackPaymentEvent } from "./adapters/paystack.ts";
import { DEFAULT_EVENT_TYPE, type PaymentEventInput } from "./types.ts";

export interface PaystackWebhookPayload {
  readonly event: string;
  readonly data: PaystackTransactionData | null;
}

export const PAYSTACK_WEBHOOK_EVENT_STATUS = {
  "charge.success": "SUCCESS",
  "charge.failed": "FAILED",
} as const;

type PaystackWebhookEvent = keyof typeof PAYSTACK_WEBHOOK_EVENT_STATUS;

/**
 * Normalizes a verified Paystack charge webhook into payment-source evidence.
 *
 * The webhook is evidence, not truth: it carries Paystack's reference but no
 * marketplace anchor, so `transaction_id` and `merchant_reference` stay null.
 * `source_event_id` includes the event name so a success and a failure for the
 * same transaction remain distinct ingest identities.
 *
 * Unsupported events return `null`. Refund events are deliberately deferred;
 * they belong to the resolution layer, not payment-source evidence.
 */
export function paystackWebhookPaymentEvent(
  payload: PaystackWebhookPayload,
  options: PaystackAdapterOptions,
  rawBody: string,
): PaymentEventInput | null {
  if (!isSupportedEvent(payload.event)) {
    return null;
  }

  const event = payload.event;
  const status = PAYSTACK_WEBHOOK_EVENT_STATUS[event];
  const data = payload.data;
  const paidAt = data?.paid_at;
  const timestampField =
    paidAt === null || paidAt === undefined || paidAt === ""
      ? "created_at"
      : "paid_at";

  const draft = paystackPaymentEvent(
    { status: true, data },
    { ...options, timestampField },
    {
      transactionId: null,
      merchantReference: null,
      sourceConfidence: "CONFIRMED",
    },
  );

  return {
    ...draft,
    event_type: DEFAULT_EVENT_TYPE,
    source_event_id: webhookSourceEventId(event, data),
    status,
    source_confidence: "CONFIRMED",
    source_attributes: {
      ...draft.source_attributes,
      webhook_event: event,
      payload_hash: createHash("sha256").update(rawBody, "utf8").digest("hex"),
    },
  };
}

function isSupportedEvent(event: string): event is PaystackWebhookEvent {
  return event === "charge.success" || event === "charge.failed";
}

function webhookSourceEventId(
  event: PaystackWebhookEvent,
  data: PaystackTransactionData | null,
): string | null {
  if (data === null) return null;
  if (data.id !== null && data.id !== undefined)
    return `${event}:${String(data.id)}`;
  if (data.reference !== null && data.reference !== undefined)
    return `${event}:${String(data.reference)}`;
  return null;
}
