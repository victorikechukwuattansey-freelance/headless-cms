import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../../src/db/client.ts";
import {
  buildRepositories,
  type Repositories,
} from "../../src/db/repositories/index.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  executeMarketplaceTransaction,
  validateServiceInputs,
  ServiceInputValidationError,
} from "../../src/marketplace/transactions.ts";
import { demoDeps } from "./demo-deps.ts";
import { seedDemoCustomer } from "../db/fixtures.ts";
import { truncateCommittedState } from "../db/isolation.ts";
import type { ExecuteTransactionInput } from "../../src/marketplace/transactions.ts";
import type { ServiceInputDescriptor } from "../../src/marketplace/types.ts";

const prisma = getPrismaClient();
const repos = buildRepositories(prisma);

before(async () => {
  await seedDemoCustomer(prisma);
});

after(async () => {
  await truncateCommittedState(prisma);
});

const NOW = WALLET_FIXED_TIMESTAMP;

function txn(
  overrides: Partial<ExecuteTransactionInput> = {},
): ExecuteTransactionInput {
  return {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
    ...overrides,
  };
}

async function providerAttempts(repos: Repositories): Promise<number> {
  return (await repos.marketplaceProviderAttempts.list()).length;
}

async function orders(repos: Repositories): Promise<number> {
  return (await repos.marketplaceOrders.listByCustomer("cus_demo")).length;
}

async function ticketArtifacts(repos: Repositories): Promise<number> {
  return (await repos.ticketArtifacts.list()).length;
}

async function giftArtifacts(repos: Repositories): Promise<number> {
  return (await repos.giftCardArtifacts.list()).length;
}

async function ledgerEntries(repos: Repositories): Promise<number> {
  const wallet = await repos.wallets.findByCustomer("cus_demo");
  if (wallet === null) return 0;
  return (await repos.walletLedger.listByWallet(wallet.id)).length;
}

async function expectValidationError(
  execInput: ExecuteTransactionInput,
  field: string,
  code: string,
): Promise<void> {
  await assert.rejects(
    executeMarketplaceTransaction(demoDeps(repos), execInput),
    (error: unknown) => {
      assert.ok(
        error instanceof ServiceInputValidationError,
        `expected ServiceInputValidationError, got ${String(error)}`,
      );
      assert.equal(error.field, field);
      assert.equal(error.code, code);
      return true;
    },
  );
}

test("generic validator: missing required fields and SELECT membership are deterministic in schema order", () => {
  const schema: readonly ServiceInputDescriptor[] = [
    {
      name: "network",
      label: "Network",
      type: "SELECT",
      required: true,
      options: ["MTN", "Airtel"],
    },
    {
      name: "recipient",
      label: "Recipient phone",
      type: "PHONE",
      required: true,
    },
    { name: "amount", label: "Amount", type: "NUMBER", required: true },
  ];
  const errors = validateServiceInputs(schema, { network: "Vodafone" });
  assert.equal(errors.length, 3);
  assert.equal(errors[0]?.field, "network");
  assert.equal(errors[0]?.code, "INVALID_SELECT");
  assert.equal(errors[1]?.field, "recipient");
  assert.equal(errors[1]?.code, "MISSING_REQUIRED");
});

test("validation boundary: unknown service throws TransactionInputError, betting compliance blocks before validation", async (t) => {
  const ordersBefore = await orders(repos);
  const attemptsBefore = await providerAttempts(repos);
  await assert.rejects(
    executeMarketplaceTransaction(
      demoDeps(repos),
      txn({ serviceId: "svc_does_not_exist" }),
    ),
    (error: unknown) =>
      error instanceof Error &&
      error.name === "TransactionInputError" &&
      !(error instanceof ServiceInputValidationError),
  );
  await assert.rejects(
    executeMarketplaceTransaction(
      demoDeps(repos),
      txn({ serviceId: "svc_betting_examplebet" }),
    ),
    (error: unknown) =>
      error instanceof Error && !(error instanceof ServiceInputValidationError),
  );
  assert.equal(await providerAttempts(repos), attemptsBefore);
  assert.equal(await orders(repos), ordersBefore);
});

test("valid airtime input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({ scenario: "SUCCESS" }),
  );
  assert.equal(result.replayed, false);
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
  assert.equal(result.transaction.fulfillmentStatus, "FULFILLED");
});

