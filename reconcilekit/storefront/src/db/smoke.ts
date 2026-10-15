/**
 * Phase 5B.1a smoke test.
 *
 * Verifies that the Prisma client can connect to the configured Postgres
 * database and that every table declared in schema.prisma exists. Does not
 * write data. Safe to run repeatedly.
 *
 * Usage:
 *   npx prisma migrate deploy        # apply migrations
 *   node src/db/smoke.ts             # this script
 *
 * Exit codes:
 *   0 — connection succeeded, all tables present
 *   1 — connection failed or a table is missing
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXPECTED_TABLES = [
  "users",
  "sessions",
  "organizations",
  "memberships",
  "marketplace_customers",
  "marketplace_orders",
  "marketplace_transactions",
  "marketplace_provider_attempts",
  "wallets",
  "wallet_ledger",
  "evidence_packs",
  "transaction_events",
  "receipts",
  "refunds",
  "reversals",
  "disputes",
  "manual_reviews",
  "ticket_artifacts",
  "gift_card_artifacts",
  "notifications",
  "payment_events",
  "catalog_categories",
  "catalog_services",
  "catalog_products",
  "businesses",
  "products",
  "orders",
  "payments",
];

async function main(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    const present = new Set(rows.map((r) => r.table_name));

    const missing = EXPECTED_TABLES.filter((t) => !present.has(t));
    if (missing.length > 0) {
      console.error(`smoke: ${missing.length} expected tables missing:`);
      for (const t of missing) console.error(`  - ${t}`);
      return 1;
    }

    console.log(`smoke: connected; ${EXPECTED_TABLES.length} tables present`);
    return 0;
  } catch (error) {
    console.error("smoke: connection or query failed");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    await prisma.$disconnect();
  }
}

const code = await main();
process.exitCode = code;