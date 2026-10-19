# 1k Pre-Flight

Read-only investigation for the 5B.1c-1k step: durable-persistence migration of the
legacy Phase 2C Paystack tables (`businesses`, `products`, `orders`, `payments`)
from the JSONL store to Postgres via the existing Prisma client.

- **HEAD:** `1b4022b` (5B.1c-1j.2)
- **Working tree:** clean for `reconcilekit/` (no source, test, or schema changes made by this investigation)
- **Scope of this document:** evidence and a recommendation only. No code was changed.

---

## Summary

**Recommendation B (split into two ordered sub-steps):** `1k.1` migrates
`businesses` + `products` + `orders` (the create-order write path in `server.ts`);
`1k.2` migrates `payments` + `verify-order.ts` (the verification/callback path).
All four tables are production-alive and form a closed FK chain, so deferral
(C/D) is not signalled.

---

## Part 1 — Full FK and value-shape audit

### 1a. Model definitions

Source: `reconcilekit/storefront/prisma/schema.prisma`, section
"Legacy Phase 2C Paystack acquisition surface" (L546–616).

| Model      | Line | Fields                                                                                                                                                                                                                                 | PK   | Nullable                                | Relations                                    | Indexes / map                                                                          |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- | --------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Business` | 550  | `id String`, `name String`, `createdAt DateTime @db.Timestamptz(6)`                                                                                                                                                                    | `id` | none                                    | `products`, `orders`, `payments` (back-refs) | `@@map("businesses")` — **no `@@unique`**                                              |
| `Product`  | 562  | `id String`, `businessId String`, `name String`, `priceMinor Int`, `currency String`, `createdAt DateTime`                                                                                                                             | `id` | none                                    | `business` (FK), `orders`                    | `@@index([businessId])`, `@@map("products")` — **no `@@unique`**                       |
| `Order`    | 577  | `id String`, `businessId String`, `productId String`, `customerEmail String`, `expectedAmountMinor Int`, `currency String`, `status String`, `paystackReference String?`, `authorizationUrl String?`, `createdAt DateTime`             | `id` | `paystackReference`, `authorizationUrl` | `business` (FK), `product` (FK), `payments`  | `@@index([businessId])`, `@@map("orders")` — **no `@@unique`**                         |
| `Payment`  | 597  | `id String`, `orderId String`, `businessId String`, `expectedAmount Int`, `currency String`, `paystackReference String` (NOT NULL), `status String`, `paidAt DateTime?`, `refundStatus String`, `metadata Json`, `recordedAt DateTime` | `id` | `paidAt`                                | `order` (FK), `business` (FK)                | `@@index([orderId])`, `@@index([businessId])`, `@@map("payments")` — **no `@@unique`** |

All four use the default `id String @id` (non-`@default`) — ids are supplied by the
application (`src/ids.ts`), never by the database.

### 1b. Cross-table FK chain

```
businesses.id
  ├─ products.business_id      (Product.business, onDelete: Restrict)   L570
  ├─ orders.business_id        (Order.business,   onDelete: Restrict)   L589
  └─ payments.business_id      (Payment.business, onDelete: Restrict)   L611
orders.id
  └─ payments.order_id         (Payment.order,    onDelete: Restrict)   L610
products.id
  └─ orders.product_id         (Order.product,    onDelete: Restrict)   L590
