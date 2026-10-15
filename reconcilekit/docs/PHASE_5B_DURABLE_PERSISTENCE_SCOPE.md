# Phase 5B — Durable Persistence — Scope

**Project:** ReconcileKit (Core + Storefront)
**Type:** Track scoping document (planning deliverable — no implementation from this document alone)
**Date:** 2026-10-15
**Baseline authority:** `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (frozen)
**Parent:** `PHASE_5_OPENING.md` §3 (5B definition)
**Predecessor:** `PHASE_5A_CLOSURE.md`
**Goal sentence:** _let a production operator run the storefront against real Paystack events._

---

## 1. Scope

5B replaces the storefront's append-only JSONL store with a Postgres database
accessed through Prisma. It is storefront-only; it does not touch
`reconcilekit/src/**`.

Two increments:

| Increment                    | Deliverable                                                                                                   | What changes                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **5B.1** — Prisma + Postgres | Full schema; every store call site migrated; every test fixture migrated; CI updated with a Postgres service. | The `JsonlStore` interface is deleted. Store reads and writes go through Prisma or a repository layer.                   |
| **5B.2** — Redis sessions    | Session storage moves to Redis for lookup; Postgres retains a durable audit trail.                            | Session CRUD helpers change backend. The public API (`createSession`, `lookupSession`, `revokeSession`) keeps its shape. |

5B.1 is the track. 5B.2 is a smaller follow-on that depends on 5B.1's
data model being in place.

## 2. §14 procedure (written out)

### 2.1 Which freeze lines are reopened

- **§24** — "Persistence not part of MVP architecture; do not introduce
  PostgreSQL / Prisma / Redis / migrations."
- **§10** — "No premature DB/ORM" (implicit in the §24 language; the
  freeze treats the two as the same decision).
- **§10** — "No production infrastructure without a pilot finding"
  (implicit; opening 5B is itself the pilot finding's disposition).

### 2.2 What replaces §24

§24 is replaced with the following, to be recorded in the freeze when 5B.1
lands:

> **§24 (as amended):** Storefront persistence is a Postgres database
> accessed through Prisma. The database schema is the source of truth; the
> Prisma schema file (`storefront/prisma/schema.prisma`) is the schema's
> canonical declaration. Migrations are managed by Prisma Migrate; the
> generated SQL migration history is committed. Redis is introduced for
> session storage in 5B.2. The core package (`reconcilekit/`) remains
> persistence-free and retains its existing dependence on the filesystem
> for CLI I/O only.

### 2.3 Which invariants are preserved

The following frozen decisions are **not** touched by 5B:

- **§4.1** Provider-neutral boundary. Postgres is a storefront concern; the
  core is unchanged.
- **§4.2, §6** Payment / ledger / fulfillment truth separation. Each remains
  a distinct table with distinct semantics.
- **§4.3** Single matcher `reconcileRecords()`. The engine is untouched.
- **§4.4** Exact-reference matching only. Unchanged.
- **§4.5, §7** Wallet ledger authority and append-only semantics. The
  ledger becomes a real table with an append-only rule enforced at the
  application layer (no update or delete paths) and at the schema level
  (no `updated_at`, no soft-delete column).
- **§5** Identifier hierarchy. `mk_txn_…` remains the join anchor; no
  column's meaning changes.
- **The wallet-evidence tenant invariant.** `wallet_ledger` and
  `evidence_packs` gain no `org_id` column. Scoping flows through FK
  relations. See §3.4.

### 2.4 Why the current state is insufficient

Phase 5A landed two merchants' worth of auth and tenancy on a JSONL store.
The store works for a single process. It does not provide:

- **Durability across crashes.** A process kill mid-append can truncate the
  active line. `readAll` tolerates this; a real operator's data being silently
  dropped is a different matter.
- **Concurrent writers across processes.** `JsonlStore` serialises writes
  within a process; a second process (a webhook handler, a background job)
  would race.
- **Query patterns.** `readAll<T>(kind)` scans the whole file. Fine for
  demo volumes; not for a real operator.
- **Relationships.** Scoping tenancy through the customer boundary works
  because every record reachable from a customer is scoped transitively.
  Without foreign keys, nothing enforces that reachability.

The owner has decided that these are the correct reasons to reopen the
freeze's §24 prohibition.

### 2.5 Smallest change

"Smallest" is relative. The smallest change that delivers Path B is:

- One Prisma schema file, ~27 tables.
- One Prisma client instance, wired into `main.ts` and every test's server
  helper.
- Every `store.insert(...)`, `store.readAll(...)`, `store.readLatestById(...)`
  call site replaced with Prisma calls or repository calls.
- The `JsonlStore` class deleted, not kept as a fallback.
- CI: Postgres service added to the storefront job. The core job either
  stops running recursive tests or also gains a Postgres service.
- Local dev: `docker-compose.yml` for Postgres; `.env` gains
  `DATABASE_URL`.

There is no smaller version. Path B without the model redesign is Path A,
which the owner rejected.

### 2.6 Affected tests and contracts

**Production source in scope:**

- `storefront/src/store/jsonl-store.ts` — deleted.
- `storefront/src/marketplace/*.ts` — every file that touches the store.
- `storefront/src/auth/{sessions,identity}.ts` — session and user CRUD.
- `storefront/src/marketplace/tenancy.ts` — org, membership queries.
- `storefront/src/server.ts` — store wiring.
- `storefront/src/main.ts` — database connection setup.
- New: `storefront/src/db/` — Prisma client singleton, repository modules.

**Tests in scope:** approximately 40 files. Every test that constructs a
`JsonlStore` gets a Prisma-backed test helper. Every fixture that seeds
through `store.insert(...)` goes through Prisma. Every test that reads
back through `store.readAll(...)` reads through Prisma.

The following tests must **remain green after migration** — they encode
invariants, not implementation:

- All 5A auth tests (login flow, sessions, identity, route protection).
- All tenancy tests, especially `tenancy: no org dimension is fabricated
on wallet evidence`.
- All 3D tests.
- The wallet lifecycle tests, especially
  `wallet lifecycle: exact reconciliation joins on mk_txn, never on wld`.
- The evidence-pack tests.

The following tests change **only their setup**, not their assertions:

- All HTTP tests using `startSeededServer()` / `startFullySeededServer()`.

## 3. Design decisions

### 3.1 Prisma schema as the source of truth

`storefront/prisma/schema.prisma` declares every table, column, index, and
relation. `npx prisma migrate dev` generates SQL migrations under
`storefront/prisma/migrations/`, which are committed. `npx prisma generate`
produces the typed client.

This replaces the freeze's "no migrations as practice" line with "Prisma
Migrate is the migration tool; migration files are committed; the schema
file is the canonical declaration."

### 3.2 Table inventory

27 tables, grouped by domain. This is a target, not a commitment; the
actual schema lands in 5B.1's own PR.

**Identity and tenancy (5A):**

| Table           | Notes                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `users`         | id, email (unique), password_hash, display_name, created_at, updated_at                                                   |
| `sessions`      | id (token), user_id FK, active_org_id FK, created_at, expires_at, revoked_at. Index on user_id, active_org_id, expires_at |
| `organizations` | id, name, created_at                                                                                                      |
| `memberships`   | id, user_id FK, org_id FK, role, created_at. Unique on (user_id, org_id)                                                  |

**Marketplace core:**

| Table                           | Notes                                                                                                                                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `marketplace_customers`         | id, org_id FK, name, email, phone, is_demo, created_at. Index on org_id                                                                                                                                   |
| `marketplace_orders`            | id, customer_id FK, service_id, inputs (JSONB), amount_minor, currency, status, created_at                                                                                                                |
| `marketplace_transactions`      | id, order_id FK, customer_id FK, reference, scenario, payment_status, fulfillment_status, reconcile_outcome, resolution_status, customer_status, admin_status, demo_scenario_name, created_at, updated_at |
| `marketplace_provider_attempts` | id, transaction_id FK, provider_id, scenario, request_reference, provider_reference, status, canonical_status, amount_minor, currency, latency_ms, source_attributes (JSONB), attempted_at                |

**Wallet:**

| Table           | Notes                                                                                                                                                       |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `wallets`       | id, customer_id FK, currency, opening_balance_minor, status, created_at. **No org_id**                                                                      |
| `wallet_ledger` | id, wallet_id FK, transaction_id, type, amount_minor, currency, status, reference, occurred_at, metadata (JSONB). **No org_id**. Append-only by convention. |

**Evidence and reconciliation:**

| Table                | Notes                                                                                                                                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evidence_packs`     | id, transaction_id FK, customer_reference, provider_reference, service_snapshot (JSONB), amount_minor, currency, timeline_event_ids (text[]), provider_facts (JSONB), reconciliation (JSONB), mismatch_flags (text[]), resolution_status, audit_event_ids (text[]), created_at. **No org_id** |
| `transaction_events` | id, transaction_id FK, type, label, description, occurred_at, actor, source, metadata (JSONB)                                                                                                                                                                                                 |
| `receipts`           | id, transaction_id FK, evidence_pack_id FK, amount_minor, currency, issued_at                                                                                                                                                                                                                 |

**Resolution:**

| Table            | Notes                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------- |
| `refunds`        | id, transaction_id FK, amount_minor, currency, status, reason, initiated_at, completed_at, ledger_reference |
| `reversals`      | id, transaction_id FK, amount_minor, currency, status, reason, initiated_at, completed_at, ledger_reference |
| `disputes`       | id, transaction_id FK, customer_id FK, reason, status, message, created_at, updated_at, resolution_note     |
| `manual_reviews` | id, transaction_id FK, reason, status, assigned_to, created_at, resolved_at, operator_note                  |

**Artifacts:**

| Table                 | Notes                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ticket_artifacts`    | id, transaction_id FK, ticket_kind, reservation_reference, issue_reference, passenger_or_attendee, route_or_venue, seat, status, masked_code, issued_at, cancellation_reference, cancelled_at |
| `gift_card_artifacts` | id, transaction_id FK, brand, region, denomination_minor, currency, quantity, delivery_status, redemption_status, masked_code_preview, risk_flags (text[])                                    |

**Notifications:**

| Table           | Notes                                                               |
| --------------- | ------------------------------------------------------------------- |
| `notifications` | id, customer_id FK, transaction_id, title, body, status, created_at |

**Payment source layer:**

| Table            | Notes                                                                                                                                                                                                                                                                         |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `payment_events` | id, event_id, idempotency_key (unique), transaction_id, merchant_reference, payment_source, payment_source_reference, source_event_id, event_type, amount, currency, status, occurred_at, source_confidence, source_attributes (JSONB), observed_at. Index on idempotency_key |

**Catalog (read-mostly seed data):**

| Table                | Notes                                                                                                                                                          |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog_categories` | id, group, name, description, compliance_status, display_order                                                                                                 |
| `catalog_services`   | id, category_id FK, provider_id, kind, name, description, currency, base_amount_minor, compliance_status, fulfillment_type, availability, input_schema (JSONB) |
| `catalog_products`   | id, service_id FK, category_id FK, provider_id, name, description, kind, fulfillment_type, pricing (JSONB), availability, attributes (JSONB)                   |

**Legacy (frozen Phase 2C surface):**

| Table        | Notes                                                                                                                                         |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `businesses` | id, name, created_at                                                                                                                          |
| `products`   | id, business_id FK, name, price_minor, currency, created_at                                                                                   |
| `orders`     | id, business_id FK, product_id FK, customer_email, expected_amount_minor, currency, status, paystack_reference, authorization_url, created_at |
| `payments`   | id, order_id FK, business_id FK, expected_amount, currency, paystack_reference, status, paid_at, refund_status, metadata (JSONB), recorded_at |

### 3.3 Repository layer vs direct Prisma

**Recommendation: repository modules**, one per domain concept
(`UserRepository`, `SessionRepository`, `WalletLedgerRepository`, etc.),
wrapping the Prisma client.

Rationale: the existing call sites (`store.readAll<T>("marketplace_transactions")`)
map cleanly to a repository method (`transactions.listByCustomer(customerId)`).
Direct Prisma calls scattered across 15 files would be the same amount of
code but harder to test in isolation. The repository layer is a thin
abstraction — no caching, no lazy loading, no identity map — just typed
methods that wrap one or two Prisma queries.

This is a design choice, not a §14 decision; the scope records it as a
recommendation subject to override in 5B.1.

### 3.4 The wallet-evidence tenant invariant

`wallet_ledger` and `evidence_packs` gain **no `org_id` column**.
Scoping flows through the FK graph:

```
wallet_ledger.wallet_id
  → wallets.customer_id
    → marketplace_customers.org_id
```

Prisma relations express this directly. A scoped query looks like:

```ts
prisma.walletLedger.findMany({
  where: { wallet: { customer: { orgId } } },
});
```

Preserving this invariant means the freeze's §4.5 / §7 decision survives
unchanged. Reopening it — putting `org_id` on wallet evidence — would be
a separate §14 procedure. The owner did not reopen it in the 5B
authorization; the scope preserves the current decision.

### 3.5 Test infrastructure

Every test that touches the store moves to a real Postgres database, not a
mock, not SQLite, not `pg-mem`. Reasons:

- **SQLite-for-tests / Postgres-for-prod** would let schema drift ship
  silently.
- **`pg-mem`** does not implement enough of Postgres to test migrations,
  unique constraints on JSONB expressions, or transactional semantics.
- **Mocks** would test the code against itself.

The pattern:

- **CI:** GitHub Actions service container running `postgres:17`. The
  storefront job (and, see §3.6, possibly the core job) starts the
  service.
- **Local dev:** `docker-compose.yml` at the repo root provides Postgres
  and, once 5B.2 lands, Redis.
- **Test isolation:** each test file runs against the same database,
  wrapped in a transaction that is rolled back at the end. For the small
  number of tests that cannot use transactions (they exercise commit
  behaviour), a fresh schema per test.
- **Migration application:** `prisma migrate deploy` runs once before the
  test suite, not per test.

### 3.6 Core job scope

The core job currently runs `node --test` recursively from
`reconcilekit/`, which discovers `storefront/test/**`. After 5B.1, those
tests need a Postgres service. Two options:

- **Keep recursive** — the core job also starts Postgres. Simpler
  operationally, but couples the core job to the storefront's infrastructure.
- **Change the core test script** to `node --test src`, so the core job
  runs core tests only. The storefront job runs storefront tests. Cleaner
  separation.

**Recommendation: option 2.** The two packages are now genuinely
independent — the storefront has runtime dependencies the core does not,
and the tests reflect that. The "root 677" baseline becomes "core ~213 +
storefront 518"; the closure documents get updated.

This is a design choice, not a §14 decision.

### 3.7 Redis (5B.2)

5B.1 keeps sessions in Postgres. 5B.2 introduces Redis:

- **Redis as lookup store.** `createSession` writes to both Postgres
  (durable audit) and Redis (fast path). `lookupSession` reads Redis first,
  falls back to Postgres on cache miss. `revokeSession` writes to both.
- **TTL.** Redis handles session expiry naturally via `EXPIRE`.
- **Why keep Postgres.** Audit trail. Revoked and expired sessions remain
  queryable. The Postgres `sessions` table stays.

5B.2 is scoped separately. This document does not commit to its details.

## 4. Increment plan

### 5B.1 — Prisma + Postgres (large)

**Deliverable:** the storefront runs against Postgres. All tests pass. CI
is green with a Postgres service.

Sequenced sub-increments (each its own commit and gate):

- **5B.1a** — Prisma schema file, initial migration, client generation.
  No production code changes yet. A `db/smoke.ts` script proves the
  connection works.
- **5B.1b** — repository modules and their tests. Repositories exist but
  nothing uses them yet. Existing storefront still runs on `JsonlStore`.
- **5B.1c** — swap `main.ts` and `server.ts` to use repositories. The
  storefront runs on Postgres. Existing tests may still construct
  `JsonlStore` and fail; that is expected.
- **5B.1d** — migrate test fixtures. Every test file changes its setup.
  This is the largest single sub-increment. It may be split by test
  directory.
- **5B.1e** — delete `JsonlStore` and `jsonl-store.test.ts`. Sweep any
  stragglers.
- **5B.1f** — CI and Docker Compose. Postgres service in the storefront
  job; `docker-compose.yml` at the repo root; `.env.example` updated.

**Gate:** all standing guards green with Postgres. No `JsonlStore`
references remain anywhere in the tree.

### 5B.2 — Redis sessions (medium)

**Deliverable:** session lookup reads Redis first, falls back to Postgres.
Postgres remains the durable audit.

Scoped in its own document once 5B.1 lands.

## 5. Standing guard

After every 5B increment:

- Root tests: no regressions from the current baseline (the baseline
  changes when §3.6's decision lands; this document does not commit to a
  new number).
- Storefront tests: **518/518** or higher.
- Both typechecks: PASS.
- ESLint: PASS.
- Prettier `format:check`: PASS.
- CI: green on `ubuntu-latest` with Postgres service.
- Docker Compose: `docker compose up -d && npm test` succeeds from a
  fresh checkout.

## 6. What 5B does not authorize

- Deployment of Postgres to any hosted environment. The database runs
  locally or in CI; deploying it is a Phase 6 concern.
- Reopening the wallet-evidence invariant (§3.4 preserves it).
- Reopening any freeze §4.x besides §24.
- Any change to `reconcilekit/src/**`.
- 5C (webhooks) or 5D (second PSP adapter). 5C is now unblocked by 5B.1
  landing but still requires its own scope document.
- Redis before 5B.1 lands.
- Migrations against real data — there is no real data. The migration
  path is "reset, re-seed"; a data migration script would be premature.

## 7. Open questions

To be resolved in 5B.1's own PR, not blocking this scope:

- **Postgres version.** Recommendation: 17. Locked by Docker Compose and
  the CI service container.
- **Connection pool.** Prisma's built-in pool with default settings.
  Tuning is premature.
- **Migration workflow.** `prisma migrate dev` locally, `prisma migrate
deploy` in CI. Confirmed by §3.1.
- **How to expose the Prisma client.** Singleton in
  `storefront/src/db/client.ts`, injected via the existing dependency
  object pattern (`ServerDependencies`). This replaces the current
  `store: JsonlStore` with `db: PrismaClient` (or with the repository
  bundle).
- **Repository bundle shape.** One `Repositories` object with a field per
  domain concept, passed as a single dependency. Or per-module
  injection. Recommendation: single bundle, matches the current
  `MarketplaceTransactionDeps` pattern.

## 8. Status

**PHASE 5B SCOPED — Path B, PostgreSQL + Prisma in 5B.1, Redis in 5B.2.
§14 procedure written: freeze §24 reopened and replaced with the amended
language in §2.2; wallet-evidence invariant preserved per §3.4. Next
artifact: 5B.1a (Prisma schema + initial migration).**

Implementation begins only after this scope is agreed. Each 5B.1
sub-increment lands as its own commit with its own guard verification.
No sub-increment crosses a frozen boundary this scope has not already
documented.
