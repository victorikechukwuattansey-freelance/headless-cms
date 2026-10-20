# 5B.1e Pre-Flight

Read-only decomposition for the phase-closing increment. HEAD: `1ca4df5`.

## Environment Gate

| Check                                                        | Result             |
| ------------------------------------------------------------ | ------------------ |
| `Get-ChildItem Env: \| Where-Object Name -like '*DATABASE*'` | Empty (T7.16)      |
| `npm test` from `reconcilekit/storefront`                    | **634 / 634 pass** |
| `git status --short -- reconcilekit/`                        | Empty              |

Gate passed before investigation. No code, test, schema, or commit changes were made in this pre-flight.

## Summary

### Key findings

- There are **54 `JsonlStore` references** across **5 source files** and **13 test files**. The full inventory is in Part 1.
- Notifications are the only remaining **live production read path** on `JsonlStore`. The write helpers (`emitNotification`, `markNotificationRead`) have **zero production callers**; only `notifications.test.ts` calls them. The three live consumers are `dashboardViewModel`, `transactionDetailViewModel`, and `notificationsViewModel`.
- `NotificationRepository` already covers every repository shape needed by the three helpers: insert/upsert, read by id, and list by customer. There is no method gap. The ownership guard in `markNotificationRead` stays in the helper.
- The three catalog repositories (`catalogCategories`, `catalogServices`, `catalogProducts`) have **zero production callers** and are test-only. `seedCatalogToStore` / `loadCatalogFromStore` are also test-only. `marketplace_catalog` is JSONL-only, with no Prisma model or repository.
- **The legacy `payments` repository is alive, not test-only.** It is written by `POST /orders` and order verification, and read by reconciliation and merchant CSV. The `payments` JSONL _kind_ is dead; the Postgres `payments` _repo_ is not. Part 8 documents the split.
- The `ServerDependencies` type (the requested “Deps”) has `readonly store: JsonlStore` at `src/server.ts:107`, and `deps.store` is value-accessed only at `src/server.ts:172`.
- `StoreKind` currently has **29 members**. After 5B.1e it should have **zero**.
- The task names T7.8’s two tests. A third JSONL unit file, `test/store.test.ts`, also directly tests the class and must retire with it. Catalog repository tests also disappear if the catalog repos are dropped. This changes the test trajectory from the example in the brief.

### Recommended decomposition

| Increment   | Scope                                                                                                                                                                         | Tests after   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| **5B.1e.1** | Notifications migration: helpers to repositories, three ViewModels, server threading, notification tests                                                                      | **634**       |
| **5B.1e.2** | Catalog drop: three repos, their 12 repo tests, `seedCatalogToStore` / `loadCatalogFromStore`, one catalog persistence test                                                   | **621** (−13) |
| **5B.1e.3** | Delete the JSONL layer: retire T7.8 (8 tests) and `store.test.ts` (7 tests), trim `StoreKind`, delete `JsonlStore`, remove `ServerDependencies.store` and all store threading | **606** (−15) |
| **5B.1e.4** | Docs and closure: payments split, phase summary                                                                                                                               | **606**       |

Ordering: **e.1 and e.2 may proceed independently; e.3 must follow both; e.4 is last.**

This deviates from the example trajectory because the evidence requires test removal in e.2 and an additional 7 tests in e.3. Those are owner-ruling questions at the end.

---

## Part 1 — JsonlStore reference inventory

Scope: `src/**/*.ts` and `test/**/*.ts` under `reconcilekit/storefront`. Imports, type annotations, constructors, and store-bound method calls are included. Repository `readLatestById` methods are Postgres-backed and are **not** JSONL references; the raw command also matches dozens of those and they are excluded.

### 1A — `JsonlStore` type/import/constructor references (54)

| Site                             | file:line                                                     | Live use?                                                | Blocked by                                                                 |
| -------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Class declaration                | `src/store/jsonl-store.ts:85`                                 | Yes — defines every JSONL kind and operation             | e.1 (notifications), e.2 (catalog), e.3 (remaining kinds + delete class)   |
| Production construction          | `src/main.ts:5,39`                                            | Yes — creates the served store                           | e.1 for notification consumers; e.3 for `ServerDependencies.store` removal |
| Server dependency + threading    | `src/server.ts:11,107,616,664`                                | Yes — type, field, and two function parameters           | e.1 for notification consumers; e.3 for store removal                      |
| ViewModel parameters             | `src/ui/client.ts:2,511,618,803`                              | Yes — three live view models                             | e.1 (notifications)                                                        |
| Notification helper parameters   | `src/marketplace/notifications.ts:1,70,93,112`                | Yes — the only live JSONL domain helper                  | e.1                                                                        |
| Route-protection test            | `test/auth/route-protection.test.ts:10,24,32`                 | Test-only; server construction + dashboard read          | e.1 + e.3                                                                  |
| Login-flow test                  | `test/auth/login-flow.test.ts:10,24,32,166`                   | Test-only; legacy server construction, including restart | e.3 (`store` removal only)                                                 |
| Transaction-detail states test   | `test/marketplace/transaction-detail-states.test.ts:11,43,52` | Test-only; detail view model read                        | e.1 + e.3                                                                  |
| JSONL unit test                  | `test/store.test.ts:6,13,16,60`                               | Test-only; direct class coverage                         | e.3 — delete with class                                                    |
| Legacy server test               | `test/server.test.ts:12,27,36`                                | Test-only; server construction                           | e.3                                                                        |
| Reconcile server test            | `test/reconcile-server.test.ts:12,71`                         | Test-only; server construction                           | e.3                                                                        |
| Notification helper test         | `test/marketplace/notifications.test.ts:6,24,27`              | Test-only; helpers under migration                       | e.1 — rewrite to repositories                                              |
| Catalog persistence test         | `test/marketplace/catalog.test.ts:6,34,37`                    | Test-only; one round-trip test                           | e.2 — remove helper + persistence test, keep in-memory catalog tests       |
| Frontend walkthrough             | `test/marketplace/frontend-walkthrough.test.ts:11,45,54`      | Test-only; dashboard/detail reads                        | e.1 + e.3                                                                  |
| Findings routes                  | `test/marketplace/findings.test.ts:11,37,46`                  | Test-only; server construction                           | e.1 + e.3                                                                  |
| Seeded server helper             | `test/marketplace/seeded-server.ts:12,26,55`                  | Test-only; shared server harness                         | e.1 + e.3                                                                  |
| Persistence/concurrency contract | `test/marketplace/persistence-concurrency.test.ts:12,38`      | Test-only; class contract                                | e.3 — delete                                                               |
| Store-kinds contract             | `test/marketplace/store-kinds.test.ts:6,17,20`                | Test-only; class contract                                | e.3 — delete                                                               |