test("missing airtime recipient is rejected before any write", async (t) => {
  const ledgerBefore = await ledgerEntries(repos);
  const ordersBefore = await orders(repos);
  const attemptsBefore = await providerAttempts(repos);
  await expectValidationError(
    txn({
      inputs: { network: "MTN", amount: "1000" },
    }),
    "recipient",
    "MISSING_REQUIRED",
  );
  assert.equal(await providerAttempts(repos), attemptsBefore);
  assert.equal(await orders(repos), ordersBefore);
  assert.equal(await ledgerEntries(repos), ledgerBefore);
});

test("invalid airtime network SELECT is rejected", async (t) => {
  await expectValidationError(
    txn({
      inputs: { network: "Vodafone", recipient: "08030000000", amount: "1000" },
    }),
    "network",
    "INVALID_SELECT",
  );
});

test("invalid airtime amount NUMBER is rejected", async (t) => {
  await expectValidationError(
    txn({
      inputs: { network: "MTN", recipient: "08030000000", amount: "abc" },
    }),
    "amount",
    "INVALID_NUMBER",
  );
});

test("invalid airtime recipient PHONE is rejected", async (t) => {
  await expectValidationError(
    txn({
      inputs: { network: "MTN", recipient: "not-a-phone", amount: "1000" },
    }),
    "recipient",
    "INVALID_PHONE",
  );
});

test("missing field reports the first schema-order error deterministically", async (t) => {
  await expectValidationError(
    txn({
      inputs: { recipient: "08030000000", amount: "1000" },
    }),
    "network",
    "MISSING_REQUIRED",
  );
});

test("valid data input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_data_mtn",
      inputs: { network: "MTN", recipient: "08030000000", plan: "2GB" },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing data plan is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_data_mtn",
      inputs: { network: "MTN", recipient: "08030000000" },
    }),
    "plan",
    "MISSING_REQUIRED",
  );
});

test("valid electricity input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_electricity_aedc",
      inputs: {
        provider: "AEDC",
        meterNumber: "23456781",
        meterType: "prepaid",
        amount: "10000",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing electricity meter number is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_electricity_aedc",
      inputs: { provider: "AEDC", meterType: "prepaid", amount: "10000" },
    }),
    "meterNumber",
    "MISSING_REQUIRED",
  );
});

test("valid cable input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_cable_dstv",
      inputs: {
        provider: "DStv",
        subscriberNumber: "7000000000",
        package: "Compact",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing cable subscriber number is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_cable_dstv",
      inputs: { provider: "DStv", package: "Compact" },
    }),
    "subscriberNumber",
    "MISSING_REQUIRED",
  );
});

test("valid internet input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_internet_spectranet",
      inputs: {
        provider: "Spectranet",
        plan: "Monthly",
        accountNumber: "ACCT-001",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("valid education input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_education_jamb",
      inputs: {
        institution: "JAMB",
        applicationNumber: "JAMB/2026/0001",
        amount: "4700",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("valid gift card input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_giftcard_amazon",
      inputs: {
        brand: "Amazon",
        region: "US",
        denomination: "$25",
        quantity: "1",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("invalid gift card region is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_giftcard_amazon",
      inputs: {
        brand: "Amazon",
        region: "AF",
        denomination: "$25",
        quantity: "1",
      },
    }),
    "region",
    "INVALID_SELECT",
  );
});

test("invalid gift card denomination is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_giftcard_amazon",
      inputs: {
        brand: "Amazon",
        region: "US",
        denomination: "$999",
        quantity: "1",
      },
    }),
    "denomination",
    "INVALID_SELECT",
  );
});

test("valid digital voucher input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_voucher_digital",
      inputs: {
        brand: "Amazon",
        region: "Global",
        denomination: "$25",
        quantity: "1",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("valid cinema booking input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_cinema_filmhouse",
      inputs: {
        venue: "Filmhouse IMAX",
        movie: "Oppenheimer",
        screening: "2026-02-01T19:00:00.000Z",
        seats: "A1",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing cinema screening is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_cinema_filmhouse",
      inputs: {
        venue: "Filmhouse IMAX",
        movie: "Oppenheimer",
        seats: "A1",
      },
    }),
    "screening",
    "MISSING_REQUIRED",
  );
});

