import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  TransactionEvent,
  TransactionEventActor,
  TransactionEventSource,
} from "../../marketplace/types.ts";

/**
 * Transaction event repository (kind: transaction_events).
 *
 * Append-many kind. listByTransaction mirrors timeline.ts's
 * listTransactionEvents sort exactly: (occurredAt asc, id asc).
 *
 * Postgres collation caveat: the schema's id column uses the database's
 * default collation. For the storefront's fixed-format ids
 * (evt_<txn>_<seq>) that collation orders the same as JS .localeCompare,
 * so the read matches the JSONL version. If the id format ever gains
 * non-ASCII or case-mixed segments, this must be revisited.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class TransactionEventRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: TransactionEvent): Promise<TransactionEvent> {
    await this.client.transactionEvent.upsert({
      where: { id: record.id },
      create: toPrismaEvent(record),
      update: toPrismaEvent(record),
    });
    return record;
  }

  async listByTransaction(transactionId: string): Promise<TransactionEvent[]> {
    const rows = await this.client.transactionEvent.findMany({
      where: { transactionId },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaEvent);
  }

  async list(): Promise<TransactionEvent[]> {
    const rows = await this.client.transactionEvent.findMany({
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });
    return rows.map(fromPrismaEvent);
  }
}

interface TransactionEventRow {
  readonly id: string;
  readonly transactionId: string;
  readonly type: string;
  readonly label: string;
  readonly description: string;
  readonly occurredAt: Date;
  readonly actor: string;
  readonly source: string;
  readonly metadata: Prisma.JsonValue;
}

function toPrismaEvent(
  record: TransactionEvent,
): Prisma.TransactionEventUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    type: record.type,
    label: record.label,
    description: record.description,
    occurredAt: new Date(record.occurredAt),
    actor: record.actor,
    source: record.source,
    metadata: record.metadata,
  };
}

function fromPrismaEvent(row: TransactionEventRow): TransactionEvent {
  return {
    id: row.id,
    transactionId: row.transactionId,
    type: row.type as TransactionEvent["type"],
    label: row.label,
    description: row.description,
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor as TransactionEventActor,
    source: row.source as TransactionEventSource,
    metadata: row.metadata as TransactionEvent["metadata"],
    simulated: true,
  };
}
