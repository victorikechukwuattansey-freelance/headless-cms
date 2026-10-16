import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  MarketplaceWallet,
  WalletStatus,
} from "../../marketplace/types.ts";

/**
 * Wallet repository (kind: wallets).
 *
 * Method names mirror the JSONL read surface: readLatestById,
 * findByCustomer. insert() is Prisma upsert so the JSONL "latest write for
 * an id wins" semantics are preserved — createWallet's re-insert of the
 * same id is a no-op overwrite, never a throw.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class WalletRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: MarketplaceWallet): Promise<MarketplaceWallet> {
    await this.client.wallet.upsert({
      where: { id: record.id },
      create: toPrismaWallet(record),
      update: toPrismaWallet(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<MarketplaceWallet | null> {
    const row = await this.client.wallet.findUnique({ where: { id } });
    return row === null ? null : fromPrismaWallet(row);
  }

  async findByCustomer(customerId: string): Promise<MarketplaceWallet | null> {
    const row = await this.client.wallet.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return row === null ? null : fromPrismaWallet(row);
  }
}

interface WalletRow {
  readonly id: string;
  readonly customerId: string;
  readonly currency: string;
  readonly openingBalanceMinor: number;
  readonly status: string;
  readonly createdAt: Date;
}

function toPrismaWallet(
  record: MarketplaceWallet,
): Prisma.WalletUncheckedCreateInput {
  return {
    id: record.id,
    customerId: record.customerId,
    currency: record.currency,
    openingBalanceMinor: record.openingBalanceMinor,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaWallet(row: WalletRow): MarketplaceWallet {
  return {
    id: row.id,
    customerId: row.customerId,
    currency: row.currency,
    openingBalanceMinor: row.openingBalanceMinor,
    status: row.status as WalletStatus,
    simulated: true,
    createdAt: row.createdAt.toISOString(),
  };
}