```

The chain is **fully closed inside the four tables**. No FK from any of the four
crosses into the marketplace tables (`marketplace_*`), the catalog tables
(`catalog_*`), the wallet tables (`wallets`, `wallet_ledger_entries`), or the
frozen billing tables. All four FKs are `onDelete: Restrict`.

### 1c. Unique constraints and replay behaviour

**None of the four tables has an `@@unique` constraint.** Consequences:

- There is no DB-level uniqueness on `payments.paystackReference` (non-unique) or
  `orders.paystackReference` (nullable, non-unique).
- Replay/idempotency therefore cannot rely on a unique key firing; it relies on the
  application id. `PaymentRecord.id === orderId` (one payment row per order), and a
  later verification appends a new record with the **same id** → "latest write wins".
  Under JSONL this is a new line; under Prisma the repositories implement it as
  `upsert({ where: { id } })` on the PK (see Part 1d), which converges to the same
  effective record because the PK deduplicates naturally.
- Because there is no unique constraint, a naive `create` (instead of `upsert`) would
  **not** fail on replay — it would accumulate duplicate rows and silently break
  "latest wins". The existing repositories already use `upsert`, so this is safe.

### 1d. Legacy record shape vs Prisma model

Domain types: `reconcilekit/storefront/src/domain/types.ts`.

| Domain type     | Line | Notable vs Prisma                                                                                                                                                                                                                                             |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Business`      | 7    | `createdAt: string` (ISO) vs `DateTime`                                                                                                                                                                                                                       |
| `Product`       | 13   | `priceMinor: number` stays `Int`; `createdAt: string`                                                                                                                                                                                                         |
| `Order`         | 22   | `status: OrderStatus` union vs `String`; `paystackReference`/`authorizationUrl` `string \| null` mirrors `String?`; `createdAt: string`                                                                                                                       |
| `PaymentRecord` | 43   | `id` is the **order id**; `status: CanonicalPaymentStatus` (frozen domain union) vs `String`; `refundStatus: RefundStatus` vs `String`; `metadata: Readonly<Record<string, string>>` vs `Json`; `paidAt: string \| null` vs `DateTime?`; `recordedAt: string` |

Translation layer already exists and is exercised by the repository tests. Every
legacy repository converts at the boundary, so no domain change is required:

- `BusinessRepository` (`src/db/repositories/businesses.ts`): `insert` = `business.upsert`
  keyed by `id`; `readLatestById` = `business.findUnique`. `toPrismaBusiness` wraps
  `createdAt` in `new Date(...)`; `fromPrismaBusiness` `.toISOString()`.
- `ProductRepository` (`src/db/repositories/products.ts`): same pattern
  (`upsert`/`findUnique`), `priceMinor` passes through as `Int`.
- `OrderRepository` (`src/db/repositories/orders.ts`): `insert` = `order.upsert`;
  `readLatestById` = `order.findUnique`. `status`/`paystackReference` cast directly
  (no coercion needed — the domain union is a string subtype and nullability matches).
- `PaymentRepository` (`src/db/repositories/payments.ts`): `insert` = `payment.upsert`;
  `readLatestById` = `payment.findUnique`; **`list()`** = `payment.findMany({ orderBy: { id: "asc" } })`;
  **`findByOrderId(orderId)`** = `payment.findFirst({ where: { orderId }, orderBy: { recordedAt: "desc" } })`.
  `metadata` is cast through `unknown` (`Prisma.JsonValue` ⇄ `Readonly<Record<string,string>>`).

Value-shape observations:

- **Timestamps.** Domain strings ⇄ `DateTime`: the repositories are the only conversion
  point, so no other code needs to change. `DateTime` precision (`@db.Timestamptz(6)`)
  is microsecond; domain ISO strings are millisecond. Values in the current fixtures are
  whole milliseconds, so round-trips are exact today.
- **`metadata`.** Schema is `Json`; the domain narrows it to `Record<string, string>`.
  The JSON column is permissive (it can hold numbers/booleans/nesting), so the cast is
  the only guard. All writers in `server.ts` and `verify-order.ts` currently store
  strings only.
- **Enums.** `status` and `refundStatus` are plain `String` columns cast to the domain
  unions; there is no DB-level enum to enforce them. Same as the JSONL behaviour.

---

## Part 2 — Entry-point reachability

Entry points traced: `src/main.ts` (`npm start` → `node --env-file-if-exists=.env src/main.ts`),
`src/server.ts` (`createStorefrontServer`, wired by `main.ts`),
`src/cli/pilot-run.ts` (`npm run pilot:run`), `src/cli/index.ts` (**does not exist** —
the only file in `src/cli/` is `pilot-run.ts`), and `src/application/verify-order.ts`
(`verifyOrder`, called from `server.ts`).

Routing: `createStorefrontServer` → `handleRequest` (server.ts:157) → marketplace
routes first (only when `deps.marketplace` is set), then the legacy routes below.
`main.ts` wires **both** `store` (JSONL) and `repos` (Prisma), so the legacy routes are
live in production.

### Writes