Count check: 15 source references + 39 test references = **54**.

### 1B — Store-bound operations and reads

| Operation                               | file:line                                                                          | Live use?                         | Blocked by   |
| --------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------- | ------------ |
| `store.insert("notifications")`         | `src/marketplace/notifications.ts:84`                                              | Live helper; no production caller | e.1          |
| `store.readAll("notifications")`        | `src/marketplace/notifications.ts:96`                                              | Live helper                       | e.1          |
| `store.readLatestById("notifications")` | `src/marketplace/notifications.ts:119`                                             | Live helper                       | e.1          |
| `store.insert("notifications")`         | `src/marketplace/notifications.ts:135`                                             | Live helper; no production caller | e.1          |
| `store.insert("catalog_*")`             | `src/marketplace/catalog.ts:1113,1116,1119`                                        | Test-only helper source           | e.2          |
| `store.readAll("catalog_*")`            | `src/marketplace/catalog.ts:1134,1135,1136`                                        | Test-only helper source           | e.2          |
| `deps.store` pass-through               | `src/server.ts:172`                                                                | Live transport                    | e.1 + e.3    |
| `listNotificationsByCustomer(store, …)` | `src/ui/client.ts:518,658,808`                                                     | Live view models                  | e.1          |
| `store.insert/readAll/readLatestById`   | `test/store.test.ts:22,24,30,36,37,38,40,46,47,61,71,72,80,83`                     | Test-only                         | e.3 — delete |
| `store.insert/readAll/readLatestById`   | `test/marketplace/store-kinds.test.ts:44,46,50,62,64,108,110,114`                  | Test-only                         | e.3 — delete |
| `store.insert/readAll/readLatestById`   | `test/marketplace/persistence-concurrency.test.ts:115,116,120,132,134,136,151,155` | Test-only                         | e.3 — delete |

`test/marketplace/seeded-server.ts` returns the store in `SeededServerContext`, but no test accesses `context.store`; it exists only because `createStorefrontServer` requires it.

---

## Part 2 — Notifications surface

### 2a — Every notification write

| Writer                                                                      | file:line                                  | Production caller?                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------- |
| `emitNotification` → `store.insert("notifications", record)`                | `src/marketplace/notifications.ts:69-85`   | **None in `src/`**. Only `test/marketplace/notifications.test.ts` calls it. |
| `markNotificationRead` → read then `store.insert("notifications", updated)` | `src/marketplace/notifications.ts:111-136` | **None in `src/`**. Only `test/marketplace/notifications.test.ts` calls it. |

Important correction to the brief’s premise: notifications are a live **read** surface, but there is no live production **writer**. The migration must still move the helpers and ViewModels so the JSONL path can disappear; it is not rewiring an active emitter.

### 2b — Every notification read

| Read                                                                                        | file:line                                  | Notes                                                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| `listNotificationsByCustomer` → `store.readAll("notifications")`                            | `src/marketplace/notifications.ts:92-109`  | Reads all, filters customer, collapses latest by id, sorts newest first. |
| `markNotificationRead` → `store.readLatestById("notifications", id)`                        | `src/marketplace/notifications.ts:119-122` | Ownership guard compares `current.customerId`.                           |
| `dashboardViewModel` → `listNotificationsByCustomer(store, customerId)`                     | `src/ui/client.ts:510-518`                 | Takes top 3.                                                             |
| `transactionDetailViewModel` → `listNotificationsByCustomer(store, transaction.customerId)` | `src/ui/client.ts:617-659`                 | Filters by `transactionId`.                                              |
| `notificationsViewModel` → `listNotificationsByCustomer(store, customerId)`                 | `src/ui/client.ts:802-808`                 | Full list.                                                               |

No `store.readAll("notifications")` or store-bound `readLatestById` exists outside these sites.

### 2c — `NotificationRepository`

Full file: `src/db/repositories/notifications.ts` (86 lines).

