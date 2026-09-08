import { test } from "node:test";
import assert from "node:assert/strict";
import type {
  CanonicalPaymentStatus,
  Outcome,
} from "../../../src/domain/model.ts";
import type {
  MarketplacePaymentRecord,
  MarketplaceTransaction,
} from "../../src/marketplace/types.ts";

test("marketplace transaction shape uses ReconcileKit payment status and outcome", () => {
  const paymentStatus: CanonicalPaymentStatus = "SUCCESS";
  const reconcileOutcome: Outcome = "MATCH";
  const transaction: MarketplaceTransaction = {
    id: "txn_1",
    orderId: "ord_1",
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    providerId: "mock_vtu",
    reference: "mk_txn_1",
    scenario: "SUCCESS",
    paymentStatus,
    fulfillmentStatus: "FULFILLED",
    reconcileOutcome,
    resolutionStatus: "NONE",
    customerStatus: "CONFIRMED",
    adminStatus: "HEALTHY",
    simulated: true,
    createdAt: "2026-01-01T12:00:00.000Z",
    updatedAt: "2026-01-01T12:00:00.000Z",
  };

  assert.equal(transaction.paymentStatus, "SUCCESS");
  assert.equal(transaction.reconcileOutcome, "MATCH");
  assert.equal(transaction.simulated, true);
});

test("marketplace payment record stays generic while preserving canonical status", () => {
  const record: MarketplacePaymentRecord = {
    id: "mpay_1",
    transactionId: "txn_1",
    orderId: "ord_1",
    customerId: "cus_demo",
    walletReference: "wal_ref_1",
    providerReference: "mock_provider_ref_1",
    expectedAmountMinor: 100000,
    actualAmountMinor: 100000,
    currency: "NGN",
    status: "SUCCESS",
    paidAt: "2026-01-01T12:00:00.000Z",
    metadata: { provider_family: "mock_vtu" },
    recordedAt: "2026-01-01T12:00:01.000Z",
    simulated: true,
  };

  assert.equal(record.status, "SUCCESS");
  assert.equal(record.providerReference, "mock_provider_ref_1");
});
