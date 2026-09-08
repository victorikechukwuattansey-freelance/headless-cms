import { stableToken } from "../../ids.ts";
import type { JsonlStore } from "../../store/jsonl-store.ts";
import {
  PaymentSourceError,
  type IngestOutcome,
  type PaymentEvent,
  type PaymentEventInput,
} from "./types.ts";

/**
 * Deterministic idempotency key for a payment event. Distinct sources,
 * source references, event types, or source event ids always produce distinct
 * keys; the same draft always reproduces the same key, so replay stores
 * exactly once.
 */
export function buildIdempotencyKey(input: PaymentEventInput): string {
  return [
    input.payment_source,
    input.payment_source_reference ?? "",
    input.event_type,
    input.source_event_id ?? "",
  ].join("|");
}

export function buildPaymentEventId(idempotencyKey: string): string {
  return `pevt_${stableToken(idempotencyKey)}`;
}

/**
 * A payment event must carry at least one source-owned identity. Without one,
 * an ingest could only fabricate a reference or silently collapse distinct
 * records — both forbidden, so the event is rejected with a typed error.
 */
export function assertSourceIdentity(input: PaymentEventInput): void {
  if (
    input.payment_source_reference === null &&
    input.source_event_id === null
  ) {
    throw new PaymentSourceError(
      "PAYMENT_EVENT_NO_SOURCE_IDENTITY",
      `cannot ingest ${input.payment_source} event without a payment_source_reference or source_event_id; refusing to fabricate or collapse identity`,
    );
  }
}

/**
 * Record a payment event exactly once. Replay of an identical event (same
 * source, source reference, event type, and source event id) resolves to the
 * already-persisted record and performs no second store write — and therefore
 * no second reconcile side effect downstream.
 */
export async function ingestPaymentEvent(
  store: JsonlStore,
  input: PaymentEventInput,
  options: { readonly now?: number } = {},
): Promise<IngestOutcome> {
  assertSourceIdentity(input);
  const idempotency_key = buildIdempotencyKey(input);
  const event_id = buildPaymentEventId(idempotency_key);
  const existing = await store.readLatestById<PaymentEvent>(
    "payment_events",
    event_id,
  );
  if (existing !== null) {
    return { recorded: false, replay: true, event: existing };
  }
  const event: PaymentEvent = {
    ...input,
    id: event_id,
    event_id,
    idempotency_key,
    observed_at: options.now ?? Date.now(),
  };
  await store.insert("payment_events", event);
  return { recorded: true, replay: false, event };
}

export async function listPaymentEvents(
  store: JsonlStore,
): Promise<readonly PaymentEvent[]> {
  return store.readAll<PaymentEvent>("payment_events");
}
