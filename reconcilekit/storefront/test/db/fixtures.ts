import { Prisma } from "@prisma/client";

/**
 * Minimal FK-chain seeders for repository tests.
 *
 * These exist because the wallet / ledger / event tables all carry FKs
 * up through marketplace_transactions -> marketplace_orders ->
 * marketplace_customers -> organizations. They seed via raw Prisma,
 * NOT via the repository bundle, so a batch that does not yet include
 * the upstream repos (marketplaceCustomers, marketplaceOrders,
 * marketplaceTransactions) can still exercise the downstream ones.
 *
 * When those upstream repos land, later batches may swap these for
 * repo calls — but keeping raw Prisma here is a feature, not a
 * deficiency: fixtures are outside the code under test.
 *
 * Every seeder is idempotent (upsert). Tests that seed more than one
 * transaction inside a single rollback — e.g. the isolation test in
 * transaction-events.test.ts — depend on this: the two contexts share
 * org / customer / order and only the transaction id differs.
 */

const FIXED = new Date("2026-01-01T00:00:00.000Z");

export async function seedOrg(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  await tx.organization.upsert({
    where: { id },
    create: { id, name: `Org ${id}`, createdAt: FIXED },
    update: {},
  });
}

export async function seedCustomer(
  tx: Prisma.TransactionClient,
  input: { readonly id: string; readonly orgId: string },
): Promise<void> {
  await tx.marketplaceCustomer.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      orgId: input.orgId,
      name: `Customer ${input.id}`,
      email: `${input.id}@example.com`,
      phone: null,
      isDemo: true,
      createdAt: FIXED,
    },
    update: {},
  });
}

export async function seedOrder(
  tx: Prisma.TransactionClient,
  input: { readonly id: string; readonly customerId: string },
): Promise<void> {
  await tx.marketplaceOrder.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      customerId: input.customerId,
      serviceId: "svc_airtime",
      inputs: {},
      quotedAmountMinor: 12500,
      currency: "NGN",
      customerReference: `ref_${input.id}`,
      status: "CREATED",
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}

export async function seedTransaction(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly reference: string;
  },
): Promise<void> {
  await tx.marketplaceTransaction.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      orderId: input.orderId,
      customerId: input.customerId,
      reference: input.reference,
      serviceId: "svc_airtime",
      providerId: "prv_mock",
      scenario: "SUCCESS",
      paymentStatus: "SUCCESS",
      fulfillmentStatus: "FULFILLED",
      reconcileOutcome: "MATCH",
      resolutionStatus: "NONE",
      customerStatus: "HEALTHY",
      adminStatus: "HEALTHY",
      demoScenarioName: null,
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}

export async function seedEvidencePack(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly transactionId: string;
    readonly customerReference: string;
    readonly amountMinor: number;
    readonly currency: string;
  },
): Promise<void> {
  await tx.evidencePack.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      transactionId: input.transactionId,
      customerReference: input.customerReference,
      providerReference: null,
      paymentReference: null,
      serviceSnapshot: {},
      amountMinor: input.amountMinor,
      currency: input.currency,
      timelineEventIds: [],
      providerFacts: {},
      reconciliation: Prisma.DbNull,
      mismatchFlags: [],
      resolutionStatus: "NONE",
      auditEventIds: [],
      createdAt: FIXED,
    },
    update: {},
  });
}

export async function seedUser(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly email?: string;
    readonly displayName?: string;
  },
): Promise<void> {
  await tx.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email ?? `${input.id}@example.com`,
      passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$seed",
      displayName: input.displayName ?? `User ${input.id}`,
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}