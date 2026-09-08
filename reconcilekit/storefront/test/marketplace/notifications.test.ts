import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  buildNotificationId,
  emitNotification,
  listNotificationsByCustomer,
  markNotificationRead,
  NotificationError,
  notificationsForTruth,
} from "../../src/marketplace/notifications.ts";
import { buildTransactionTruth } from "../../src/marketplace/truth.ts";
import type {
  CustomerTransactionStatus,
  NotificationRecord,
} from "../../src/marketplace/types.ts";

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-not-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function truthFor(customerStatus: CustomerTransactionStatus) {
  return buildTransactionTruth({
    transactionId: "mk_txn_demo",
    outcome:
      customerStatus === "CONFIRMED"
        ? "MATCH"
        : customerStatus === "FAILED"
          ? "MISSING_PROVIDER_RECORD"
          : customerStatus === "PENDING"
            ? "MISSING_PROVIDER_RECORD"
            : "DISCREPANCY",
    codes:
      customerStatus === "MANUAL_REVIEW"
        ? []
        : customerStatus === "NEEDS_ATTENTION"
          ? ["STATUS_MISMATCH"]
          : [],
    paymentState:
      customerStatus === "PENDING"
        ? "PENDING"
        : customerStatus === "FAILED"
          ? "FAILED"
          : "SUCCESS",
    resolutionStatus:
      customerStatus === "REFUND_PENDING"
        ? "REFUND_PENDING"
        : customerStatus === "REFUNDED"
          ? "REFUNDED"
          : customerStatus === "REVERSED"
            ? "REVERSED"
            : customerStatus === "MANUAL_REVIEW"
              ? "MANUAL_REVIEW"
              : "NONE",
    expectedAmountMinor: 1000,
    currency: "NGN",
    providerAmountMinor: 1000,
  });
}

test("emitNotification persists and deterministic ids make replay an upsert", async (t) => {
  const store = tempStore(t);
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "refund_pending",
    title: "Refund in progress",
    body: "first text",
    now: NOW,
  });
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "refund_pending",
    title: "Refund in progress",
    body: "second text",
    now: "2026-01-01T13:00:00.000Z",
  });

  const notifications = await listNotificationsByCustomer(store, "cus_demo");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.body, "second text");
  assert.equal(notifications[0]?.status, "UNREAD");
  assert.equal(notifications[0]?.simulated, true);
  assert.equal(
    notifications[0]?.id,
    buildNotificationId("cus_demo", "refund_pending", "mk_txn_1"),
  );
});

test("markNotificationRead flips the status and guards ownership", async (t) => {
  const store = tempStore(t);
  const created = await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "needs_attention",
    title: "Needs attention",
    body: "your money is at risk",
    now: NOW,
  });
  const read = await markNotificationRead(store, {
    customerId: "cus_demo",
    id: created.id,
  });
  assert.equal(read.status, "READ");

  await assert.rejects(
    markNotificationRead(store, {
      customerId: "cus_other",
      id: created.id,
    }),
    (error: unknown) =>
      error instanceof NotificationError &&
      error.code === "NOTIFICATION_NOT_FOUND",
  );
});

test("listNotificationsByCustomer sorts newest first", async (t) => {
  const store = tempStore(t);
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_a",
    kind: "refunded",
    title: "Refunded",
    body: "older",
    now: NOW,
  });
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_b",
    kind: "payment_failed",
    title: "Failed",
    body: "newer",
    now: "2026-01-01T13:00:00.000Z",
  });
  const notifications: readonly NotificationRecord[] =
    await listNotificationsByCustomer(store, "cus_demo");
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.body, "newer");
});

test("notificationsForTruth is derived from the truth projection only", () => {
  assert.equal(
    notificationsForTruth(truthFor("CONFIRMED"), {
      customerId: "cus_demo",
      transactionId: "mk_txn_demo",
    }).length,
    0,
  );
  assert.equal(
    notificationsForTruth(truthFor("PENDING"), {
      customerId: "cus_demo",
      transactionId: "mk_txn_demo",
    }).length,
    0,
  );

  const failed = notificationsForTruth(truthFor("FAILED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(failed[0]?.kind, "payment_failed");

  const refundPending = notificationsForTruth(truthFor("REFUND_PENDING"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(refundPending[0]?.kind, "refund_pending");

  const refunded = notificationsForTruth(truthFor("REFUNDED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(refunded[0]?.kind, "refunded");

  const reversed = notificationsForTruth(truthFor("REVERSED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(reversed[0]?.kind, "reversed");

  const review = notificationsForTruth(truthFor("MANUAL_REVIEW"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(review[0]?.kind, "manual_review");

  const attention = notificationsForTruth(truthFor("NEEDS_ATTENTION"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(attention[0]?.kind, "needs_attention");
  assert.match(attention[0]?.body ?? "", /at risk/);
});
