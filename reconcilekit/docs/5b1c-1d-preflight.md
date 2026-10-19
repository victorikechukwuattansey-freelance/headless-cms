# 5B.1d Pre-Flight

Environment gate: `npm test` = **634/634**; `git status --short -- reconcilekit/` = **empty**.
HEAD at investigation time: `50f2c9b` (1k.2).

## Summary

**Recommendation B - small (2 files).** Inline migration is complete for every kind that
has a repository: the only repository-ready JSONL reads left in `test/` are two stale
`wallet_ledger` snapshots in `reconcile.test.ts` and `tenancy.test.ts`, and both currently
read an always-empty JSONL file, so their assertions are vacuous. Fix those two files;
everything else that remains is either 5B.1e-deferred (notifications, marketplace_catalog)
or the T7.8 JSONL contract.

## Part 1 - Remaining JSONL test surface

Commands run from `reconcilekit/storefront/`:

```powershell
Get-ChildItem test -Recurse -Filter *.ts | Select-String -Pattern 'new JsonlStore\(|const tempStore =|function tempStore\('
Get-ChildItem test -Recurse -Filter *.ts | Select-String -Pattern 'const store2? = tempStore\(t\)|storeA|storeB'
```

`new JsonlStore(...)` is constructed in 17 files. "Kind(s) used" means kinds actually
written or read through that store in the file; `JsonlStore` itself is kind-agnostic at
construction.

| file                                                 | line                        | kind(s) used                                                                         | consumer test                                                                      | still load-bearing?                                 |
| ---------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | --------------------------------------------------- |
| `test/store.test.ts`                                 | 13-16 (helper), 60 (direct) | `businesses`, `orders`, `products` (stub records)                                    | T7.8 JSONL contract                                                                | **Yes - contract** (out of scope)                   |
| `test/marketplace/store-kinds.test.ts`               | 17-20                       | `marketplace_transactions`, `payments`, `evidence_packs`                             | T7.8 JSONL contract                                                                | **Yes - contract** (out of scope)                   |
| `test/marketplace/persistence-concurrency.test.ts`   | 38                          | `TEST_KIND` (`persistence_concurrency_test`)                                         | T7.8 JSONL contract                                                                | **Yes - contract** (out of scope)                   |
| `test/marketplace/notifications.test.ts`             | 24-27                       | `notifications`                                                                      | direct `emitNotification` / `markNotificationRead` / `listNotificationsByCustomer` | **Yes - 5B.1e** (source still `JsonlStore`)         |
| `test/marketplace/catalog.test.ts`                   | 34-37                       | `catalog_categories`, `catalog_services`, `catalog_products`                         | `seedCatalogToStore` / `loadCatalogFromStore` round-trip                           | **Yes - 5B.1e** (source still `JsonlStore`)         |
| `test/marketplace/seeded-server.ts`                  | 56                          | `notifications` (read by dashboard / transaction detail / notifications view models) | `test/marketplace/server-marketplace.test.ts`                                      | **Yes - 5B.1e** (notifications read path)           |
| `test/marketplace/frontend-walkthrough.test.ts`      | 54                          | `notifications` (`transactionDetailViewModel`)                                       | walkthrough routes                                                                 | **Yes - 5B.1e**                                     |
| `test/marketplace/transaction-detail-states.test.ts` | 52                          | `notifications` (`transactionDetailViewModel`)                                       | detail-state routes                                                                | **Yes - 5B.1e**                                     |
| `test/auth/route-protection.test.ts`                 | 32                          | `notifications` (`dashboardViewModel`)                                               | `/` and `/dashboard` auth checks                                                   | **Yes - 5B.1e**                                     |
| `test/marketplace/reconcile.test.ts`                 | 42-45                       | `wallet_ledger` (`snapshotRows`)                                                     | reconcile "no money at risk" snapshots                                             | **Yes - but stale** (repo exists; recommendation B) |
| `test/marketplace/tenancy.test.ts`                   | 26-29                       | `wallet_ledger` (L165)                                                               | tenancy wallet-evidence invariant                                                  | **Yes - but stale** (repo exists; recommendation B) |
| `test/marketplace/demo-scenarios.test.ts`            | 39-42                       | none (store only passed to `seedDemoData`, whose `store` param is unused)            | demo scenario seeding                                                              | No - dead                                           |
| `test/marketplace/seed.test.ts`                      | 41-44                       | none (same dead `seedDemoData` param)                                                | seed idempotence                                                                   | No - dead                                           |
| `test/marketplace/findings.test.ts`                  | 46                          | none (findings view models are repos-only)                                           | `/findings*` routes                                                                | No - dead/structural                                |
| `test/reconcile-server.test.ts`                      | 71                          | none (`/reconcile` route does not read notifications)                                | server-level reconcile endpoint                                                    | No - structural `ServerDependencies` placeholder    |
| `test/server.test.ts`                                | 36                          | none (business/product/order/verify/callback routes only)                            | core HTTP tests                                                                    | No - structural                                     |
| `test/auth/login-flow.test.ts`                       | 32, 166                     | none (login/register/logout routes)                                                  | auth flow                                                                          | No - structural                                     |

