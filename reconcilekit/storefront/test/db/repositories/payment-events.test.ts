import { test } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import type { PaymentEvent } from "../../../src/marketplace/payment-sources/types.ts";

const prisma = getPrismaClient();

function sampleEvent(
  overrides: Partial<PaymentEvent> = {},
): PaymentEvent {
  return {
    id: "pevt_test_1",
    event_id: "pevt_test_1",
    idempotency_key: "PAYSTACK|ref_abc|PAYMENT|evt_1",
    transaction_id: "mk_txn_test_1",
    merchant_reference: "mk_txn_test_1",
    payment_source: "PAYSTACK",
    payment_source_reference: "ps_ref_abc",
    source_event_id: "evt_1",
    event_type: "PAYMENT",
    amount: 12500,
    currency: "NGN",
    status: "SUCCESS",
    occurred_at: 1767225600000,
    source_confidence: "CONFIRMED",
    source_attributes: {
      provider_status: "success",
      gateway: "paystack",
    },
    observed_at: 1767225601000,
    ...overrides,
  };
}

test("paymentEvents: insert persists and getById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    const record = sampleEvent();
    const saved = await repos.paymentEvents.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.paymentEvents.getById("pevt_test_1");
    assert.ok(found !== null);
    assert.equal(found.payment_source, "PAYSTACK");
    assert.equal(found.status, "SUCCESS");
    assert.equal(found.amount, 12500);
    assert.equal(found.currency, "NGN");
    assert.equal(found.source_confidence, "CONFIRMED");
    assert.equal(found.source_attributes.provider_status, "success");
  });
});

test("paymentEvents: getById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.paymentEvents.getById("pevt_missing"), null);
  });
});

test("paymentEvents: timestamps round-trip as epoch milliseconds (lossless)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    // Deliberately non-round values to catch a seconds↔milliseconds mixup.
    await repos.paymentEvents.insert(
      sampleEvent({
        occurred_at: 1767225600123,
        observed_at: 1767225601456,
      }),
    );

    const found = await repos.paymentEvents.getById("pevt_test_1");
    assert.ok(found !== null);
    assert.equal(found.occurred_at, 1767225600123);
    assert.equal(found.observed_at, 1767225601456);
    // Guard against `new Date(null)` silently becoming epoch 0:
    assert.notEqual(found.occurred_at, 0);
  });
});

test("paymentEvents: occurred_at null round-trips as null (not epoch 0)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.paymentEvents.insert(
      sampleEvent({ occurred_at: null, status: null }),
    );

    const found = await repos.paymentEvents.getById("pevt_test_1");
    assert.ok(found !== null);
    assert.equal(found.occurred_at, null);
    assert.equal(found.status, null);
  });
});

test("paymentEvents: insert with an existing id overwrites", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await repos.paymentEvents.insert(
      sampleEvent({ source_confidence: "OBSERVED" }),
    );
    await repos.paymentEvents.insert(
      sampleEvent({ source_confidence: "CONFIRMED" }),
    );

    const found = await repos.paymentEvents.getById("pevt_test_1");
    assert.ok(found !== null);
    assert.equal(found.source_confidence, "CONFIRMED");
  });
});

test("paymentEvents: list returns all in (observedAt asc, id asc) order", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);

    // Two events at the same observedAt to exercise the id tiebreaker,
    // plus one earlier. Insert out of read order.
    await repos.paymentEvents.insert(
      sampleEvent({
        id: "pevt_b",
        event_id: "pevt_b",
        idempotency_key: "PAYSTACK|ref_b|PAYMENT|evt_b",
        observed_at: 1767225601000,
      }),
    );
    await repos.paymentEvents.insert(
      sampleEvent({
        id: "pevt_a",
        event_id: "pevt_a",
        idempotency_key: "PAYSTACK|ref_a|PAYMENT|evt_a",
        observed_at: 1767225601000,
      }),
    );
    await repos.paymentEvents.insert(
      sampleEvent({
        id: "pevt_c",
        event_id: "pevt_c",
        idempotency_key: "PAYSTACK|ref_c|PAYMENT|evt_c",
        observed_at: 1767225600000,
      }),
    );

    const rows = await repos.paymentEvents.list();
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((row) => row.id),
      ["pevt_c", "pevt_a", "pevt_b"],
    );
  });
});