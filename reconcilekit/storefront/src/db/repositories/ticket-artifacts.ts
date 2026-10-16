import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  TicketArtifact,
  TicketKind,
  TicketStatus,
} from "../../marketplace/types.ts";

/**
 * Ticket artifact repository (kind: ticket_artifacts).
 *
 * Ids are deterministic (`tkt_<stableSuffix(transactionId)>`) — one ticket
 * per transaction. `ticketing.ts:239` re-inserts the same id on cancellation
 * (latest-wins update in the JSONL store), so insert is an upsert here.
 *
 * `getById` replaces the point read at ticketing.ts:165-168.
 * `listByTransaction` replaces the readAll+filter in client.ts:425,
 * reconcile.ts:100, and transactions.ts:2458 — the id is per-transaction,
 * so the array has at most one element. Ordered by id asc for determinism.
 *
 * No `simulated` column on this table: reconstructed as literal `true` in
 * fromPrisma (schema convention).
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class TicketArtifactRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: TicketArtifact): Promise<TicketArtifact> {
    await this.client.ticketArtifact.upsert({
      where: { id: record.id },
      create: toPrismaTicket(record),
      update: toPrismaTicket(record),
    });
    return record;
  }

  async getById(id: string): Promise<TicketArtifact | null> {
    const row = await this.client.ticketArtifact.findUnique({
      where: { id },
    });
    return row === null ? null : fromPrismaTicket(row);
  }

  async listByTransaction(
    transactionId: string,
  ): Promise<TicketArtifact[]> {
    const rows = await this.client.ticketArtifact.findMany({
      where: { transactionId },
      orderBy: { id: "asc" },
    });
    return rows.map(fromPrismaTicket);
  }
}

interface TicketArtifactRow {
  readonly id: string;
  readonly transactionId: string;
  readonly ticketKind: string;
  readonly reservationReference: string | null;
  readonly issueReference: string | null;
  readonly passengerOrAttendee: string;
  readonly routeOrVenue: string;
  readonly seat: string | null;
  readonly status: string;
  readonly maskedCode: string | null;
  readonly issuedAt: Date | null;
  readonly cancellationReference: string | null;
  readonly cancelledAt: Date | null;
}

function toPrismaTicket(
  record: TicketArtifact,
): Prisma.TicketArtifactUncheckedCreateInput {
  return {
    id: record.id,
    transactionId: record.transactionId,
    ticketKind: record.ticketKind,
    reservationReference: record.reservationReference,
    issueReference: record.issueReference,
    passengerOrAttendee: record.passengerOrAttendee,
    routeOrVenue: record.routeOrVenue,
    seat: record.seat,
    status: record.status,
    maskedCode: record.maskedCode,
    issuedAt: record.issuedAt === null ? null : new Date(record.issuedAt),
    cancellationReference: record.cancellationReference,
    cancelledAt:
      record.cancelledAt === null ? null : new Date(record.cancelledAt),
  };
}

function fromPrismaTicket(row: TicketArtifactRow): TicketArtifact {
  return {
    id: row.id,
    transactionId: row.transactionId,
    ticketKind: row.ticketKind as TicketKind,
    reservationReference: row.reservationReference,
    issueReference: row.issueReference,
    passengerOrAttendee: row.passengerOrAttendee,
    routeOrVenue: row.routeOrVenue,
    seat: row.seat,
    status: row.status as TicketStatus,
    maskedCode: row.maskedCode,
    issuedAt: row.issuedAt === null ? null : row.issuedAt.toISOString(),
    cancellationReference: row.cancellationReference,
    cancelledAt:
      row.cancelledAt === null ? null : row.cancelledAt.toISOString(),
    simulated: true,
  };
}