Direct construction notes:

- `test/auth/login-flow.test.ts` constructs the store twice (L32, L166); both are only
  handed to `createStorefrontServer` as `deps.store`.
- `test/marketplace/findings.test.ts` also calls `seedDemoData(store, repos)` at L47, but
  the store is not used by the findings view models (`findingsSummaryViewModel`,
  `findingDeterminationViewModel`, `findingEvidenceViewModel` take `deps` only).
- `test/auth/route-protection.test.ts` calls `seedDemoData(store, repos)` at L33 and then
  serves `/` and `/dashboard`; those pages call `dashboardViewModel(store, ...)`, which
  reads `listNotificationsByCustomer(store, ...)`. The JSONL notifications file is empty
  (the seed no longer writes it), but the read path is still live.

## Part 2 - Shared HTTP harnesses

`test/marketplace/seeded-server.ts` (full file):

```ts
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../../src/config.ts";
import { getPrismaClient } from "../../src/db/client.ts";
import {
  buildRepositories,
  type Repositories,
} from "../../src/db/repositories/index.ts";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { createStorefrontServer } from "../../src/server.ts";
import { demoDeps } from "./demo-deps.ts";
import { executeMarketplaceTransaction } from "../../src/marketplace/transactions.ts";
import { reconcileMarketplaceTransaction } from "../../src/marketplace/reconcile.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import type { MarketplaceTransaction } from "../../src/marketplace/types.ts";
import { seedDemoData } from "../../src/marketplace/seed.ts";
import { loginAndGetCookie } from "../auth/helpers.ts";

export interface SeededServerContext {
  readonly baseUrl: string;
  readonly cookie: string;
  readonly close: () => Promise<void>;
  readonly store: JsonlStore;
  readonly transaction: MarketplaceTransaction;
  readonly reference: string;
}

async function createSeededTransaction(
  store: JsonlStore,
  repos: Repositories,
): Promise<MarketplaceTransaction> {
  const deps = demoDeps(repos);
  const NOW = WALLET_FIXED_TIMESTAMP;

  const result = await executeMarketplaceTransaction(deps, {
    customerId: "cus_demo",
    serviceId: "svc_airtime_mtn",
    scenario: "SUCCESS",
    inputs: { network: "MTN", recipient: "08030000000", amount: "1000" },
    now: NOW,
  });

  await reconcileMarketplaceTransaction(deps, {
    transactionId: result.transaction.id,
    now: NOW,
  });

  return result.transaction;
}

export async function startSeededServer(): Promise<SeededServerContext> {
  const dataDir = mkdtempSync(join(tmpdir(), "storefront-marketplace-"));
  const store = new JsonlStore(dataDir);
  const repos = buildRepositories(getPrismaClient());

  // seedDemoData seeds the demo user (Postgres) and the demo tenancy
  // (Postgres) in the correct FK order, then executes the marketplace
  // scenarios into JSONL.
  await seedDemoData(store, repos);

  const transaction = await createSeededTransaction(store, repos);

  const server: Server = createStorefrontServer(
    loadConfig({ STOREFRONT_DATA_DIR: dataDir }),
    {
      store,
      repos,
      paystack: {
        initializeTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
        verifyTransaction: async () => {
          throw new Error("Paystack not used in marketplace tests");
        },
      },
      marketplace: demoDeps(repos),
    },
  );

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const cookie = await loginAndGetCookie(baseUrl);

  return {
    baseUrl,
    cookie,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
    store,
    transaction,
    reference: transaction.reference,
  };
}
```