```ts
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  NotificationRecord,
  NotificationStatus,
} from "../../marketplace/types.ts";

/**
 * Notification repository (kind: notifications).
 *
 * Insert-as-upsert. Ids are deterministic per
 * (customer, kind, transaction), so a replayed emission updates the
 * same row instead of duplicating it. This is why `listByCustomer`
 * does NOT collapse by id the way the JSONL version does: there is
 * only ever one row per id to begin with.
 *
 * Ordering: newest first — (createdAt desc, id desc). This matches
 * listNotificationsByCustomer in notifications.ts.
 */
export type RepositoryClient = PrismaClient | Prisma.TransactionClient;

export class NotificationRepository {
  private readonly client: RepositoryClient;

  constructor(client: RepositoryClient) {
    this.client = client;
  }

  async insert(record: NotificationRecord): Promise<NotificationRecord> {
    await this.client.notification.upsert({
      where: { id: record.id },
      create: toPrismaNotification(record),
      update: toPrismaNotification(record),
    });
    return record;
  }

  async readLatestById(id: string): Promise<NotificationRecord | null> {
    const row = await this.client.notification.findUnique({ where: { id } });
    return row === null ? null : fromPrismaNotification(row);
  }

  async listByCustomer(customerId: string): Promise<NotificationRecord[]> {
    const rows = await this.client.notification.findMany({
      where: { customerId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map(fromPrismaNotification);
  }
}

interface NotificationRow {
  readonly id: string;
  readonly customerId: string;
  readonly transactionId: string | null;
  readonly title: string;
  readonly body: string;
  readonly status: string;
  readonly createdAt: Date;
}

function toPrismaNotification(
  record: NotificationRecord,
): Prisma.NotificationUncheckedCreateInput {
  return {
    id: record.id,
    customerId: record.customerId,
    transactionId: record.transactionId,
    title: record.title,
    body: record.body,
    status: record.status,
    createdAt: new Date(record.createdAt),
  };
}

function fromPrismaNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    customerId: row.customerId,
    transactionId: row.transactionId,
    title: row.title,
    body: row.body,
    status: row.status as NotificationStatus,
    createdAt: row.createdAt.toISOString(),
    simulated: true,
  };
}
```

Shape coverage:

| Helper                        | Required repository shape                     | Covered?                                                  | Gap                                                                                |
| ----------------------------- | --------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `emitNotification`            | deterministic id + insert/upsert              | Yes — `insert()` is an upsert                             | None                                                                               |
| `markNotificationRead`        | read one by id + ownership guard + write READ | Yes — `readLatestById()` + `insert()`                     | None. Keep the ownership check in the helper; the repo does not own authorization. |
| `listNotificationsByCustomer` | newest-first list scoped to customer          | Yes — `listByCustomer()` uses `(createdAt desc, id desc)` | None. The repository’s upsert makes the JSONL “collapse by id” step unnecessary.   |

Atomicity caveat: the helper’s read-then-write is two statements, exactly as the JSONL version was read-then-append. No new race is introduced, but the migration must not claim it is atomic.

### 2d — The three ViewModels

All three take an explicit `store: JsonlStore` parameter.

```ts
// src/ui/client.ts:510
export async function dashboardViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<DashboardViewModel>;

// src/ui/client.ts:518
const notifications = (await listNotificationsByCustomer(store, customerId))
  .slice(0, 3)
  .map((record) => ({ id, title, body, status, createdAt }));

// src/ui/client.ts:617
export async function transactionDetailViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  identifier: string,
): Promise<TransactionDetailViewModel | null>;

// src/ui/client.ts:657-659
const notifications = (
  await listNotificationsByCustomer(store, transaction.customerId)
).filter((record) => record.transactionId === transaction.id);

// src/ui/client.ts:802
export async function notificationsViewModel(
  store: JsonlStore,
  deps: MarketplaceTransactionDeps,
  customerId: string,
): Promise<NotificationsViewModel>;

// src/ui/client.ts:808
const notifications = await listNotificationsByCustomer(store, customerId);
```

The server’s call sites are `src/server.ts:733` (dashboard), `797` and `902` (detail), and `867` (notifications).

### 2e — Test callers

Direct helper callers:

| File                                     | Lines   | What it covers                                      |
| ---------------------------------------- | ------- | --------------------------------------------------- |
| `test/marketplace/notifications.test.ts` | 69-148  | emit/upsert, mark-read ownership, newest-first list |
| `test/marketplace/notifications.test.ts` | 150-202 | pure `notificationsForTruth` projection             |

Indirect server/view-model consumers (via store-backed reads):

- `test/auth/route-protection.test.ts` — dashboard path.
- `test/marketplace/findings.test.ts` — dashboard/detail server path.
- `test/marketplace/frontend-walkthrough.test.ts` — dashboard/detail routes.
- `test/marketplace/transaction-detail-states.test.ts` — detail routes.
- `test/marketplace/seeded-server.ts` — shared server harness used by `server-marketplace.test.ts`.
- `test/marketplace/notifications.test.ts` — direct helper tests.

Full `test/marketplace/notifications.test.ts` (202 lines):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { JsonlStore } from "../../src/store/jsonl-store.ts";
import { WALLET_FIXED_TIMESTAMP } from "../../src/marketplace/wallet.ts";
import {
  buildNotificationId,
  emitNotification,
  listNotificationsByCustomer,
  markNotificationRead,
  NotificationError,
  notificationsForTruth,
} from "../../src/marketplace/notifications.ts";
import { buildTransactionTruth } from "../../src/marketplace/truth.ts";
import type {
  CustomerTransactionStatus,
  NotificationRecord,
} from "../../src/marketplace/types.ts";

