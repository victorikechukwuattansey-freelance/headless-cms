import { test } from "node:test";
import assert from "node:assert/strict";
import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "../../../src/db/client.ts";
import { buildRepositories } from "../../../src/db/repositories/index.ts";
import { withRollback } from "../helpers.ts";
import {
  seedCustomer,
  seedOrder,
  seedOrg,
  seedTransaction,
} from "../fixtures.ts";
import type { TransactionEvent } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedTransactionContext(
  tx: Prisma.TransactionClient,
  transactionId = "txn_1",
): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
  await seedTransaction(tx, {
    id: transactionId,
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    reference: `ref_${transactionId}`,
  });
}

function sampleEvent(
  overrides: Partial<TransactionEvent> = {},
): TransactionEvent {
  return {
    id: "evt_txn_1_1",
    transactionId: "txn_1",
    type: "ORDER_CREATED",
    label: "Order created",
    description: "The marketplace order was created",
    occurredAt: "2026-01-01T12:00:00.000Z",
    actor: "SYSTEM",
    source: "MARKETPLACE",
    metadata: { simulated: "true" },
    simulated: true,
    ...overrides,
  };
}

test("transactionEvents: insert persists and listByTransaction reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx);

    const event = sampleEvent();
    const saved = await repos.transactionEvents.insert(event);
    assert.deepEqual(saved, event);

    const rows = await repos.transactionEvents.listByTransaction("txn_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, "evt_txn_1_1");
    assert.equal(rows[0].type, "ORDER_CREATED");
    assert.equal(rows[0].simulated, true);
  });
});

test("transactionEvents: listByTransaction returns empty for an unknown transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.deepEqual(
      await repos.transactionEvents.listByTransaction("txn_missing"),
      [],
    );
  });
});

test("transactionEvents: insert with an existing id overwrites (upsert, not throw)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx);

    await repos.transactionEvents.insert(sampleEvent({ label: "First" }));
    await repos.transactionEvents.insert(sampleEvent({ label: "Second" }));

    const rows = await repos.transactionEvents.listByTransaction("txn_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].label, "Second");
  });
});

test("transactionEvents: listByTransaction isolates transactions", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx, "txn_a");
    await seedTransactionContext(tx, "txn_b");

    await repos.transactionEvents.insert(
      sampleEvent({
        id: "evt_txn_a_1",
        transactionId: "txn_a",
      }),
    );
    await repos.transactionEvents.insert(
      sampleEvent({
        id: "evt_txn_b_1",
        transactionId: "txn_b",
      }),
    );

    const a = await repos.transactionEvents.listByTransaction("txn_a");
    assert.equal(a.length, 1);
    assert.equal(a[0].transactionId, "txn_a");

    const b = await repos.transactionEvents.listByTransaction("txn_b");
    assert.equal(b.length, 1);
    assert.equal(b[0].transactionId, "txn_b");
  });
});

test("transactionEvents: listByTransaction orders by occurredAt then id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTransactionContext(tx);

    // Insert later event first.
    await repos.transactionEvents.insert(
      sampleEvent({
        id: "evt_txn_1_2",
        type: "PAYMENT_INITIATED",
        occurredAt: "2026-01-01T12:00:01.000Z",
      }),
    );
    await repos.transactionEvents.insert(
      sampleEvent({
        id: "evt_txn_1_1",
        type: "ORDER_CREATED",
        occurredAt: "2026-01-01T12:00:00.000Z",
      }),
    );

    const rows = await repos.transactionEvents.listByTransaction("txn_1");
    assert.equal(rows.length, 2);
    assert.equal(rows[0].type, "ORDER_CREATED");
    assert.equal(rows[1].type, "PAYMENT_INITIATED");
  });
});