| Table        | Write site                                                  | Entry point reached from                                                                               | Notes                                       |
| ------------ | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `businesses` | `server.ts:260` `deps.store.insert("businesses", business)` | `POST /businesses` → `handleRequest:189` → `handleCreateBusiness:246`                                  | production (main.ts `start`)                |
| `products`   | `server.ts:307` `deps.store.insert("products", product)`    | `POST /products` → `handleRequest:194` → `handleCreateProduct:264`                                     | production                                  |
| `orders`     | `server.ts:383` `deps.store.insert("orders", failedOrder)`  | `POST /orders` → `handleRequest:199` → `handleCreateOrder:311`                                         | failure path (`PAYSTACK_INITIALIZE_FAILED`) |
| `orders`     | `server.ts:403` `deps.store.insert("orders", order)`        | `POST /orders` → `handleCreateOrder:311`                                                               | success path                                |
| `payments`   | `server.ts:424` `deps.store.insert("payments", payment)`    | `POST /orders` → `handleCreateOrder:311`                                                               | success path only                           |
| `payments`   | `verify-order.ts:147` `store.insert("payments", candidate)` | `POST /orders/:orderId/verify` (`server.ts:435`) and `GET /callback` (`server.ts:487`) → `verifyOrder` | production                                  |

### Reads

| Table        | Read site                                                             | Entry point reached from                                 | Notes                                 |
| ------------ | --------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------- |
| `businesses` | `server.ts:291` `deps.store.readLatestById<Business>`                 | `POST /products` → `handleCreateProduct:264`             | existence check                       |
| `businesses` | `server.ts:330` `deps.store.readLatestById<Business>`                 | `POST /orders` → `handleCreateOrder:311`                 | existence check                       |
| `products`   | `server.ts:337` `deps.store.readLatestById<Product>`                  | `POST /orders` → `handleCreateOrder:311`                 | price/business match                  |
| `orders`     | `verify-order.ts:51` `store.readLatestById<Order>("orders", orderId)` | `POST …/verify` + `GET /callback` → `verifyOrder`        | production                            |
| `payments`   | `verify-order.ts:92` `store.readLatestById<PaymentRecord>`            | `POST …/verify` + `GET /callback` → `verifyOrder`        | production                            |
| `payments`   | `server.ts:537` `deps.store.readAll<PaymentRecord>("payments")`       | `GET /reconcile` → `handleReconcile:530`                 | reduced via `effectivePaymentRecords` |
| `payments`   | `server.ts:575` `deps.store.readAll<PaymentRecord>("payments")`       | `GET /reconcile/merchant.csv` → `handleReconcileCsv:570` | reduced via `effectivePaymentRecords` |

### Per-table reachability summary

| Table        | Production-alive?                                                                   | JsonlStore sites | Prisma consumer    |
| ------------ | ----------------------------------------------------------------------------------- | ---------------- | ------------------ |
| `businesses` | **Yes** (2 writes/reads via `POST /businesses`, `/products`, `/orders`)             | 3                | **none in `src/`** |
| `products`   | **Yes** (`POST /products`, `/orders`)                                               | 2                | **none in `src/`** |
| `orders`     | **Yes** (`POST /orders`, verify, callback)                                          | 3                | **none in `src/`** |
| `payments`   | **Yes** (`POST /orders`, verify, callback, `/reconcile`, `/reconcile/merchant.csv`) | 6                | **none in `src/`** |

**1i-class finding (confirmed and extended).** Grep of `src/**/*.ts` for
`repos\.(businesses|products|orders|payments)\b` returns **zero** production callers.
The four legacy repositories exist, are fully implemented, and are exercised by tests
(`test/db/repositories/*.test.ts`) — but **no production code path reads through them
yet**. The production path uses `deps.store` (JSONL) exclusively. This was the known
shape for `payments`; it holds identically for `businesses`, `products`, and `orders`.
"Repository exists" therefore does **not** mean "production uses it" — the swap is still
outstanding for all four.

**Test-only sites:** none in `src/` — every JSONL site for the four kinds is reachable
from a production entry point. The only "test-only" surface is the repositories
themselves (consumed only by `test/db/repositories/*.test.ts` today).

**CLI:** `src/cli/pilot-run.ts` does not touch the four legacy kinds. Its only "store"
reference is a comment (L725). The legacy kinds were never part of the pilot CLI
surface. `src/cli/index.ts` does not exist.

`src/db/smoke.ts` lists all four tables in `EXPECTED_TABLES` (L46–49); this is a
presence check only, not a read/write path.

---

## Part 3 — Legacy payments split (`PaymentRepository` vs `MarketplacePaymentRepository`)

**(a) Separate files?** Yes, and explicitly documented as independent.

- `src/db/repositories/payments.ts` → `PaymentRepository`, owns the **`payments`** table
  (legacy Phase 2C Paystack acquisition surface).