Actual callers (correcting the task's assumption):

- `startSeededServer` is called only by `test/marketplace/server-marketplace.test.ts`
  (22 call sites). `findings.test.ts`, `frontend-walkthrough.test.ts`, and
  `transaction-detail-states.test.ts` construct their own local server with the same
  pattern; they do **not** import this harness.
- No caller reads `app.store`; `SeededServerContext.store` is unused externally.

What it constructs and why the store survives:

- `new JsonlStore(dataDir)` + `buildRepositories(getPrismaClient())`.
- `seedDemoData(store, repos)` - the `store` argument is currently unused inside
  `seedDemoData` (see Part 5).
- `createSeededTransaction(store, repos)` - the `store` parameter is also unused; the
  body creates `demoDeps(repos)`.
- `createStorefrontServer(..., { store, repos, ... })` - the server passes `store` to
  `dashboardViewModel`, `transactionDetailViewModel`, and `notificationsViewModel`, all
  of which call `listNotificationsByCustomer(store, ...)`.
- **JsonlStore still needed?** Yes, but only as the notifications read dependency for
  those view models. It carries no seeded data because `seedDemoData` no longer writes
  notifications. Once notifications moves to its repository (5B.1e), the store can be
  dropped from this harness entirely.
- Other shared export: `test/auth/helpers.ts` (`loginAndGetCookie`). There is no other
  exported `startServer`; each remaining file defines a local one.

## Part 3 - `demo-deps.ts` and `test/db/fixtures.ts`

`test/marketplace/demo-deps.ts` (full file):

```ts
import type { Repositories } from "../../src/db/repositories/index.ts";
import { buildDemoCatalog } from "../../src/marketplace/catalog.ts";
import { createMockProviderRegistry } from "../../src/marketplace/providers/registry.ts";
import type { MarketplaceTransactionDeps } from "../../src/marketplace/transactions.ts";

export function demoDeps(repos: Repositories): MarketplaceTransactionDeps {
  return {
    repos,
    registry: createMockProviderRegistry(),
    catalog: buildDemoCatalog(),
  };
}
```

Confirmed: `demoDeps` is **repos-only**; it no longer accepts or forwards a store.

`test/db/fixtures.ts` (full file):

```ts
import { Prisma } from "@prisma/client";

/**
 * Minimal FK-chain seeders for repository tests.
 *
 * These exist because the wallet / ledger / event tables all carry FKs
 * up through marketplace_transactions -> marketplace_orders ->
 * marketplace_customers -> organizations. They seed via raw Prisma,
 * NOT via the repository bundle, so a batch that does not yet include
 * the upstream repos (marketplaceCustomers, marketplaceOrders,
 * marketplaceTransactions) can still exercise the downstream ones.
 *
 * When those upstream repos land, later batches may swap these for
 * repo calls - but keeping raw Prisma here is a feature, not a
 * deficiency: fixtures are outside the code under test.
 *
 * Every seeder is idempotent (upsert). Tests that seed more than one
 * transaction inside a single rollback - e.g. the isolation test in
 * transaction-events.test.ts - depend on this: the two contexts share
 * org / customer / order and only the transaction id differs.
 */

const FIXED = new Date("2026-01-01T00:00:00.000Z");

export async function seedOrg(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<void> {
  await tx.organization.upsert({
    where: { id },
    create: { id, name: `Org ${id}`, createdAt: FIXED },
    update: {},
  });
}

export async function seedCustomer(
  tx: Prisma.TransactionClient,
  input: { readonly id: string; readonly orgId: string },
): Promise<void> {
  await tx.marketplaceCustomer.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      orgId: input.orgId,
      name: `Customer ${input.id}`,
      email: `${input.id}@example.com`,
      phone: null,
      isDemo: true,
      createdAt: FIXED,
    },
    update: {},
  });
}

export async function seedOrder(
  tx: Prisma.TransactionClient,
  input: { readonly id: string; readonly customerId: string },
): Promise<void> {
  await tx.marketplaceOrder.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      customerId: input.customerId,
      serviceId: "svc_airtime",
      inputs: {},
      quotedAmountMinor: 12500,
      currency: "NGN",
      customerReference: `ref_${input.id}`,
      status: "CREATED",
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}

export async function seedTransaction(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly orderId: string;
    readonly customerId: string;
    readonly reference: string;
  },
): Promise<void> {
  await tx.marketplaceTransaction.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      orderId: input.orderId,
      customerId: input.customerId,
      reference: input.reference,
      serviceId: "svc_airtime",
      providerId: "prv_mock",
      scenario: "SUCCESS",
      paymentStatus: "SUCCESS",
      fulfillmentStatus: "FULFILLED",
      reconcileOutcome: "MATCH",
      resolutionStatus: "NONE",
      customerStatus: "HEALTHY",
      adminStatus: "HEALTHY",
      demoScenarioName: null,
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}

export async function seedEvidencePack(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly transactionId: string;
    readonly customerReference: string;
    readonly amountMinor: number;
    readonly currency: string;
  },
): Promise<void> {
  await tx.evidencePack.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      transactionId: input.transactionId,
      customerReference: input.customerReference,
      providerReference: null,
      paymentReference: null,
      serviceSnapshot: {},
      amountMinor: input.amountMinor,
      currency: input.currency,
      timelineEventIds: [],
      providerFacts: {},
      reconciliation: Prisma.DbNull,
      mismatchFlags: [],
      resolutionStatus: "NONE",
      auditEventIds: [],
      createdAt: FIXED,
    },
    update: {},
  });
}

export async function seedUser(
  tx: Prisma.TransactionClient,
  input: {
    readonly id: string;
    readonly email?: string;
    readonly displayName?: string;
  },
): Promise<void> {
  await tx.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email ?? `${input.id}@example.com`,
      passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$seed",
      displayName: input.displayName ?? `User ${input.id}`,
      createdAt: FIXED,
      updatedAt: FIXED,
    },
    update: {},
  });
}

export async function seedDemoCustomer(
  tx: Prisma.TransactionClient,
  customerId: string = "cus_demo",
): Promise<void> {
  await seedOrg(tx, "org_test");
  await seedCustomer(tx, { id: customerId, orgId: "org_test" });
}
```

Findings:

- All fixture helpers take a `Prisma.TransactionClient` and seed via raw Prisma with
  idempotent upserts. No fixture accepts a `store`.
- `seedDemoCustomer(tx, customerId = "cus_demo")` is used by the direct-execution test
  files added in 1e (evidence, gift-card, input-validation, payment-provider, reconcile,
  resolution, seed, ticketing, wallet-lifecycle, wallet) and by `transactions.test.ts`.
  `transactions.test.ts:79` defines a local `seedDemoCustomer` that shadows the fixture;
  that duplication is out of scope here.
- `seedDemoCustomer` is also called inside `reconcile.test.ts:33` and
  `seed.test.ts:201` (with `DEMO_WALLET_FUNDING_CUSTOMER_ID`).

## Part 4 - Per-file tempStore inventory

| file                                                 | tempStore count                    | kind(s) used                                                 | migratable to repos today?                                    |
| ---------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- |
| `test/store.test.ts`                                 | 6 (plus 1 direct `new JsonlStore`) | `businesses`, `orders`, `products` (stubs)                   | No - T7.8 contract                                            |
| `test/marketplace/catalog.test.ts`                   | 1                                  | `catalog_categories`, `catalog_services`, `catalog_products` | No - source still `JsonlStore`; 5B.1e                         |
| `test/marketplace/demo-scenarios.test.ts`            | 1                                  | none (dead `seedDemoData` arg)                               | No - removal needs `seedDemoData` signature change            |
| `test/marketplace/notifications.test.ts`             | 3                                  | `notifications`                                              | No - source still `JsonlStore`; 5B.1e                         |
| `test/marketplace/reconcile.test.ts`                 | 9                                  | `wallet_ledger` (stale snapshot read)                        | **Yes** - `WalletLedgerRepository` exists (recommendation B)  |
| `test/marketplace/seed.test.ts`                      | 4                                  | none (dead `seedDemoData` arg)                               | No - removal needs `seedDemoData` signature change            |
| `test/marketplace/store-kinds.test.ts`               | 3                                  | `marketplace_transactions`, `payments`, `evidence_packs`     | No - T7.8 contract                                            |
| `test/marketplace/tenancy.test.ts`                   | 10                                 | `wallet_ledger` (stale L165 read); rest dead                 | **Yes, partial** - migrate the wallet read (recommendation B) |
| `test/reconcile-server.test.ts`                      | 0 (1 direct)                       | none                                                         | No - structural `ServerDependencies.store`                    |
| `test/server.test.ts`                                | 0 (1 direct)                       | none                                                         | No - structural                                               |
| `test/auth/login-flow.test.ts`                       | 0 (2 direct)                       | none                                                         | No - structural                                               |
| `test/auth/route-protection.test.ts`                 | 0 (1 direct)                       | `notifications` (dashboard read)                             | No - 5B.1e                                                    |
| `test/marketplace/findings.test.ts`                  | 0 (1 direct)                       | none                                                         | No - dead/structural                                          |
| `test/marketplace/frontend-walkthrough.test.ts`      | 0 (1 direct)                       | `notifications` (detail read)                                | No - 5B.1e                                                    |
| `test/marketplace/seeded-server.ts`                  | 0 (1 direct)                       | `notifications` (dashboard/detail/notifications)             | No - 5B.1e                                                    |
| `test/marketplace/transaction-detail-states.test.ts` | 0 (1 direct)                       | `notifications` (detail read)                                | No - 5B.1e                                                    |

Definition applied: a file is migratable when every kind it uses has a repository
equivalent and no JSONL-contract assertion depends on the store. Only the two stale
`wallet_ledger` readers meet that bar.

## Part 5 - Inline migration completeness

### 5a. `demoDeps(store, ...)` sweep

```powershell
Get-ChildItem test -Recurse -Filter *.ts | Select-String -Pattern 'demoDeps\(store,|demoDeps\(store\)'
```

**No hits.** `demoDeps` is repos-only everywhere (`demoDeps(repos)`). Inline migration is
complete on this axis.

### 5b. `seedDemoData` signature

Actual signature (`src/marketplace/seed.ts:300`):

```ts
export async function seedDemoData(
  store: JsonlStore,
  repos: Repositories,
): Promise<SeededDemoData> {
```

Finding: **`store` is unused in the body.** `\bstore\b` appears only at the type import
(L1), the doc comment (L77/L298), and the parameter (L301). The body seeds Postgres via
`repos` and builds the catalog in memory. The comment above the call sites ("then executes
the marketplace scenarios into JSONL") is stale. The parameter is kept alive only by the
signature; every test still passes a store to it.

### 5c. Direct `store.insert` / `store.readAll` / `store.readLatestById` calls in `test/`

| hit                                                                      | category                                                                                              |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `test/store.test.ts:22, 36-38, 46, 71-72, 80`                            | T7.8 JSONL contract (`businesses`, `orders`, `products`)                                              |
| `test/marketplace/persistence-concurrency.test.ts:115-116, 132-134, 151` | T7.8 JSONL contract (`TEST_KIND`)                                                                     |
| `test/marketplace/store-kinds.test.ts:44, 62, 108`                       | T7.8 JSONL contract (`marketplace_transactions`, `payments`, `evidence_packs`)                        |
| `test/marketplace/reconcile.test.ts:71`                                  | Repositories-ready **but stale**: `readAll("wallet_ledger")`; source no longer writes this JSONL kind |
| `test/marketplace/tenancy.test.ts:165`                                   | Repositories-ready **but stale**: `readAll("wallet_ledger")`; loops over an empty array               |

No direct notifications or catalog store calls exist in `test/`; those paths go through
`emitNotification` / `listNotificationsByCustomer` and `seedCatalogToStore` /
`loadCatalogFromStore`, which are 5B.1e-deferred. There are **zero** 5B.1e-deferred direct
hits, and no repository-ready hits beyond the two `wallet_ledger` reads.

Correctness note: because `src/` no longer writes `wallet_ledger` to JSONL, both stale
reads return `[]`:

- `reconcile.test.ts` `snapshotRows` compares the ledger before/after reconcile, but the
  ledger component is always `[]`, so a ledger mutation would not fail the snapshot.
  (`payments` and `providerAttempts` are still read from Postgres and remain meaningful.)
- `tenancy.test.ts:165` loops over `[]`, so the "no org dimension on wallet evidence"
  assertion cannot fail.

## Part 6 - Recommendation

**B - small (2 files), test-only.**

1. `test/marketplace/reconcile.test.ts`
   - Replace `snapshotRows(store, repos)` with a Postgres read. Simplest correct form:
     `snapshotRows(repos, transactionId)` using
     `repos.walletLedger.listByTransaction(transactionId)`, or a raw
     `prisma.walletLedgerEntry.findMany({ where: { transactionId }, orderBy: [...] })`.
   - All four call sites already have `executed.transaction.id` / the relevant
     transaction id in scope.
   - Delete the `tempStore` helper and the 9 now-dead `tempStore(t)` calls.
   - This restores the "no money at risk" guard: the ledger is currently invisible to it.

2. `test/marketplace/tenancy.test.ts`
   - Replace the L165 `store.readAll("wallet_ledger")` with
     `tx.walletLedgerEntry.findMany()` inside the existing `withRollback(prisma, ...)`.
   - Assert the persisted row shape carries no org dimension (`orgId` / `org_id`).
   - Keep the `store` argument for `seedDemoData` until its dead parameter is removed.

Why not A: two assertions are silently vacuous, which is a correctness hole rather than
dead code. Why not C: every other remaining JSONL use is 5B.1e-deferred (notifications,
marketplace_catalog) or the T7.8 contract; the inline migration itself is complete.

Estimated diff: roughly 30-50 lines across two files, no schema change and no production
source change (a `WalletLedgerRepository.list()` is not required if snapshots are
transaction-scoped).

## Open questions requiring owner ruling

1. **Dead `seedDemoData` store parameter.** Remove it now (1 source file plus 7-8 test
   call sites, which would also let `demo-scenarios.test.ts` and `seed.test.ts` drop their
   dead stores), or fold it into 5B.1e? It is not required for 5B.1d.
2. **Snapshot scope.** For the reconcile guard, is transaction-scoped ledger
   (`listByTransaction`) equivalent to the old all-rows snapshot, or should
   `WalletLedgerRepository` gain a `list()` so the guard spans every row?
3. **Tenancy assertion key.** The old JSONL assertion checked `"org_id"`. The Prisma row
   field is `orgId` (and the table has no org column). Should the migrated assertion check
   absence of `orgId`, absence of both, or inspect the actual column set?
4. **`createSeededTransaction(store, repos)`.** Its `store` parameter is unused; drop it
   in the same cleanup as the `seedDemoData` parameter?

T7.8 files (`test/marketplace/store-kinds.test.ts`,
`test/marketplace/persistence-concurrency.test.ts`) were read only and left untouched.