const NOW = WALLET_FIXED_TIMESTAMP;

function tempStore(t: { after: (fn: () => void) => void }): JsonlStore {
  const dir = mkdtempSync(join(tmpdir(), "storefront-not-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return new JsonlStore(dir);
}

function truthFor(customerStatus: CustomerTransactionStatus) {
  return buildTransactionTruth({
    transactionId: "mk_txn_demo",
    outcome:
      customerStatus === "CONFIRMED"
        ? "MATCH"
        : customerStatus === "FAILED"
          ? "MISSING_PROVIDER_RECORD"
          : customerStatus === "PENDING"
            ? "MISSING_PROVIDER_RECORD"
            : "DISCREPANCY",
    codes:
      customerStatus === "MANUAL_REVIEW"
        ? []
        : customerStatus === "NEEDS_ATTENTION"
          ? ["STATUS_MISMATCH"]
          : [],
    paymentState:
      customerStatus === "PENDING"
        ? "PENDING"
        : customerStatus === "FAILED"
          ? "FAILED"
          : "SUCCESS",
    resolutionStatus:
      customerStatus === "REFUND_PENDING"
        ? "REFUND_PENDING"
        : customerStatus === "REFUNDED"
          ? "REFUNDED"
          : customerStatus === "REVERSED"
            ? "REVERSED"
            : customerStatus === "MANUAL_REVIEW"
              ? "MANUAL_REVIEW"
              : "NONE",
    expectedAmountMinor: 1000,
    currency: "NGN",
    providerAmountMinor: 1000,
  });
}

test("emitNotification persists and deterministic ids make replay an upsert", async (t) => {
  const store = tempStore(t);
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "refund_pending",
    title: "Refund in progress",
    body: "first text",
    now: NOW,
  });
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "refund_pending",
    title: "Refund in progress",
    body: "second text",
    now: "2026-01-01T13:00:00.000Z",
  });

  const notifications = await listNotificationsByCustomer(store, "cus_demo");
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.body, "second text");
  assert.equal(notifications[0]?.status, "UNREAD");
  assert.equal(notifications[0]?.simulated, true);
  assert.equal(
    notifications[0]?.id,
    buildNotificationId("cus_demo", "refund_pending", "mk_txn_1"),
  );
});

test("markNotificationRead flips the status and guards ownership", async (t) => {
  const store = tempStore(t);
  const created = await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_1",
    kind: "needs_attention",
    title: "Needs attention",
    body: "your money is at risk",
    now: NOW,
  });
  const read = await markNotificationRead(store, {
    customerId: "cus_demo",
    id: created.id,
  });
  assert.equal(read.status, "READ");

  await assert.rejects(
    markNotificationRead(store, {
      customerId: "cus_other",
      id: created.id,
    }),
    (error: unknown) =>
      error instanceof NotificationError &&
      error.code === "NOTIFICATION_NOT_FOUND",
  );
});

test("listNotificationsByCustomer sorts newest first", async (t) => {
  const store = tempStore(t);
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_a",
    kind: "refunded",
    title: "Refunded",
    body: "older",
    now: NOW,
  });
  await emitNotification(store, {
    customerId: "cus_demo",
    transactionId: "mk_txn_b",
    kind: "payment_failed",
    title: "Failed",
    body: "newer",
    now: "2026-01-01T13:00:00.000Z",
  });
  const notifications: readonly NotificationRecord[] =
    await listNotificationsByCustomer(store, "cus_demo");
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.body, "newer");
});