- `src/db/repositories/marketplace-payments.ts` → `MarketplacePaymentRepository`, owns
  the **`marketplace_payments`** table.
- The header comment in `payments.ts` states the two "share nothing but a naming
  convention … Do not merge."

**(b) Does `repos.payments` have a production caller?** **No.** Zero callers in
`src/` (Part 2 grep). The marketplace path uses `repos.marketplacePayments`; the legacy
path uses `deps.store` (JSONL).

**(c) Does the legacy Paystack path use JSONL `payments` or `repos.payments`?**
**JSONL.** Every legacy write/read goes through `deps.store`:

- write `server.ts:424` (`handleCreateOrder`) and `verify-order.ts:147` (`verifyOrder`);
- read `verify-order.ts:92` (`readLatestById`), `server.ts:537` and `server.ts:575`
  (`readAll`, each followed by the `effectivePaymentRecords` reduction in
  `src/reconcile/adapter.ts:33`).

`repos.payments` is never invoked outside its own unit tests.

**(d) If we migrate `payments`, what breaks?**

- **External HTTP contract: none.** `PaymentRepository` returns `PaymentRecord` — the
  identical shape the JSONL `readAll`/`readLatestById` returned. `fromPrismaPayment`
  reverses `toPrismaPayment` (`metadata` cast through `unknown`; `paidAt`/`recordedAt`
  ISO ⇄ `Date`). `buildReconcileView` (`src/reconcile/view.ts:55`) and
  `paymentRecordToProviderPayment` consume `PaymentRecord` and are unchanged.
- **Call-site edits (source):**
  - `verify-order.ts` currently receives `store: JsonlStore` (L47) and calls
    `store.readLatestById<Order>("orders", …)` (L51),
    `store.readLatestById<PaymentRecord>(…)` (L92), `store.insert("payments", candidate)` (L147).
    Migrating payments means this signature changes to take `repos` (or the payment
    repository) — a signature change of the same class already handled for
    `payment-events` in 1j.1. Note it also reads **`orders`**, so `verify-order.ts`
    cannot be fully converted to Prisma until `orders` is migrated too.
  - `server.ts:424` (insert) → `repos.payments.insert`; `server.ts:537`/`575`
    (`readAll` + reduction) → `repos.payments.list()` (or `findByOrderId` for the
    `orderId`-filtered branch at `handleReconcile`).
- **Semantic differences to be aware of (not test-visible today):**
  1. **Ordering.** `repos.payments.list()` orders `id asc`; JSONL `readAll` returns
     **append order**. `buildReconcileView` maps `records` in input order, so
     `/reconcile` result ordering is derived from the input array. For the current
     fixtures (`o-1` inserted before `o-2`) both orders coincide, so no test breaks —
     but the semantics are not identical for arbitrary data.
  2. **Reduction becomes identity.** `effectivePaymentRecords` exists to collapse
     duplicate JSONL lines by id (latest wins). Under the Prisma PK there is at most one
     row per id, so the reduction is a no-op. Keeping it is harmless; removing it is
     also safe.
  3. **Storage location.** `payments` rows move from the JSONL data dir to Postgres;
     pre-existing JSONL data is not automatically visible (see Open questions).

**(e) If we defer `payments`, what is left?**
The rest of the legacy chain (`businesses`, `products`, `orders`) can migrate without
`payments`, because `payments` is the **leaf** (it depends on `orders` and `businesses`;
nothing depends on it). However, `verify-order.ts` couples an `orders` read with the
`payments` read/write, so deferring `payments` leaves the verification/callback path
(`server.ts:429`–`528`) on JSONL while the create path migrates — a legitimate but
mixed state. Deferring is **not** justified by reachability: `payments` has live
production callers (Part 2), so it is not production-dead.

---

## Part 4 — Intra-1k dependency order

Natural order follows the FK chain:

```
1. businesses   (no FK deps)
2. products     (FK → businesses)
3. orders       (FK → businesses, products)
4. payments     (FK → orders, businesses)   ← leaf
```

`verify-order.ts` reads `orders` and reads/writes `payments`, so it spans steps 3–4.

**Proposed decomposition:**

- **`1k.1` — `businesses` + `products` + `orders`:** convert `handleCreateBusiness`
  (260), `handleCreateProduct` (291/307), and `handleCreateOrder` (330/337/383/403) in
  `server.ts` to `deps.repos.*`. Ends green with the create path fully on Postgres.
