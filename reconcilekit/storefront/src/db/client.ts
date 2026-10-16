import { PrismaClient } from "@prisma/client";

/**
 * Process-wide PrismaClient singleton.
 *
 * PrismaClient owns a connection pool. Constructing more than one per
 * process creates more pools than the database wants. Every consumer
 * (production code, tests, scripts) obtains the client through this
 * module and only this module.
 *
 * The raw client is used by:
 *   - main.ts (disconnect on shutdown)
 *   - db/smoke.ts
 *   - test/db/helpers.ts (the outer transaction)
 *
 * Repository methods receive the client (or a transaction client) from
 * the caller — they never call getPrismaClient() themselves.
 */

let instance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (instance === null) {
    instance = new PrismaClient();
  }
  return instance;
}

export async function disconnectPrisma(): Promise<void> {
  if (instance !== null) {
    await instance.$disconnect();
    instance = null;
  }
}