test("notificationsForTruth is derived from the truth projection only", () => {
  assert.equal(
    notificationsForTruth(truthFor("CONFIRMED"), {
      customerId: "cus_demo",
      transactionId: "mk_txn_demo",
    }).length,
    0,
  );
  assert.equal(
    notificationsForTruth(truthFor("PENDING"), {
      customerId: "cus_demo",
      transactionId: "mk_txn_demo",
    }).length,
    0,
  );

  const failed = notificationsForTruth(truthFor("FAILED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(failed[0]?.kind, "payment_failed");

  const refundPending = notificationsForTruth(truthFor("REFUND_PENDING"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(refundPending[0]?.kind, "refund_pending");

  const refunded = notificationsForTruth(truthFor("REFUNDED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(refunded[0]?.kind, "refunded");

  const reversed = notificationsForTruth(truthFor("REVERSED"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(reversed[0]?.kind, "reversed");

  const review = notificationsForTruth(truthFor("MANUAL_REVIEW"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(review[0]?.kind, "manual_review");

  const attention = notificationsForTruth(truthFor("NEEDS_ATTENTION"), {
    customerId: "cus_demo",
    transactionId: "mk_txn_demo",
  });
  assert.equal(attention[0]?.kind, "needs_attention");
  assert.match(attention[0]?.body ?? "", /at risk/);
});
```

`test/marketplace/seeded-server.ts` uses the store only to construct the server and to expose it in `SeededServerContext`; no test reads `context.store`. Its notification dependency is indirect: the server’s dashboard/detail routes call the three ViewModels.

---

## Part 3 — Catalog surface

### 3a — Repositories

| Repository                                              | File                                        | Lines | Methods                            | Production callers |
| ------------------------------------------------------- | ------------------------------------------- | ----: | ---------------------------------- | ------------------ |
| `CatalogCategoryRepository` (`repos.catalogCategories`) | `src/db/repositories/catalog-categories.ts` |    83 | `insert`, `readLatestById`, `list` | **0**              |
| `CatalogServiceRepository` (`repos.catalogServices`)    | `src/db/repositories/catalog-services.ts`   |   109 | `insert`, `readLatestById`, `list` | **0**              |
| `CatalogProductRepository` (`repos.catalogProducts`)    | `src/db/repositories/catalog-products.ts`   |   101 | `insert`, `readLatestById`, `list` | **0**              |

All three are registered in `src/db/repositories/index.ts:48-50` and constructed at `85-87`. They map the `CatalogCategory`, `CatalogService`, and `CatalogProduct` Prisma models. They have no production readers or writers.

### 3b — Callers of any catalog repo

Production: **none**.

Test-only callers:

| File                                              | Lines  | Calls                                       |
| ------------------------------------------------- | ------ | ------------------------------------------- |
| `test/db/repositories/catalog-categories.test.ts` | 29-76  | insert/read/list                            |
| `test/db/repositories/catalog-services.test.ts`   | 57-112 | insert/read/list (seeds category)           |
| `test/db/repositories/catalog-products.test.ts`   | 27-125 | insert/read/list (seeds category + service) |

These files contain **12 tests** total: 4 per repo.

### 3c — `seedCatalogToStore` / `loadCatalogFromStore`

Definitions:

- `src/marketplace/catalog.ts:1105` — `seedCatalogToStore(store)` inserts into `catalog_categories`, `catalog_services`, `catalog_products`.
- `src/marketplace/catalog.ts:1128` — `loadCatalogFromStore(store)` reads the same three kinds and reassembles `MarketplaceCatalog`.

Callers:

- `test/marketplace/catalog.test.ts:391` — `seedCatalogToStore(store)`
- `test/marketplace/catalog.test.ts:393` — `loadCatalogFromStore(store)`

No production callers. The only store test is `seed persistence round-trips categories, services, and products` at `catalog.test.ts:389` (1 test). The other 19 tests in that file exercise the in-memory `buildDemoCatalog` and do not use the store.

### 3d — `marketplace_catalog` dead kind

`marketplace_catalog` appears in `src/store/jsonl-store.ts:12` (union) and `:43` (file name) only.

- `prisma/schema.prisma` has **no** `marketplace_catalog` model.
- The schema does have `CatalogCategory`, `CatalogService`, and `CatalogProduct` models at `schema.prisma:490`, `504`, and `525`.
- There is no `marketplace_catalog` repository or production caller.

Verdict: `marketplace_catalog` is a JSONL-only dead kind. The `catalog_*` kinds map to real tables, but their repositories are test-only and the seeded catalog is held in memory in production.

---

## Part 4 — `Deps.store` removal surface

### 4a — The dependency type

There is no type literally named `Deps`. The relevant type is `ServerDependencies` in `src/server.ts:106-116`:

```ts
export interface ServerDependencies {
  readonly store: JsonlStore;
  /**
   * Top-level repository handle. Mirrors `marketplace.repos` when
   * marketplace is configured; kept separately so non-marketplace paths
   * can reach Postgres without going through MarketplaceTransactionDeps.
   */
  readonly repos: Repositories;
  readonly paystack: PaystackGateway;
  readonly marketplace?: MarketplaceTransactionDeps;
}
```

Confirmed: `store: JsonlStore` is a required field.

### 4b — Every `deps.store` use

There is exactly **one value access** in `src/`:

- `src/server.ts:172` — `deps.store` passed as the fourth argument to `tryHandleMarketplace`.

The store then travels by parameter:

| Site                             | Line                | Use                                          |
| -------------------------------- | ------------------- | -------------------------------------------- |
| `tryHandleMarketplace` parameter | `src/server.ts:616` | `store: JsonlStore`                          |
| `routeMarketplace` parameter     | `src/server.ts:664` | `store: JsonlStore`                          |
| dashboard VM call                | `src/server.ts:733` | `dashboardViewModel(store, deps, …)`         |
| detail VM call                   | `src/server.ts:797` | `transactionDetailViewModel(store, deps, …)` |
| notifications VM call            | `src/server.ts:867` | `notificationsViewModel(store, deps, …)`     |
| detail VM call                   | `src/server.ts:902` | `transactionDetailViewModel(store, deps, …)` |
| production construction          | `src/main.ts:39,53` | `new JsonlStore` + `store` in server deps    |

### 4c — Last use in `src`

The filtered scan for `.store` tokens in `src/` returns only:

```text
src/server.ts:172:        deps.store,
```

This confirms `server.ts:172` is the last value access. The remaining `store` occurrences are the type/field and parameter threading listed above. Removing the dependency also requires removing `store` from all server-test harnesses; those are enumerated in Part 1.

---

## Part 5 — Repo no-caller audit

Counts are `repos.<property>` references and distinct files. “Prod” excludes `test/`; “test” is `test/`. A repo with zero production refs but test refs is **dead** by this audit’s definition. No repository has zero total refs.

| Repository                    | Prod refs/files | Test refs/files | Classification                   |
| ----------------------------- | --------------: | --------------: | -------------------------------- |
| `users`                       |           4 / 1 |          11 / 1 | alive                            |
| `sessions`                    |           4 / 1 |           6 / 1 | alive                            |
| `organizations`               |           4 / 2 |           8 / 2 | alive                            |
| `memberships`                 |           4 / 2 |          12 / 2 | alive                            |
| `wallets`                     |           3 / 1 |          17 / 5 | alive                            |
| `walletLedger`                |          15 / 3 |         27 / 10 | alive                            |
| `transactionEvents`           |           2 / 1 |          14 / 2 | alive                            |
| `refunds`                     |           5 / 2 |           8 / 3 | alive                            |
| `reversals`                   |           2 / 2 |           7 / 2 | alive                            |
| `disputes`                    |           6 / 2 |           6 / 1 | alive                            |
| `manualReviews`               |           5 / 2 |           6 / 1 | alive                            |
| `receipts`                    |           2 / 2 |          10 / 3 | alive                            |
| `notifications`               |       **0 / 0** |          13 / 1 | **dead now**; alive after e.1    |
| `catalogCategories`           |       **0 / 0** |          12 / 3 | **dead** — drop e.2              |
| `catalogServices`             |       **0 / 0** |          11 / 2 | **dead** — drop e.2              |
| `catalogProducts`             |       **0 / 0** |          10 / 1 | **dead** — drop e.2              |
| `marketplaceCustomers`        |           5 / 3 |          13 / 2 | alive                            |
| `marketplaceOrders`           |           8 / 2 |           9 / 4 | alive                            |
| `marketplaceTransactions`     |          13 / 6 |          26 / 9 | alive                            |
| `marketplacePayments`         |           5 / 3 |          15 / 5 | alive                            |
| `marketplaceProviderAttempts` |           5 / 3 |          18 / 7 | alive                            |
| `ticketArtifacts`             |           6 / 4 |          22 / 6 | alive                            |
| `giftCardArtifacts`           |           4 / 3 |          20 / 7 | alive                            |
| `evidencePacks`               |          10 / 2 |          15 / 4 | alive                            |
| `paymentEvents`               |           3 / 1 |          27 / 4 | alive                            |
| `businesses`                  |           3 / 1 |          12 / 7 | alive                            |
| `products`                    |           2 / 1 |          11 / 6 | alive                            |
| `orders`                      |           3 / 2 |          12 / 5 | alive                            |
| `payments`                    |       **5 / 2** |          30 / 4 | **alive (legacy)** — do not drop |

Known-candidate corrections:

- **Catalog repos:** confirmed dead; test-only.
- **`payments`:** **not dead.** Production callers are real (see Part 8). The JSONL `payments` kind is dead, but the Postgres repo is active.
- **`notifications`:** dead today because no production caller; it becomes live in e.1 when the three ViewModels switch to `repos.notifications`.
- **Any others:** none surfaced. Every non-catalog, non-notification repo has at least one production reference.

---

## Part 6 — StoreKind union trim inventory

Current union: `src/store/jsonl-store.ts:4-33` — **29 members**.

| Kind                            | Postgres model / status                        | Post-5B.1e state              |
| ------------------------------- | ---------------------------------------------- | ----------------------------- |
| `businesses`                    | `Business`; repo alive                         | remove from JSONL             |
| `products`                      | `Product`; repo alive                          | remove from JSONL             |
| `users`                         | `User`; repo alive                             | remove from JSONL             |
| `sessions`                      | `Session`; repo alive                          | remove from JSONL             |
| `orders`                        | `Order`; repo alive                            | remove from JSONL             |
| `payments`                      | `Payment`; legacy repo alive                   | remove JSONL kind; repo stays |
| `marketplace_customers`         | `MarketplaceCustomer`; repo alive              | remove from JSONL             |
| `marketplace_catalog`           | **no model; JSONL-only dead kind**             | delete                        |
| `catalog_categories`            | `CatalogCategory`; repo test-only, dropping    | delete                        |
| `catalog_services`              | `CatalogService`; repo test-only, dropping     | delete                        |
| `catalog_products`              | `CatalogProduct`; repo test-only, dropping     | delete                        |
| `marketplace_orders`            | `MarketplaceOrder`; repo alive                 | remove from JSONL             |
| `marketplace_transactions`      | `MarketplaceTransaction`; repo alive           | remove from JSONL             |
| `marketplace_provider_attempts` | `MarketplaceProviderAttempt`; repo alive       | remove from JSONL             |
| `wallets`                       | `Wallet`; repo alive                           | remove from JSONL             |
| `wallet_ledger`                 | `WalletLedgerEntry`; repo alive                | remove from JSONL             |
| `transaction_events`            | `TransactionEvent`; repo alive                 | remove from JSONL             |
| `evidence_packs`                | `EvidencePack`; repo alive                     | remove from JSONL             |
| `receipts`                      | `Receipt`; repo alive                          | remove from JSONL             |
| `refunds`                       | `Refund`; repo alive                           | remove from JSONL             |
| `reversals`                     | `Reversal`; repo alive                         | remove from JSONL             |
| `disputes`                      | `Dispute`; repo alive                          | remove from JSONL             |
| `manual_reviews`                | `ManualReview`; repo alive                     | remove from JSONL             |
| `notifications`                 | `Notification`; repo dead now, alive after e.1 | remove after e.1              |
| `ticket_artifacts`              | `TicketArtifact`; repo alive                   | remove from JSONL             |
| `gift_card_artifacts`           | `GiftCardArtifact`; repo alive                 | remove from JSONL             |
| `organizations`                 | `Organization`; repo alive                     | remove from JSONL             |
| `memberships`                   | `Membership`; repo alive                       | remove from JSONL             |
| `payment_events`                | `PaymentEvent`; repo alive                     | remove from JSONL             |

After e.1/e.2, no production or test code should require any member. After e.3, the union and `KIND_FILE_NAMES` should both be deleted, leaving **zero** members. Do not trim to a smaller union; delete the type and the class.

---

## Part 7 — T7.8 test retirement plan

### 7a — Structural summary

| File                                               | Lines | Tests | Scope                                                                                                         |
| -------------------------------------------------- | ----: | ----: | ------------------------------------------------------------------------------------------------------------- |
| `test/marketplace/store-kinds.test.ts`             |   118 |     3 | JSONL kind round-trips for marketplace transactions, legacy `payments`, and evidence packs                    |
| `test/marketplace/persistence-concurrency.test.ts` |   160 |     5 | Cross-instance append concurrency, last-write-wins, truncated line, corrupt line, single-instance concurrency |
| `test/store.test.ts` (not T7.8, but same class)    |    85 |     7 | Generic insert/readAll/readLatestById, missing file, corrupt skip, unicode, concurrency                       |

### 7b — Coverage with no direct post-deletion equivalent

**`store-kinds.test.ts`**

1. `marketplace_transactions` round-trip through JSONL latest-wins. Postgres `MarketplaceTransactionRepository` tests already cover insert/read/overwrite.
2. Legacy `payments` kind compatibility. The kind is being removed; the legacy `payments` repo has its own Postgres tests. No JSONL compatibility is needed after 5B.1e.
3. `evidence_packs` stored in its own kind and replayed. Postgres `EvidencePackRepository` tests cover the same mapping and id-keyed overwrite.

Lost: proof that the JSONL filenames/kinds remain stable. That property disappears with the class.

**`persistence-concurrency.test.ts`**

1. Two store instances appending to one directory without loss.
2. Cross-instance last-write-wins for the same id.
3. Truncated line tolerated by `readAll` — data loss, not corruption.
4. Corrupt line skipped without hiding the latest valid record.
5. 200 concurrent inserts from one instance with no corruption.

Lost: file-level append atomicity, truncation tolerance, and corrupt-line recovery. Postgres does not have a truncation/corruption analogue; those are properties of the JSONL implementation, not of the domain. The concurrency/last-write-wins semantics could be partially re-expressed as Prisma/Postgres concurrent-upsert tests, but that tests the database adapter, not the deleted class.

**`store.test.ts`**

Generic JSONL behavior: round-trip, missing file, duplicate id, corrupt line, unicode, concurrent inserts. All are implementation tests for the class being deleted.

### 7c — Recommendation

| File                                               | Recommendation                                                                                                                                                              | Tests removed |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
| `test/marketplace/store-kinds.test.ts`             | **Retire (delete).** No rewrite. Postgres repo tests already cover the surviving mappings.                                                                                  |             3 |
| `test/marketplace/persistence-concurrency.test.ts` | **Retire (delete).** Do not rewrite truncation/corruption. Optional: add 1–2 Postgres concurrent-upsert tests if the owner wants concurrency coverage at the adapter level. |             5 |
| `test/store.test.ts`                               | **Retire (delete).** Mandatory once `JsonlStore` is deleted.                                                                                                                |             7 |

Total e.3 removal: **15 tests** (8 T7.8 + 7 direct class tests). Optional replacement tests would raise the denominator, not preserve the deleted behavior.

---

## Part 8 — `payments` / `marketplace_payments` split

### 8a — Current state

| Concern    | Legacy `payments`                                                                               | Marketplace `marketplace_payments`                                                                                        |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Model      | `Payment` (`schema.prisma:597`)                                                                 | `MarketplacePayment` (`schema.prisma:201`)                                                                                |
| Repository | `repos.payments`                                                                                | `repos.marketplacePayments`                                                                                               |
| Domain     | Legacy commerce orders / Paystack                                                               | Marketplace wallet settlement                                                                                             |
| Writer     | `src/server.ts:415` (`POST /orders`); `src/application/verify-order.ts:144`                     | `src/marketplace/transactions.ts:653`                                                                                     |
| Reader     | `src/server.ts:527` and `563` (`list`); `src/application/verify-order.ts:92` (`readLatestById`) | `src/marketplace/resolution.ts:85`; `src/marketplace/transactions.ts:2381,2432`; `src/ui/client.ts:630` (`findByOrderId`) |
| Key        | `orderId` → `Order.id`; `paystackReference`                                                     | `transactionId` → `MarketplaceTransaction.id`; `customerId`; `orderId` → `MarketplaceOrder.id`                            |
| JSONL kind | `payments` — dead (no production `store.insert("payments")`)                                    | never a JSONL kind; repo-only                                                                                             |
| Alive?     | **Yes**                                                                                         | **Yes**                                                                                                                   |

Are they joined? **No.** No source file references both `repos.payments` and `marketplacePayments`. There is no shared foreign key: the legacy table joins to `orders`/`businesses`; the marketplace table joins to `marketplace_transactions`/`marketplace_customers`. The shared column name `orderId` refers to different tables and must not be treated as a join.

### 8b — Draft 5B.1e doc content

> **Payments split**
>
> `payments` is the legacy Paystack record used by the original commerce routes (`POST /orders`, `verifyOrder`, `/reconcile`, merchant CSV). It is written by `repos.payments.insert` and read by `repos.payments.list` / `readLatestById`. It remains active.
>
> `marketplace_payments` is the marketplace settlement record used by wallet-funded transactions and the marketplace truth/detail surfaces. It is written by `repos.marketplacePayments.insert` and read by `findByOrderId`. It remains active.
>
> The two records are never merged. They have different schemas, different owning domains, and different foreign keys. No production query reads both. The legacy `payments` JSONL kind is dead and is removed with `JsonlStore`; the legacy Postgres `payments` repository is **not** dead and is not part of 5B.1e deletion.
>
> Deletion policy: remove the `payments` JSONL kind in e.3. Retain `repos.payments` until the legacy commerce routes are retired in a separate increment. Do not archive or delete the `Payment` table as part of 5B.1e.

---

## Part 9 — Decomposition recommendation

### 5B.1e.1 — Notifications migration

Scope:

- Change `emitNotification`, `listNotificationsByCustomer`, and `markNotificationRead` to accept `repos: Repositories` (or use `deps.repos` at call sites) and call `repos.notifications.insert` / `readLatestById` / `listByCustomer`.
- Change `dashboardViewModel`, `transactionDetailViewModel`, and `notificationsViewModel` to stop taking `store: JsonlStore`; use `deps.repos`.
- Update `src/server.ts` call sites to stop threading the store into those VMs.
- Rewrite `test/marketplace/notifications.test.ts` to use `withRollback` + Prisma fixtures, preserving all 4 tests.
- Keep `NotificationRepository` unchanged unless a genuine gap is found. None was found.
- Do not remove `ServerDependencies.store` yet; legacy server tests still need it. That is e.3.

Tests: **634 → 634** (migration only).

### 5B.1e.2 — Catalog drop

Scope:

- Delete `CatalogCategoryRepository`, `CatalogServiceRepository`, and `CatalogProductRepository`; remove them from `Repositories` and `buildRepositories`.
- Delete their three repo test files (12 tests).
- Delete `seedCatalogToStore` and `loadCatalogFromStore` from `src/marketplace/catalog.ts`.
- Delete only the `seed persistence round-trips` test and the now-unused temp-store helper/imports from `test/marketplace/catalog.test.ts` (1 test); keep the 19 in-memory catalog tests.
- Leave the catalog Prisma models/tables in place unless a separate schema decision says otherwise.
- Do not trim the `StoreKind` union yet; e.3 owns that deletion.

Tests: **634 → 621** (−13).

### 5B.1e.3 — Delete the JSONL layer

Scope:

- Retire `store-kinds.test.ts` (3), `persistence-concurrency.test.ts` (5), and `store.test.ts` (7).
- Delete `JsonlStore`, `StoreError`, `StoreKind`, `KIND_FILE_NAMES`, and the `src/store/` implementation.
- Remove `store` from `ServerDependencies`, `main.ts`, `tryHandleMarketplace`, `routeMarketplace`, and all test server harnesses.
- Remove the `SeededServerContext.store` field.
- Remove stale imports and the two catalog helper functions if e.2 has not already done so.
- Confirm the union is empty before deletion; after deletion there is no union.

Tests: **621 → 606** (−15). If the owner opts into 1–2 Postgres concurrency replacements, **607–608**.

### 5B.1e.4 — Docs and closure

- Add the payments/marketplace_payments split text from Part 8.
- Record the 5B.1c/5B.1d/5B.1e phase summary and the JSONL removal.
- No test count change: **606**.

### Ordering constraints

1. **e.1 before e.3** — notifications still read JSONL until e.1.
2. **e.2 before e.3** — catalog test helpers and repo tests still reference the store/helpers until e.2.
3. **e.1 and e.2 independent** — either order is safe.
4. **e.4 last.**

### Test-count trajectory

| State     | Tests | Delta |
| --------- | ----: | ----: |
| Current   |   634 |     — |
| After e.1 |   634 |     0 |
| After e.2 |   621 |   −13 |
| After e.3 |   606 |   −15 |
| After e.4 |   606 |     0 |

The example in the brief assumed e.2 removed no tests. The evidence says otherwise: dropping the catalog repos removes their 12 repo tests and the one store round-trip test. The owner must accept that denominator change or keep dead repositories solely to preserve tests, which is not recommended.

---

## Open questions requiring owner ruling

1. **T7.8 retirement and denominator.** Retiring `store-kinds.test.ts` and `persistence-concurrency.test.ts` removes **8 tests** with no direct Postgres equivalent for truncation/corruption. Is a **606** denominator acceptable, or should 1–2 Postgres concurrent-upsert tests be added (607–608)?
2. **`store.test.ts` removal.** Deleting `JsonlStore` also requires deleting its **7 direct tests**. This was not named in the brief. Confirm the additional loss is acceptable.
3. **Catalog test removal.** Dropping the three catalog repos removes **12 repo tests**, and deleting the persistence helpers removes **1 catalog test** (13 total). Accept, or retain the dead repos/test-only surface to preserve the count? Recommendation: accept and drop.
4. **Notifications with no production writer.** `emitNotification` and `markNotificationRead` are test-only today. Should e.1 still migrate them as reusable domain helpers, or should the write path be deleted until a real emitter exists? Recommendation: migrate; do not delete domain behavior during a persistence migration.
5. **Legacy `payments` disposition.** The brief’s hypothesis that `repos.payments` is test-only is false. Confirm that the legacy repo/table stays and only the JSONL `payments` kind is removed in e.3.
6. **Catalog schema fate.** The task drops catalog repos, not necessarily the `catalog_*` tables. Confirm the tables remain for now; dropping them would be a schema increment, not 5B.1e.