- **`1k.2` — `payments` (+ `verify-order.ts`):** convert `server.ts:424/537/575` and
  change `verify-order.ts` (L47/51/92/147) to take `repos`. Isolates the only signature
  change, mirroring the 1j.1 pattern for `payment-events`.

An **atomic** alternative (all four in one step) is also workable — the surface is
small — but it bundles the `verify-order.ts` signature change with the create path,
giving a larger single diff to review.

---

## Part 5 — Test-side audit

Harness notes: repository tests use `withRollback(prisma, …)` (`test/db/helpers.ts`),
which runs inside an uncommitted Prisma transaction; route tests start a real HTTP
server via `createStorefrontServer` and seed through the **JSONL** store.

### `businesses`

| File                                      | Sites                                          | Kind of coupling                                             |
| ----------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `test/server.test.ts`                     | `store.insert("businesses", …)` L144, seed L93 | seeds JSONL, reads via route                                 |
| `test/store.test.ts`                      | L22/24/30/61/71/72                             | JsonlStore contract (generic `StubRecord` over `businesses`) |
| `test/verify-order.test.ts`               | `store.insert("businesses", …)` L63            | seeds JSONL                                                  |
| `test/db/repositories/businesses.test.ts` | whole file                                     | **repo-level** (Prisma, `withRollback`) — 3 tests            |

### `products`

| File                                    | Sites          | Kind of coupling             |
| --------------------------------------- | -------------- | ---------------------------- |
| `test/server.test.ts`                   | L145, seed L97 | seeds JSONL, reads via route |
| `test/store.test.ts`                    | L80/83         | JsonlStore contract          |
| `test/verify-order.test.ts`             | L64            | seeds JSONL                  |
| `test/db/repositories/products.test.ts` | whole file     | repo-level — 3 tests         |

### `orders`

| File                                  | Sites                                        | Kind of coupling                                |
| ------------------------------------- | -------------------------------------------- | ----------------------------------------------- |
| `test/server.test.ts`                 | L146, `readLatestById("orders", …)` L283/361 | seeds + asserts JSONL                           |
| `test/store.test.ts`                  | L36–47                                       | JsonlStore contract (latest-wins over `orders`) |
| `test/verify-order.test.ts`           | L65                                          | seeds JSONL                                     |
| `test/db/repositories/orders.test.ts` | whole file                                   | repo-level — 3 tests                            |

### `payments`

| File                                    | Sites                                                                      | Kind of coupling                                                          |
| --------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `test/reconcile-server.test.ts`         | `store.insert("payments", …)` L29                                          | seeds JSONL, asserts route output                                         |
| `test/server.test.ts`                   | `store.insert` L161; `readLatestById` L288/464/528/591/612; `readAll` L365 | seeds + asserts JSONL                                                     |
| `test/verify-order.test.ts`             | `store.insert` L81/149/253/342/366/391; `readAll` L122/214                 | seeds + asserts JSONL (direct `verifyOrder(store, …)` calls)              |
| `test/marketplace/store-kinds.test.ts`  | `store.insert("payments", …)` L62, `readLatestById` L64                    | **explicit "legacy store kinds stay compatible" guard**                   |
| `test/db/repositories/payments.test.ts` | whole file                                                                 | repo-level — 5 tests (insert/readLatestById/overwrite/list/findByOrderId) |

**Tests that assert the JSONL store directly for these kinds:** `server.test.ts`,
`verify-order.test.ts`, `reconcile-server.test.ts`, `store.test.ts`, and
`test/marketplace/store-kinds.test.ts`.

**Tests that hit routes / spawn the server:** `server.test.ts` and
`reconcile-server.test.ts` (both real HTTP). **No CLI test touches the four kinds** —
`test/cli/pilot-run.test.ts` has no `businesses|products|orders|payments` references.

**Store-contract tests that must stay untouched:** `test/marketplace/store-kinds.test.ts`
(explicitly asserts `payments` compatibility, L58–66) and `test/store.test.ts` (generic
`businesses`/`products`/`orders` behaviour). These pin the JSONL contract itself and are
out of scope for a migration.

---

## Part 6 — Breaking-change audit

