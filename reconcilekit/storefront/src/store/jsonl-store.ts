import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type StoreKind =
  | "businesses"
  | "products"
  | "orders"
  | "payments"
  | "marketplace_customers"
  | "marketplace_catalog"
  | "catalog_categories"
  | "catalog_services"
  | "catalog_products"
  | "marketplace_orders"
  | "marketplace_transactions"
  | "marketplace_provider_attempts"
  | "wallets"
  | "wallet_ledger"
  | "transaction_events"
  | "evidence_packs"
  | "receipts"
  | "refunds"
  | "reversals"
  | "disputes"
  | "manual_reviews"
  | "notifications"
  | "ticket_artifacts"
  | "gift_card_artifacts"
  | "payment_events";

const KIND_FILE_NAMES: Readonly<Record<StoreKind, string>> = {
  businesses: "businesses.jsonl",
  products: "products.jsonl",
  orders: "orders.jsonl",
  payments: "payments.jsonl",
  marketplace_customers: "marketplace-customers.jsonl",
  marketplace_catalog: "marketplace-catalog.jsonl",
  catalog_categories: "catalog-categories.jsonl",
  catalog_services: "catalog-services.jsonl",
  catalog_products: "catalog-products.jsonl",
  marketplace_orders: "marketplace-orders.jsonl",
  marketplace_transactions: "marketplace-transactions.jsonl",
  marketplace_provider_attempts: "marketplace-provider-attempts.jsonl",
  wallets: "wallets.jsonl",
  wallet_ledger: "wallet-ledger.jsonl",
  transaction_events: "transaction-events.jsonl",
  evidence_packs: "evidence-packs.jsonl",
  receipts: "receipts.jsonl",
  refunds: "refunds.jsonl",
  reversals: "reversals.jsonl",
  disputes: "disputes.jsonl",
  manual_reviews: "manual-reviews.jsonl",
  notifications: "notifications.jsonl",
  ticket_artifacts: "ticket-artifacts.jsonl",
  gift_card_artifacts: "gift-card-artifacts.jsonl",
  payment_events: "payment-events.jsonl",
};

interface Identified {
  readonly id: string;
}

export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StoreError";
  }
}

/**
 * Append-only JSONL store. Every record is written as one JSON line.
 * Reads return the latest record per id, so later updates (verification,
 * webhook status changes) append a new line and the newest wins.
 * Unparseable lines are skipped, never fatal: one bad line must not
 * destroy the rest of the file.
 */
export class JsonlStore {
  readonly dataDir: string;
  private writeChain: Promise<void> = Promise.resolve();
  private prepared: Promise<void> | null = null;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  private prepare(): Promise<void> {
    if (this.prepared === null) {
      this.prepared = mkdir(this.dataDir, { recursive: true }).then(
        () => undefined,
        (error: unknown) => {
          this.prepared = null;
          throw new StoreError(
            `cannot create data directory ${JSON.stringify(this.dataDir)}`,
            { cause: error },
          );
        },
      );
    }
    return this.prepared;
  }

  private filePath(kind: StoreKind): string {
    return join(this.dataDir, KIND_FILE_NAMES[kind]);
  }

  async insert<T extends Identified>(kind: StoreKind, record: T): Promise<T> {
    await this.prepare();
    const line = `${JSON.stringify(record)}\n`;
    await this.enqueue(() =>
      appendFile(this.filePath(kind), line, "utf8").catch((error) => {
        throw new StoreError(
          `cannot append ${kind} record ${JSON.stringify(record.id)}`,
          { cause: error },
        );
      }),
    );
    return record;
  }

  async readAll<T>(kind: StoreKind): Promise<readonly T[]> {
    await this.prepare();
    return this.enqueue(async () => {
      const lines = await this.readLines(kind);
      return lines
        .map((line) => parseLine<T>(line, kind))
        .filter((record): record is T => record !== null);
    });
  }

  async readLatestById<T extends Identified>(
    kind: StoreKind,
    id: string,
  ): Promise<T | null> {
    await this.prepare();
    return this.enqueue(async () => {
      const lines = await this.readLines(kind);
      let latest: T | null = null;
      for (const line of lines) {
        const record = parseLine<T>(line, kind);
        if (record !== null && record.id === id) {
          latest = record;
        }
      }
      return latest;
    });
  }

  private async readLines(kind: StoreKind): Promise<readonly string[]> {
    let text: string;
    try {
      text = await readFile(this.filePath(kind), "utf8");
    } catch (error) {
      if (isMissingFile(error)) {
        return [];
      }
      throw new StoreError(
        `cannot read ${kind} store file ${JSON.stringify(this.filePath(kind))}`,
        { cause: error },
      );
    }
    return text.split(/\r?\n/).filter((line) => line.trim() !== "");
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.writeChain.then(operation);
    this.writeChain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

function parseLine<T>(line: string, kind: StoreKind): T | null {
  try {
    return JSON.parse(line) as T;
  } catch {
    // Skip corrupt lines: never let one bad line break the store.
    return null;
  }
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "ENOENT"
  );
}
