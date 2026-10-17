import type { PrismaClient } from "@prisma/client";

/**
 * HTTP test fixtures seed marketplace data via the module-level PrismaClient,
 * outside any transaction, so their writes commit. That state is then visible
 * to subsequent `withRollback` tests in the same `npm test` process — wallet
 * balances, event counts, and `findByCustomer` results get polluted.
 *
 * Called at file scope via `after()` in each HTTP test file, this truncates
 * every committed table so the next file starts clean.
 *
 * Cascade follows FK edges:
 *   organizations → memberships, marketplace_customers
 *   marketplace_customers → wallets, marketplace_orders, marketplace_transactions, disputes, notifications
 *   wallets → wallet_ledger
 *   marketplace_orders → marketplace_transactions
 *   marketplace_transactions → provider_attempts, transaction_events,
 *     evidence_packs, receipts, refunds, reversals, manual_reviews,
 *     ticket_artifacts, gift_card_artifacts, marketplace_payments
 *   evidence_packs → receipts
 *   users → memberships, sessions
 *   payment_events → independent (no FK), truncated explicitly
 *
 * Catalog tables are intentionally omitted: nothing writes them to Postgres
 * yet (catalog remains in-memory + JSONL).
 */
export async function truncateCommittedState(
  prisma: PrismaClient,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    "TRUNCATE TABLE organizations, users, payment_events CASCADE",
  );
}
