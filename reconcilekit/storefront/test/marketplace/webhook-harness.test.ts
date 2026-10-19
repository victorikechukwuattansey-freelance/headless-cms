import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../src/db/client.ts";
import { buildRepositories } from "../../src/db/repositories/index.ts";
import { withRollback } from "../db/helpers.ts";
import {
  ingestPaymentEvent,
  listPaymentEvents,
} from "../../src/marketplace/payment-sources/ingest.ts";
import {
  PaymentSourceError,
  type PaymentEventInput,
} from "../../src/marketplace/payment-sources/types.ts";

const prisma = getPrismaClient();

/**
 * Phase 3E evidence harness — test-only.
 *
 * Does NOT implement webhooks. Exercises the existing payment-source ingest
 * boundary with webhook-shaped deliveries to establish whether a real webhook
 * path would lose or duplicate events under realistic retry / reorder /
 * unknown-reference conditions.
 *
 * The ingest layer (`ingestPaymentEvent`) is the boundary a future webhook
 * receiver would call. Testing it here is the honest question: does the
 * boundary already tolerate webhook-class delivery, or is there a gap?
 *
 * A clean pass means 3E stays deferred with stronger evidence: the current
 * polling-based reconciliation already handles every webhook-class concern at
 * the ingest layer, so webhooks would improve latency, not correctness.
 * A failure means a concrete gap justifies 3E work under freeze §14.
 */

function webhookDelivery(
  overrides: Partial<PaymentEventInput> = {},
): PaymentEventInput {
  return {
    transaction_id: "mk_txn_demo",
    merchant_reference: "mk_txn_demo",
    payment_source: "PAYSTACK",
    payment_source_reference: "T545417640929891",
    source_event_id: "evt_charge_success_001",
    event_type: "PAYMENT",
    amount: 125000,
    currency: "NGN",
    status: "SUCCESS",
    occurred_at: 1789113697000,
    source_confidence: "CONFIRMED",
    source_attributes: {
      original_status: "success",
      webhook_event: "charge.success",
    },
    ...overrides,
  };
}

test("3E: the same webhook delivery retried is idempotent — one stored record", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const payload = webhookDelivery();

    const first = await ingestPaymentEvent(repos, payload, { now: 1000 });
    const second = await ingestPaymentEvent(repos, payload, { now: 2000 });

    assert.equal(first.recorded, true, "first delivery records");
    assert.equal(first.replay, false);
    assert.equal(second.recorded, false, "retry records nothing new");
    assert.equal(second.replay, true);
    assert.equal(
      first.event.event_id,
      second.event.event_id,
      "stable event id",
    );
    assert.equal(
      first.event.idempotency_key,
      second.event.idempotency_key,
      "stable idempotency key",
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 1, "exactly one stored record after retry");
  });
});

test("3E: a redelivery with a different source event id is a distinct event", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    await ingestPaymentEvent(
      repos,
      webhookDelivery({ source_event_id: "evt_charge_success_001" }),
    );
    await ingestPaymentEvent(
      repos,
      webhookDelivery({ source_event_id: "evt_charge_success_002" }),
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 2, "two distinct events for the same reference");
    assert.notEqual(all[0]?.event_id, all[1]?.event_id);
    assert.equal(
      all[0]?.payment_source_reference,
      all[1]?.payment_source_reference,
      "same source reference; distinct event ids",
    );
  });
});

test("3E: out-of-order delivery does not lose or cross-contaminate events", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    // A refund event arrives before the original charge success. Both share the
    // same payment_source_reference but carry distinct source_event_ids, so
    // both are distinct events. The ingest layer is order-agnostic; ordering is
    // interpreted downstream, not silently collapsed here.
    await ingestPaymentEvent(
      repos,
      webhookDelivery({
        source_event_id: "evt_refund_001",
        status: "CANCELLED",
        occurred_at: 1789113999000,
        source_attributes: {
          original_status: "reversed",
          webhook_event: "refund.processed",
        },
      }),
    );
    await ingestPaymentEvent(
      repos,
      webhookDelivery({
        source_event_id: "evt_charge_success_001",
        occurred_at: 1789113697000,
      }),
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 2, "both events stored");
    const ids = new Set(all.map((e) => e.event_id));
    assert.equal(ids.size, 2, "no deduplication across distinct events");
  });
});

test("3E: a webhook for a reference the storefront does not yet know is accepted", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    // Realistic race: Paystack fires the webhook before our own verify lookup
    // has associated the reference with a mk_txn_ anchor.
    const outcome = await ingestPaymentEvent(
      repos,
      webhookDelivery({
        transaction_id: null,
        merchant_reference: null,
        payment_source_reference: "T545417640929999",
        source_event_id: "evt_charge_success_999",
      }),
    );

    assert.equal(outcome.recorded, true, "unknown-reference webhook is stored");
    assert.equal(
      outcome.event.transaction_id,
      null,
      "no anchor fabricated for an unknown reference",
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 1);
    assert.equal(all[0]?.transaction_id, null);
  });
});

test("3E: a webhook with no source identity is rejected — never collapsed or fabricated", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    await assert.rejects(
      () =>
        ingestPaymentEvent(repos, {
          ...webhookDelivery(),
          payment_source_reference: null,
          source_event_id: null,
        }),
      (error: unknown) =>
        error instanceof PaymentSourceError &&
        error.code === "PAYMENT_EVENT_NO_SOURCE_IDENTITY",
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 0, "nothing written for the rejected event");
  });
});

test("3E: interleaved webhooks for two references do not cross-contaminate", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    const refA = webhookDelivery({
      payment_source_reference: "T545417640929A",
      source_event_id: "evt_a_001",
    });
    const refB = webhookDelivery({
      payment_source_reference: "T545417640929B",
      source_event_id: "evt_b_001",
      amount: 99999,
    });

    await ingestPaymentEvent(repos, refA);
    await ingestPaymentEvent(repos, refB);
    await ingestPaymentEvent(repos, { ...refA, source_event_id: "evt_a_002" });
    await ingestPaymentEvent(repos, refB); // retry of B

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 3, "two for A, one for B (retry deduped)");

    const counts = new Map<string, number>();
    for (const e of all) {
      const ref = e.payment_source_reference ?? "";
      counts.set(ref, (counts.get(ref) ?? 0) + 1);
    }
    assert.equal(counts.get("T545417640929A"), 2);
    assert.equal(counts.get("T545417640929B"), 1);

    for (const e of all) {
      if (e.payment_source_reference === "T545417640929A") {
        assert.equal(e.amount, 125000, "A keeps its own amount");
      }
      if (e.payment_source_reference === "T545417640929B") {
        assert.equal(e.amount, 99999, "B keeps its own amount");
      }
    }
  });
});

test("3E: the same reference from a different source is a distinct event", async (t) => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    await ingestPaymentEvent(
      repos,
      webhookDelivery({
        payment_source: "PAYSTACK",
        source_event_id: "evt_ps_001",
      }),
    );
    await ingestPaymentEvent(
      repos,
      webhookDelivery({
        payment_source: "BANK_TRANSFER",
        source_event_id: "evt_bt_001",
      }),
    );

    const all = await listPaymentEvents(repos);
    assert.equal(all.length, 2, "source is part of the idempotency key");
    const sources = new Set(all.map((e) => e.payment_source));
    assert.deepEqual(
      Array.from(sources).sort(),
      ["BANK_TRANSFER", "PAYSTACK"],
      "both sources represented",
    );
  });
});
