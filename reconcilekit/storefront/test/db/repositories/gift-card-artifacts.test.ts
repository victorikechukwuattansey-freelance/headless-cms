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
import type { GiftCardArtifact } from "../../../src/marketplace/types.ts";

const prisma = getPrismaClient();

async function seedChain(tx: Prisma.TransactionClient): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: "cus_test_1", orgId: "org_test" });
  await seedOrder(tx, { id: "ord_test_1", customerId: "cus_test_1" });
  await seedTransaction(tx, {
    id: "txn_test_1",
    orderId: "ord_test_1",
    customerId: "cus_test_1",
    reference: "ref_txn_test_1",
  });
}

function sampleGiftCard(
  overrides: Partial<GiftCardArtifact> = {},
): GiftCardArtifact {
  return {
    id: "gift_txn_test_1",
    transactionId: "txn_test_1",
    brand: "Amazon",
    region: "US",
    denominationMinor: 2500,
    currency: "USD",
    quantity: 1,
    deliveryStatus: "DELIVERED",
    redemptionStatus: "UNREDEEMED",
    maskedCodePreview: "****ABCD",
    riskFlags: [],
    simulated: true,
    ...overrides,
  };
}

test("giftCardArtifacts: insert persists and listByTransaction reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = sampleGiftCard();
    const saved = await repos.giftCardArtifacts.insert(record);
    assert.deepEqual(saved, record);

    const rows = await repos.giftCardArtifacts.listByTransaction("txn_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].brand, "Amazon");
    assert.equal(rows[0].region, "US");
    assert.equal(rows[0].deliveryStatus, "DELIVERED");
    assert.equal(rows[0].redemptionStatus, "UNREDEEMED");
    assert.equal(rows[0].maskedCodePreview, "****ABCD");
    assert.deepEqual(rows[0].riskFlags, []);
    assert.equal(rows[0].simulated, true);
  });
});

test("giftCardArtifacts: listByTransaction returns empty for an unknown transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.deepEqual(
      await repos.giftCardArtifacts.listByTransaction("txn_missing"),
      [],
    );
  });
});

test("giftCardArtifacts: insert with an existing id overwrites (PENDING → DELIVERED)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.giftCardArtifacts.insert(
      sampleGiftCard({ deliveryStatus: "PENDING", maskedCodePreview: null }),
    );
    await repos.giftCardArtifacts.insert(
      sampleGiftCard({
        deliveryStatus: "DELIVERED",
        maskedCodePreview: "****ABCD",
      }),
    );

    const rows = await repos.giftCardArtifacts.listByTransaction("txn_test_1");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].deliveryStatus, "DELIVERED");
    assert.equal(rows[0].maskedCodePreview, "****ABCD");
  });
});

test("giftCardArtifacts: riskFlags round-trip without aliasing", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const flags = ["AMOUNT_MISMATCH", "DUPLICATE_PROVIDER_RECORD"];
    await repos.giftCardArtifacts.insert(
      sampleGiftCard({ riskFlags: flags }),
    );

    // Mutating the source array after insert must not affect the stored row.
    (flags as string[]).push("EXTRA");
    const rows = await repos.giftCardArtifacts.listByTransaction("txn_test_1");
    assert.deepEqual(rows[0].riskFlags, [
      "AMOUNT_MISMATCH",
      "DUPLICATE_PROVIDER_RECORD",
    ]);
  });
});