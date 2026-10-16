import type { Prisma, PrismaClient } from "@prisma/client";
import type { UserRecord } from "../../marketplace/types.ts";

/**
 * User repository.
 *
 * All methods accept the process-wide PrismaClient or a
 * Prisma.TransactionClient — see buildRepositories in ./index.ts.
 * Repositories never open their own $transaction; callers that need
 * atomicity construct a bundle over an injected tx.
 *
 * The insert method translates to Prisma upsert, preserving the JSONL
 * store's "latest write for an id wins" semantics.
 */

export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class UserRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: UserRecord): Promise<UserRecord> {
    await this.client.user.upsert({
      where: { id: record.id },
      create: toPrismaUser(record),
      update: toPrismaUser(record),
    });
    return record;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await this.client.user.findUnique({ where: { id } });
    return row === null ? null : fromPrismaUser(row);
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const row = await this.client.user.findUnique({
      where: { email: normalized },
    });
    return row === null ? null : fromPrismaUser(row);
  }
}

interface UserRow {
  readonly id: string;
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

function toPrismaUser(record: UserRecord): {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
} {
  return {
    id: record.id,
    email: record.email,
    passwordHash: record.password_hash,
    displayName: record.display_name,
    createdAt: new Date(record.created_at),
    updatedAt: new Date(record.updated_at),
  };
}

function fromPrismaUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    password_hash: row.passwordHash,
    display_name: row.displayName,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    simulated: true,
  };
}