**External (HTTP) contract:** unchanged. Every repository returns the same domain type
the JSONL path returned; `fromPrisma*` is the exact inverse of `toPrisma*` for the
current fixtures. Route bodies (`json.business`, `json.product`, `json.order`,
`json.payment`, `verification.payment`, `/reconcile` view, `/reconcile/merchant.csv`)
are therefore byte-identical for equivalent data.

**Real behavioural deltas introduced by a flip:**

1. **Storage location** — JSONL files vs Postgres. Existing JSONL data becomes invisible
   unless backfilled (owner question).
2. **`/reconcile` ordering** — `repos.payments.list()` returns `id asc`; JSONL returned
   append order. `buildReconcileView` preserves input order, so `results[]` order can
   differ for real data. `test/reconcile-server.test.ts` depends on `results[0].orderId`
   but seeds `o-1` before `o-2`, where id-asc and append order coincide, so it does not
   break. This is the one semantic (not test-visible) contract difference worth an
   explicit decision.
3. **`verify-order.ts` signature** — `store: JsonlStore` → `repos` (or repositories).
   Internal to the storefront; not a frozen file.

**Assertion churn if the flip is done (mechanical harness swaps, not contract
renegotiation):**

| File                            | Estimated edits                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `test/server.test.ts`           | `seedVerifyFixture` (L144–161) seeding + ~6 `ctx.store.*` assertion blocks (L282–291, 361–366, 463–467, 527–531, 590–594, 611–615) → ~12 sites                   |
| `test/verify-order.test.ts`     | `seedOrder` (L62–84) seeding + `paymentCount`/read sites (L122, 148, 214, 252, 341, 365, 390) + **every** `verifyOrder(store, …)` call site → ~15 tests affected |
| `test/reconcile-server.test.ts` | `startServer` seeding (L28–30) → 1 helper, 4 tests affected                                                                                                      |

Total on the order of **~25–30 mechanical edits across 3 files**, i.e. **>10** — which,
per the pre-flight guidance, is a signal to prefer a **split (B)** over atomic (A). The
edits are harness swaps (seed/read via repositories) rather than changes to asserted
contract values, and the already-present `test/db/repositories/*.test.ts` (Prisma,
`withRollback`) prove the repository surface behaves correctly.

**Smallest source change preserving the external contract:** replace the storage calls
inside the existing handlers only —

- `server.ts`: `260`, `291`, `307`, `330`, `337`, `383`, `403`, `424`, `537`, `575`;
- `verify-order.ts`: `47` (signature), `51`, `92`, `147`.

Keep handler signatures, HTTP responses, `RECONCILE_CONFIG`, and `buildReconcileView`
untouched. `effectivePaymentRecords` may stay (harmless no-op) or be removed once the
PK deduplicates; neither changes the response.

**Files that would require a ruling if touched:** none of the four tables' work needs
`src/ids.ts`, `marketplace/wallet.ts`, `marketplace/types.ts`, or core
`reconcilekit/src/**`. Those stay frozen; no flag required.

---

## Part 7 — Recommendation

**Recommendation: B — split into two ordered sub-steps.**

- **`1k.1`:** migrate `businesses` + `products` + `orders` to `repos.*` in `server.ts`.
- **`1k.2`:** migrate `payments` and convert `verify-order.ts` to `repos` (the only
  signature change; mirrors the 1j.1 `payment-events` conversion).

Rationale, all evidence-backed:

- **Not C/D (defer).** All four tables are production-alive (Part 2). The legacy
  Paystack routes (`POST /businesses|/products|/orders`, `POST …/verify`, `GET /callback`,
  `GET /reconcile`, `GET /reconcile/merchant.csv`) are wired by `main.ts` alongside the
  marketplace routes, so none of the four is production-dead. Deferral would leave the
  legacy chain permanently split across two stores.
- **Not A (atomic) as first choice.** >10 assertions change across 3 files (Part 6);
  the guidance treats that as a signal to split. Splitting also isolates the
  `verify-order.ts` signature change from the create path, keeping each diff reviewable
  and each state green — consistent with the established per-domain increments
  (1h.1–1h.4, 1j.1).
- **B is clean.** The FK chain is closed inside the four tables, ids are
  application-supplied, and the repositories already exist with `upsert`-based
  latest-wins semantics matching JSONL. The split line is the `orders`→`payments` leaf
  edge, which also matches the `verify-order.ts` read/write boundary.

A (atomic) remains acceptable if the owner prefers a single commit; the risk is a larger
review, not a correctness gap. The ordering question in Part 6 item 2 should be resolved
before `1k.2` regardless of A vs B.

