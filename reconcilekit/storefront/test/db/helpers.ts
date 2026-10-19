import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * Rollback-signalled transaction wrapper for repository tests.
 *
 * Every repository test runs inside a Postgres transaction that is
 * never committed. Prisma's interactive $transaction rolls back when
 * the callback throws, so we throw a sentinel carrying the result.
 *
 * Usage:
 *   await withRollback(prisma, async (tx) => {
 *     const repos = buildRepositories(tx);
 *     // assertions...
 *   });
 */

class RollbackSignal extends Error {
  constructor() {
    super("rollback");
    this.name = "RollbackSignal";
  }
}

export async function withRollback<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  let value: T | undefined;
  try {
    await prisma.$transaction(
      async (tx) => {
        value = await fn(tx);
        throw new RollbackSignal();
      },
      { timeout: 30_000 },
    );
    // $transaction should never return normally; the callback always
    // throws. If we reach here, something is wrong with the helper.
    throw new Error(
      "withRollback: $transaction returned without a rollback signal",
    );
  } catch (error) {
    if (error instanceof RollbackSignal) {
      return value as T;
    }
    throw error;
  }
}