test("missing cinema seats is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_cinema_filmhouse",
      inputs: {
        venue: "Filmhouse IMAX",
        movie: "Oppenheimer",
        screening: "2026-02-01T19:00:00.000Z",
      },
    }),
    "seats",
    "MISSING_REQUIRED",
  );
});

test("invalid cinema screening DATE is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_cinema_filmhouse",
      inputs: {
        venue: "Filmhouse IMAX",
        movie: "Oppenheimer",
        screening: "tomorrow",
        seats: "A1",
      },
    }),
    "screening",
    "INVALID_DATE",
  );
});

test("valid event booking input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_event_lagos tech fest",
      inputs: {
        eventName: "Lagos Tech Fest",
        date: "2026-02-10",
        ticketType: "VIP",
        quantity: "2",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("valid bus booking input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_bus_lagos_abuja",
      inputs: {
        origin: "Lagos",
        destination: "Abuja",
        date: "2026-02-10",
        passenger: "Ada Obi",
        seat: "A1",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing bus passenger is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_bus_lagos_abuja",
      inputs: {
        origin: "Lagos",
        destination: "Abuja",
        date: "2026-02-10",
        seat: "A1",
      },
    }),
    "passenger",
    "MISSING_REQUIRED",
  );
});

test("missing bus route (origin) is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_bus_lagos_abuja",
      inputs: {
        destination: "Abuja",
        date: "2026-02-10",
        passenger: "Ada Obi",
        seat: "A1",
      },
    }),
    "origin",
    "MISSING_REQUIRED",
  );
});

test("valid airline booking input executes successfully", async (t) => {
  const result = await executeMarketplaceTransaction(
    demoDeps(repos),
    txn({
      serviceId: "svc_airline_los_abv",
      inputs: {
        origin: "LOS",
        destination: "ABV",
        date: "2026-02-10",
        passenger: "Chidi Okafor",
        flight: "Economy",
      },
    }),
  );
  assert.equal(result.transaction.paymentStatus, "SUCCESS");
});

test("missing airline passenger is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_airline_los_abv",
      inputs: {
        origin: "LOS",
        destination: "ABV",
        date: "2026-02-10",
        flight: "Economy",
      },
    }),
    "passenger",
    "MISSING_REQUIRED",
  );
});

test("missing airline flight is rejected", async (t) => {
  await expectValidationError(
    txn({
      serviceId: "svc_airline_los_abv",
      inputs: {
        origin: "LOS",
        destination: "ABV",
        date: "2026-02-10",
        passenger: "Chidi Okafor",
      },
    }),
    "flight",
    "MISSING_REQUIRED",
  );
});

test("invalid input never debits the wallet", async (t) => {
  const ledgerBefore = await ledgerEntries(repos);
  await expectValidationError(
    txn({
      inputs: { network: "MTN", amount: "1000" },
    }),
    "recipient",
    "MISSING_REQUIRED",
  );
  assert.equal(await ledgerEntries(repos), ledgerBefore);
});

test("invalid input never calls the provider", async (t) => {
  const attemptsBefore = await providerAttempts(repos);
  await expectValidationError(
    txn({
      serviceId: "svc_airline_los_abv",
      inputs: {
        origin: "LOS",
        destination: "ABV",
        date: "2026-02-10",
        passenger: "Chidi Okafor",
      },
    }),
    "flight",
    "MISSING_REQUIRED",
  );
  assert.equal(await providerAttempts(repos), attemptsBefore);
});

test("invalid input never creates fulfillment artifacts or orders", async (t) => {
  const ordersBefore = await orders(repos);
  const giftArtifactsBefore = await giftArtifacts(repos);
  const ticketArtifactsBefore = await ticketArtifacts(repos);
  await expectValidationError(
    txn({
      serviceId: "svc_giftcard_amazon",
      inputs: { brand: "Amazon", region: "US", quantity: "1" },
    }),
    "denomination",
    "MISSING_REQUIRED",
  );
  assert.equal(await giftArtifacts(repos), giftArtifactsBefore);
  assert.equal(await ticketArtifacts(repos), ticketArtifactsBefore);
  assert.equal(await orders(repos), ordersBefore);
});
