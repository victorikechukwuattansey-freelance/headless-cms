import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  CanonicalPaymentStatus,
  Outcome,
} from "../../../../src/domain/model.ts";
import type {
  AdminTransactionStatus,
  CustomerTransactionStatus,
  FulfillmentStatus,
  MarketplaceTransaction,
  MockProviderScenario,
  ResolutionStatus,
} from "../../marketplace/types.ts";

/**
 * Marketplace transaction repository (kind: marketplace_transactions).
 *
 * The `demoScenarioName` field is optional in the domain type but
 * nullable in the schema. Round-tripping preserves the distinction:
 *   - domain absent  -> Prisma null    -> domain absent (key omitted)
 *   - domain present -> Prisma string  -> domain present
 * Omitting the key on read (rather than setting it to undefined)
 * matters because deepStrictEqual distinguishes an own property set to
 * undefined from a property that isn't there.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class MarketplaceTransactionRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(
    record: MarketplaceTransaction,
  ): Promise<MarketplaceTransaction> {
    await this.client.marketplaceTransaction.upsert({
      where: { id: record.id },
      create: toPrismaTransaction(record),
      update: toPrismaTransaction(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplaceTransaction | null> {
    const row = await this.client.marketplaceTransaction.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaTransaction(row);
  }

  async updateStatuses(
    id: string,
    patch: {
      readonly fulfillmentStatus?: FulfillmentStatus;
      readonly customerStatus?: CustomerTransactionStatus;
      readonly adminStatus?: AdminTransactionStatus;
      readonly updatedAt: string;
    },
  ): Promise<MarketplaceTransaction | null> {
    const data: {
      fulfillmentStatus?: FulfillmentStatus;
      customerStatus?: CustomerTransactionStatus;
      adminStatus?: AdminTransactionStatus;
      updatedAt: Date;
    } = { updatedAt: new Date(patch.updatedAt) };
    if (patch.fulfillmentStatus !== undefined) {
      data.fulfillmentStatus = patch.fulfillmentStatus;
    }
    if (patch.customerStatus !== undefined) {
      data.customerStatus = patch.customerStatus;
    }
    if (patch.adminStatus !== undefined) {
      data.adminStatus = patch.adminStatus;
    }
    const result = await this.client.marketplaceTransaction.updateMany({
      where: { id },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    const row = await this.client.marketplaceTransaction.findUniqueOrThrow({
      where: { id },
    });
    return fromPrismaTransaction(row);
  }

  async list(): Promise<readonly MarketplaceTransaction[]> {
    const rows = await this.client.marketplaceTransaction.findMany();
    return rows.map((row) => fromPrismaTransaction(row));
  }
}

interface MarketplaceTransactionRow {
  readonly id: string;
  readonly orderId: string;
  readonly customerId: string;
  readonly serviceId: string;
  readonly providerId: string;
  readonly reference: string;
  readonly scenario: string;
  readonly paymentStatus: string;
  readonly fulfillmentStatus: string;
  readonly reconcileOutcome: string | null;
  readonly resolutionStatus: string;
  readonly customerStatus: string;
  readonly adminStatus: string;
  readonly demoScenarioName: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly simulated: boolean;
}

function toPrismaTransaction(
  record: MarketplaceTransaction,
): Prisma.MarketplaceTransactionUncheckedCreateInput {
  return {
    id: record.id,
    orderId: record.orderId,
    customerId: record.customerId,
    serviceId: record.serviceId,
    providerId: record.providerId,
    reference: record.reference,
    scenario: record.scenario,
    paymentStatus: record.paymentStatus,
    fulfillmentStatus: record.fulfillmentStatus,
    reconcileOutcome: record.reconcileOutcome,
    resolutionStatus: record.resolutionStatus,
    customerStatus: record.customerStatus,
    adminStatus: record.adminStatus,
    demoScenarioName: record.demoScenarioName ?? null,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

function fromPrismaTransaction(
  row: MarketplaceTransactionRow,
): MarketplaceTransaction {
  const base: MarketplaceTransaction = {
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    serviceId: row.serviceId,
    providerId: row.providerId,
    reference: row.reference,
    scenario: row.scenario as MockProviderScenario,
    paymentStatus: row.paymentStatus as CanonicalPaymentStatus,
    fulfillmentStatus: row.fulfillmentStatus as FulfillmentStatus,
    reconcileOutcome: row.reconcileOutcome as Outcome | null,
    resolutionStatus: row.resolutionStatus as ResolutionStatus,
    customerStatus: row.customerStatus as CustomerTransactionStatus,
    adminStatus: row.adminStatus as AdminTransactionStatus,
    simulated: row.simulated,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.demoScenarioName === null) {
    return base;
  }
  return { ...base, demoScenarioName: row.demoScenarioName };
}
