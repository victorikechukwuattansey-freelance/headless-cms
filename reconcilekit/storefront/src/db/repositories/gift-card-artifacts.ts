import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  GiftCardArtifact,
  GiftCardDeliveryStatus,
  GiftCardRedemptionStatus,
} from "../../marketplace/types.ts";

/**
 * Gift card artifact repository (kind: gift_card_artifacts).
 *
 * Ids are deterministic (`gift_<stableSuffix(transactionId)>`) — one gift
 * card record per transaction. No `getById` today: no point read of
 * gift_card_artifacts exists in the source (§7.3 — do not inflate with
 * test-only methods). If a caller needs one, add it then.
 *
 * `listByTransaction` replaces the readAll+filter in client.ts:428,
 * reconcile.ts:103, and transactions.ts:2461. Ordered by id asc.
 *
 * No `simulated` column: reconstructed as literal `true` in fromPrisma.
 * `riskFlags` is a `String[]` column; copied in on write so the caller's
 * array isn't aliased into Prisma's input value.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class GiftCardArtifactRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: GiftCardArtifact): Promise<GiftCardArtifact> {
    await this.client.giftCardArtifact.upsert({
      where: { id: record.id },
      create: toPrismaGiftCard(record),
      update: toPrismaGiftCard(record),
    });
    return record;
  }

  async listByTransaction(
    transactionId: string,
  ): Promise<GiftCardArtifact[]> {
    const rows = await this.client.giftCardArtifact.findMany({
      where: { transactionId },
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaGiftCard);
  }
}

interface GiftCardArtifactRow {
  readonly id: string;
  readonly transactionId: string;
  readonly brand: string;
  readonly region: string;
  readonly denominationMinor: number;
  readonly currency: string;
  readonly quantity: number;
  readonly deliveryStatus: string;
  readonly redemptionStatus: string;
  readonly maskedCodePreview: string | null;
  readonly riskFlags: string[];
}

function toPrismaGiftCard(
  record: GiftCardArtifact,
): Prisma.GiftCardArtifactUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    brand: record.brand,
    region: record.region,
    denominationMinor: record.denominationMinor,
    currency: record.currency,
    quantity: record.quantity,
    deliveryStatus: record.deliveryStatus,
    redemptionStatus: record.redemptionStatus,
    maskedCodePreview: record.maskedCodePreview,
    riskFlags: [...record.riskFlags],
  };
}

function fromPrismaGiftCard(
  row: GiftCardArtifactRow,
): GiftCardArtifact {
  return {
    id: row.id,
    transactionId: row.transactionId,
    brand: row.brand,
    region: row.region,
    denominationMinor: row.denominationMinor,
    currency: row.currency,
    quantity: row.quantity,
    deliveryStatus: row.deliveryStatus as GiftCardDeliveryStatus,
    redemptionStatus: row.redemptionStatus as GiftCardRedemptionStatus,
    maskedCodePreview: row.maskedCodePreview,
    riskFlags: row.riskFlags,
    simulated: true,
  };
}