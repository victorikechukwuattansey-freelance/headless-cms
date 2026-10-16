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
import type { NotificationRecord } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedTxnContext(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
  await seedTransaction(tx, {
    id: "txn_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    reference: "ref_txn_1",
  });
}

function sampleNotification(
  overrides: Partial<NotificationRecord> = {},
): NotificationRecord {
  return {
    id: "ntf_cus_test_1_refund_pending_txn_1",
    customerId: "cus_test_1",
    transactionId: "txn_1",
    title: "Refund in progress",
    body: "Your refund is pending and will be posted to your wallet.",
    status: "UNREAD",
    createdAt: "2026-01-01T12:00:00.000Z",
    simulated: true,
    ...overrides,
  };
}

test("notifications: insert persists and readLatestById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    const notification = sampleNotification();
    const saved = await repos.notifications.insert(notification);
    assert.deepEqual(saved, notification);

    const found = await repos.notifications.readLatestById(
      "ntf_cus_test_1_refund_pending_txn_1",
    );
    assert.ok(found !== null);
    assert.equal(found.status, "UNREAD");
    assert.equal(found.customerId, "cus_test_1");
    assert.equal(found.transactionId, "txn_1");
  });
});

test("notifications: readLatestById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.notifications.readLatestById("ntf_missing"), null);
  });
});

test("notifications: insert with an existing id overwrites (UNREAD → READ)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await repos.notifications.insert(sampleNotification({ status: "UNREAD" }));
    await repos.notifications.insert(
      sampleNotification({
        status: "READ",
        createdAt: "2026-01-01T12:30:00.000Z",
      }),
    );

    const found = await repos.notifications.readLatestById(
      "ntf_cus_test_1_refund_pending_txn_1",
    );
    assert.ok(found !== null);
    assert.equal(found.status, "READ");
    assert.equal(found.createdAt, "2026-01-01T12:30:00.000Z");
  });
});

test("notifications: listByCustomer returns newest first", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);

    // Three notifications, distinct createdAt, inserted out of order.
    await repos.notifications.insert(
      sampleNotification({
        id: "ntf_cus_test_1_refund_pending_txn_1",
        title: "Refund in progress",
        createdAt: "2026-01-01T12:00:00.000Z",
      }),
    );
    await repos.notifications.insert(
      sampleNotification({
        id: "ntf_cus_test_1_refunded_txn_1",
        title: "Refund completed",
        createdAt: "2026-01-01T12:05:00.000Z",
      }),
    );
    await repos.notifications.insert(
      sampleNotification({
        id: "ntf_cus_test_1_payment_failed_txn_1",
        title: "Payment failed",
        createdAt: "2026-01-01T11:55:00.000Z",
      }),
    );

    const rows = await repos.notifications.listByCustomer("cus_test_1");
    assert.equal(rows.length, 3);
    assert.equal(rows[0].id, "ntf_cus_test_1_refunded_txn_1");
    assert.equal(rows[1].id, "ntf_cus_test_1_refund_pending_txn_1");
    assert.equal(rows[2].id, "ntf_cus_test_1_payment_failed_txn_1");
  });
});

test("notifications: listByCustomer isolates customers", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedTxnContext(tx);
    await seedCustomer(tx, { id: "cus_other", orgId: "org_test" });

    await repos.notifications.insert(sampleNotification());
    await repos.notifications.insert(
      sampleNotification({
        id: "ntf_cus_other_refund_pending_none",
        customerId: "cus_other",
        transactionId: null,
      }),
    );

    const rows = await repos.notifications.listByCustomer("cus_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].customerId, "cus_test_1");
  });
});
