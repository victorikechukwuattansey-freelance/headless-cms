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
import type { TicketArtifact } from "../../../src/marketplace/types.ts";

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

function sampleTicket(
  overrides: Partial<TicketArtifact> = {},
): TicketArtifact {
  return {
    id: "tkt_txn_test_1",
    transactionId: "txn_test_1",
    ticketKind: "CINEMA",
    reservationReference: "res_abc",
    issueReference: "iss_xyz",
    passengerOrAttendee: "Demo Customer",
    routeOrVenue: "Filmhouse IMAX",
    seat: "A12",
    status: "ISSUED",
    maskedCode: "****1234",
    issuedAt: "2026-01-01T12:00:00.000Z",
    cancellationReference: null,
    cancelledAt: null,
    simulated: true,
    ...overrides,
  };
}

test("ticketArtifacts: insert persists and getById reads back", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    const record = sampleTicket();
    const saved = await repos.ticketArtifacts.insert(record);
    assert.deepEqual(saved, record);

    const found = await repos.ticketArtifacts.getById("tkt_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.ticketKind, "CINEMA");
    assert.equal(found.status, "ISSUED");
    assert.equal(found.maskedCode, "****1234");
    assert.equal(found.issuedAt, "2026-01-01T12:00:00.000Z");
    assert.equal(found.cancellationReference, null);
    assert.equal(found.simulated, true);
  });
});

test("ticketArtifacts: getById returns null for an unknown id", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    assert.equal(await repos.ticketArtifacts.getById("tkt_missing"), null);
  });
});

test("ticketArtifacts: insert with an existing id overwrites (cancellation in place)", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await repos.ticketArtifacts.insert(sampleTicket({ status: "ISSUED" }));
    await repos.ticketArtifacts.insert(
      sampleTicket({
        status: "CANCELLED",
        cancellationReference: "cnl_abc",
        cancelledAt: "2026-01-01T13:00:00.000Z",
      }),
    );

    const found = await repos.ticketArtifacts.getById("tkt_txn_test_1");
    assert.ok(found !== null);
    assert.equal(found.status, "CANCELLED");
    assert.equal(found.cancellationReference, "cnl_abc");
    assert.equal(found.cancelledAt, "2026-01-01T13:00:00.000Z");
  });
});

test("ticketArtifacts: listByTransaction isolates by transaction", async () => {
  await withRollback(prisma, async (tx) => {
    const repos = buildRepositories(tx);
    await seedChain(tx);
    await seedTransaction(tx, {
      id: "txn_test_2",
      orderId: "ord_test_1",
      customerId: "cus_test_1",
      reference: "ref_txn_test_2",
    });

    await repos.ticketArtifacts.insert(
      sampleTicket({ id: "tkt_txn_test_1", transactionId: "txn_test_1" }),
    );
    await repos.ticketArtifacts.insert(
      sampleTicket({ id: "tkt_txn_test_2", transactionId: "txn_test_2" }),
    );

    const a = await repos.ticketArtifacts.listByTransaction("txn_test_1");
    assert.equal(a.length, 1);
    assert.equal(a[0].id, "tkt_txn_test_1");

    const b = await repos.ticketArtifacts.listByTransaction("txn_test_2");
    assert.equal(b.length, 1);
    assert.equal(b[0].id, "tkt_txn_test_2");

    assert.deepEqual(
      await repos.ticketArtifacts.listByTransaction("txn_missing"),
      [],
    );
  });
});