---

## Open questions requiring owner ruling

1. **`/reconcile` ordering.** Preserve the JSONL append-order semantics for `results[]`
   (e.g. order the payment query by `recordedAt asc`), or accept `id asc`? This is a
   real (if currently test-invisible) contract difference. → affects `1k.2`.
2. **Backfill.** Is there live JSONL legacy data that must be copied into Postgres, or
   is Postgres greenfield for these tables (seed/demo only)? No backfill mechanism was
   found in scope.
3. **`metadata` round-trip.** Domain types it as `Record<string, string>`, but the JSON
   column permits non-string values. Confirm all writers store strings only (no
   historical JSONL records carry numbers/booleans/nesting that a JSON round-trip could
   surface differently).
4. **`effectivePaymentRecords`.** Keep the wrapper (harmless identity under the PK) or
   remove it as part of `1k.2`?
5. **FK strictness on write.** All four FKs are `onDelete: Restrict`. Confirm no orphan
   `orders`/`products` JSONL records exist (e.g. a product referencing a missing
   business) that would fail the FK when a backfill or replay inserts them.
6. **`verify-order.ts` signature.** Confirm changing `verifyOrder(store, …)` to take
   repositories is acceptable as a storefront-internal change (it is not a frozen file
   and not under core `reconcilekit/src/**`).

---

## Evidence log

- `git rev-parse --short HEAD` → `1b4022b`; `git status --porcelain -- reconcilekit/`
  → empty (clean).
- Schema: `prisma/schema.prisma` L546–616 (models `Business` 550, `Product` 562,
  `Order` 577, `Payment` 597); no `@@unique` on any of the four; all FKs
  `onDelete: Restrict`.
- Domain: `src/domain/types.ts` L7 (`Business`), 13 (`Product`), 22 (`Order`), 43
  (`PaymentRecord`); `OrderStatus` L3; `RefundStatus` L5.
- Store kinds: `src/store/jsonl-store.ts` L5/6/9/10 (`businesses`/`products`/`orders`/`payments`).
- `src` JSONL sites (grep `"(businesses|products|orders|payments)"`):
  `server.ts:260,291/292,307,330/331,337/338,383,403,424,537,575`;
  `verify-order.ts:51,92/93,147`; `db/smoke.ts:46–49` (table list); the rest are
  `jsonl-store.ts` union members and a `payments.ts` comment.
- Zero production consumers: grep for `repos\.(businesses|products|orders|payments)\b`
  in `src/**/*.ts` → no matches.
- Routing: `server.ts` `createStorefrontServer` L141, `handleRequest` L157,
  `handleCreateBusiness` L246, `handleCreateProduct` L264, `handleCreateOrder` L311,
  `handleVerifyOrder` L429, `handleCallback` L470, `handleReconcile` L530,
  `handleReconcileCsv` L570.
- `verify-order.ts`: `verifyOrder` L46, `store: JsonlStore` L47, `store.readLatestById`
  L51/L92, `store.insert("payments", …)` L147.
- `main.ts`: constructs `JsonlStore` + `buildRepositories(getPrismaClient())` and passes
  both plus `marketplace` deps to `createStorefrontServer`.
- Repositories: `businesses.ts` (upsert/findUnique), `products.ts` (upsert/findUnique),
  `orders.ts` (upsert/findUnique), `payments.ts` (upsert/findUnique/`list` id-asc/`findByOrderId` recordedAt-desc);
  `marketplace-payments.ts` is the separate `marketplace_payments` owner.
- Reduction: `src/reconcile/adapter.ts:33` `effectivePaymentRecords`; view
  `src/reconcile/view.ts:55` `buildReconcileView` maps `records` in input order;
  `RECONCILE_CONFIG` L13.
- CLI: `src/cli/` contains only `pilot-run.ts`; no legacy-kind usage; no `src/cli/index.ts`.
- Scripts: `start` = `node --env-file-if-exists=.env src/main.ts`; `pilot:run` =
  `node src/cli/pilot-run.ts`; `db:smoke` = `node src/db/smoke.ts`.
- Tests: `test/db/helpers.ts` `withRollback`; `test/store.test.ts`;
  `test/marketplace/store-kinds.test.ts` L58–66 (legacy-kind guard);
  `test/db/repositories/{businesses,products,orders,payments}.test.ts`.
