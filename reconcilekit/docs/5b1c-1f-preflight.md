# 1f Pre-Flight

Read-only investigation. No code, test, or schema changes were made.
Scope tables: `transaction_events`, `evidence_packs`, `receipts`, `refunds`,
`reversals`, `disputes`, `manual_reviews`.

Schema source: `reconcilekit/storefront/prisma/schema.prisma`
Runtime source: `reconcilekit/storefront/src/`

---

## Summary

- All seven scope tables already have **repositories scaffolded in 5B.1a**
  (`src/db/repositories/{transaction-events,evidence-packs,receipts,refunds,reversals,disputes,manual-reviews}.ts`).
  **No production caller uses any of them yet** — every write still goes through
  the JSONL store (`store.insert("<kind>", ...)`).
- **Every one of the seven tables carries a hard FK to `marketplace_transactions`**
  (`onDelete: Restrict`). `marketplace_transactions` is **still JSONL-only**
  (written in `seed.ts`, `transactions.ts`, `reconcile.ts`, `resolution.ts`; no
  repos writer). Since a Postgres FK requires the parent row to exist first, all
  seven tables are **blocked on 1g**.
- `receipts` has a second FK to `evidence_packs` (intra-1f).
  `disputes` has a second FK to `marketplace_customers` (already on repos →
  unblocked).
- **Ordering anomaly found (1f work item):** `transactions.ts:beginTransaction`
  appends `transaction_events` at **:488/:505** but inserts the parent
  `marketplace_transactions` row at **:537** — the child is written _before_ the
  parent. Harmless under append-only JSONL; **would violate the FK under Postgres**
  and must be reordered during 1f.
- **Recommended order: 1g before 1f.** 1f is blocked on 1g; running 1f first
  would require dual-writing or skipping FK enforcement.

---

## Per-table analysis

Legend for relations:

- **FK** = real constraint (`@relation`, appears in `migration.sql` foreign keys).
- **soft** = bare `String`/`String[]` column that semantically points at another
  model but has no constraint.
- `onUpdate` is `Cascade` (Prisma default) for every relation below; only
  `onDelete` is explicit in the schema.

### transaction_events

Model `TransactionEvent` (`schema.prisma:290-305`), `@@map("transaction_events")`.

**1. Schema FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:301`) |

No soft references.

**2. Runtime caller list**

Single write funnel: `appendTransactionEvent()` → `store.insert("transaction_events", event)`.

| write site                                                            | parent row                    | parent persisted via | parent before/after child |
| --------------------------------------------------------------------- | ----------------------------- | -------------------- | ------------------------- |
| `src/marketplace/timeline.ts:88` (in `appendTransactionEvent`, `:69`) | `marketplace_transactions.id` | **store (JSONL)**    | see callers below         |

43 call sites funnel here (`reconcile.ts:197,211`; `resolution.ts:213,228,302,383,398,480,549,617,685`; `ticketing.ts:241`; `transactions.ts:488,505,629,663,679,723,740,758,868,1030,1049,1067,1237,1258,1301,1318,1436,1464,1480,1507,1523,1561,1599,1617,1635,1654,1674,1772,1784,1796,1807`).

Parent ordering by caller group:

- `transactions.ts:beginTransaction` — **ANOMALY**: events `:488`/`:505` written
  **before** the transaction row is inserted at `:537` (order row inserted `:475`).
- `reconcile.ts` — transaction pre-exists (read `:142`); events `:197`/`:211`
  written before the evidence pack (`:251`).
- `resolution.ts` — transaction pre-exists (`requireTransaction`, `:71`);
  events written **after** the child record (e.g. refund `:210` → events `:213`,`:228`).
- `transactions.ts` fulfilment paths (`:629` onward) — transaction already
  inserted at `:537` (or read for replay).
- `ticketing.ts:241` — transaction read at `:156` first.

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.
- Additional 1f item: fix the `:488/:505` → `:537` ordering so the parent row is
  durable before its events.

### evidence_packs

Model `EvidencePack` (`schema.prisma:267-288`), `@@map("evidence_packs")`.

**1. Schema FK list**

| source col                | target model             | target col | onDelete   | onUpdate          | kind            |
| ------------------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` (unique) | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:284`) |

Soft references (no constraint):

| source col                        | points at                                          | kind            |
| --------------------------------- | -------------------------------------------------- | --------------- |
| `provider_reference`              | provider attempt reference / external provider ref | soft            |
| `payment_reference`               | payment record reference                           | soft            |
| `timeline_event_ids` (`String[]`) | `transaction_events.id`                            | soft (id array) |
| `audit_event_ids` (`String[]`)    | `wallet_ledger` audit entries                      | soft (id array) |

**2. Runtime caller list**

Single writer: `reconcile.ts:251` → `store.insert("evidence_packs", pack)`
(in `reconcileMarketplaceTransaction`, `:136`).

| write site                         | parent row                    | parent persisted via | parent before/after child                                                          |
| ---------------------------------- | ----------------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `src/marketplace/reconcile.ts:251` | `marketplace_transactions.id` | **store (JSONL)**    | parent read `:142` (pre-exists) → **before**; parent then _updated_ `:252` (after) |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.

### receipts

Model `Receipt` (`schema.prisma:307-320`), `@@map("receipts")`.

**1. Schema FK list**

| source col         | target model             | target col | onDelete   | onUpdate          | kind            |
| ------------------ | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id`   | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:315`) |
| `evidence_pack_id` | `EvidencePack`           | `id`       | `Restrict` | Cascade (default) | **FK** (`:316`) |

No soft references.

**2. Runtime caller list**

Single writer: `receipts.ts:61` → `store.insert("receipts", record)` (in
`issueReceipt`, `:55`). Sole caller: `ui/client.ts:793` (`ensureReceipt`).

| write site                                                       | parent rows                                                      | parent persisted via                                               | parent before/after child                      |
| ---------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `src/marketplace/receipts.ts:61` (caller `src/ui/client.ts:793`) | `marketplace_transactions.id`; `evidence_packs.id` (`evp_<txn>`) | **store (JSONL)** both (transaction read `:777`; pack read `:787`) | **before** (both read prior to `issueReceipt`) |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.
- `evidence_pack_id` → `evidence_packs`: **intra-1f** (write the pack first).

### refunds

Model `Refund` (`schema.prisma:326-341`), `@@map("refunds")`.

**1. Schema FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:337`) |

Soft references:

| source col                     | points at                 | kind |
| ------------------------------ | ------------------------- | ---- |
| `ledger_reference` (`String?`) | `wallet_ledger.reference` | soft |

**2. Runtime caller list**

Writers: `resolution.ts:210` (`initiateTransactionRefund`), `resolution.ts:299`
(`completeTransactionRefund`).

| write site                          | parent row                    | parent persisted via                                       | parent before/after child                              |
| ----------------------------------- | ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| `src/marketplace/resolution.ts:210` | `marketplace_transactions.id` | **store (JSONL)** (`requireTransaction` `:67` reads `:71`) | **before** (read first); parent updated `:211` (after) |
| `src/marketplace/resolution.ts:299` | `marketplace_transactions.id` | **store (JSONL)**                                          | **before**; parent updated `:300` (after)              |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.
- `ledger_reference` → `wallet_ledger`: soft only; source of truth (`wallet_ledger`)
  is on repos since 1e; no FK to satisfy.

### reversals

Model `Reversal` (`schema.prisma:343-358`), `@@map("reversals")`.

**1. Schema FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:354`) |

Soft references:

| source col                     | points at                 | kind |
| ------------------------------ | ------------------------- | ---- |
| `ledger_reference` (`String?`) | `wallet_ledger.reference` | soft |

**2. Runtime caller list**

Writer: `resolution.ts:380` (`reverseTransactionDebit`).

| write site                          | parent row                    | parent persisted via | parent before/after child                               |
| ----------------------------------- | ----------------------------- | -------------------- | ------------------------------------------------------- |
| `src/marketplace/resolution.ts:380` | `marketplace_transactions.id` | **store (JSONL)**    | **before** (read `:350`); parent updated `:381` (after) |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.
- `ledger_reference` → `wallet_ledger`: soft only (1e done).

### disputes

Model `Dispute` (`schema.prisma:360-377`), `@@map("disputes")`.

**1. Schema FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:371`) |
| `customer_id`    | `MarketplaceCustomer`    | `id`       | `Restrict` | Cascade (default) | **FK** (`:372`) |

No soft references.

**2. Runtime caller list**

Writers: `resolution.ts:477` (`openDispute`), `resolution.ts:537` (`resolveDispute`).

| write site                          | parent rows                                               | parent persisted via                                                                                       | parent before/after child                        |
| ----------------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/marketplace/resolution.ts:477` | `marketplace_transactions.id`; `marketplace_customers.id` | transaction: **store (JSONL)** (read `:444`); customer: **repos (Postgres)** (`seed.ts:156`), pre-existing | **before** (both); parent updated `:478` (after) |
| `src/marketplace/resolution.ts:537` | `marketplace_transactions.id`; `marketplace_customers.id` | transaction: **store** (read `:516`); customer: **repos**, pre-existing                                    | **before**; parent updated `:542` (after)        |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.
- `customer_id` → `marketplace_customers`: **unblocked** (repos since 1b/1c;
  writer `seed.ts:156` `repos.marketplaceCustomers.insert`).

### manual_reviews

Model `ManualReview` (`schema.prisma:379-393`), `@@map("manual_reviews")`.

**1. Schema FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:389`) |

No soft references.

**2. Runtime caller list**

Writers: `resolution.ts:614` (`markManualReview`), `resolution.ts:673`
(`resolveManualReview`).

| write site                          | parent row                    | parent persisted via | parent before/after child                               |
| ----------------------------------- | ----------------------------- | -------------------- | ------------------------------------------------------- |
| `src/marketplace/resolution.ts:614` | `marketplace_transactions.id` | **store (JSONL)**    | **before** (read `:592`); parent updated `:615` (after) |
| `src/marketplace/resolution.ts:673` | `marketplace_transactions.id` | **store (JSONL)**    | **before** (read `:653`); parent updated `:678` (after) |

**3. Blocker analysis**

- `transaction_id` → `marketplace_transactions`: **blocked on 1g**.

---

## Blocker matrix

| #   | FK (table.col)                      | target                        | classification           | note                   |
| --- | ----------------------------------- | ----------------------------- | ------------------------ | ---------------------- |
| 1   | `transaction_events.transaction_id` | `marketplace_transactions.id` | **blocked on 1g**        | parent JSONL-only      |
| 2   | `evidence_packs.transaction_id`     | `marketplace_transactions.id` | **blocked on 1g**        | unique (1:1)           |
| 3   | `receipts.transaction_id`           | `marketplace_transactions.id` | **blocked on 1g**        |                        |
| 4   | `receipts.evidence_pack_id`         | `evidence_packs.id`           | **intra-1f**             | pack must land first   |
| 5   | `refunds.transaction_id`            | `marketplace_transactions.id` | **blocked on 1g**        |                        |
| 6   | `refunds.ledger_reference`          | `wallet_ledger.reference`     | **blocked on 1e** (soft) | no constraint; 1e done |
| 7   | `reversals.transaction_id`          | `marketplace_transactions.id` | **blocked on 1g**        |                        |
| 8   | `reversals.ledger_reference`        | `wallet_ledger.reference`     | **blocked on 1e** (soft) | no constraint; 1e done |
| 9   | `disputes.transaction_id`           | `marketplace_transactions.id` | **blocked on 1g**        |                        |
| 10  | `disputes.customer_id`              | `marketplace_customers.id`    | **unblocked**            | repos since 1b/1c      |
| 11  | `manual_reviews.transaction_id`     | `marketplace_transactions.id` | **blocked on 1g**        |                        |

Soft refs internal to `evidence_packs` (no constraint, advisory only):
`provider_reference`, `payment_reference`, `timeline_event_ids[]`,
`audit_event_ids[]`.

Counts: **9 blocked on 1g** (incl. the 7 hard `transaction_id` FKs),
**1 intra-1f** (`receipts.evidence_pack_id`), **1 unblocked**
(`disputes.customer_id`), **2 soft / 1e-referencing** (`refunds`/`reversals`
`ledger_reference`).

---

## Recommended order (1f vs 1g)

**Run 1g before 1f.**

Every scope table has a hard FK to `marketplace_transactions`, which is still
JSONL-only. If 1f migrated its tables to Postgres first, each row insert would
require a `marketplace_transactions` parent that does not yet exist in Postgres
(even where the writer already read it from JSONL). Running 1f first would force
dual-writes or temporary FK deferral — both out of scope.

Corrected dependency order:

1. **1e** — `wallets`, `wallet_ledger` (done).
2. **1g** — `marketplace_transactions`, `marketplace_orders`,
   `marketplace_payments`, `marketplace_provider_attempts` (unblocks the parent).
3. **1f** — this increment. Intra-1f topological order (parents first):
   1. `transaction_events` (parent: transaction)
   2. `evidence_packs` (parent: transaction)
   3. `receipts` (parents: transaction, **evidence_packs**)
   4. `refunds`, `reversals`, `manual_reviews` (parent: transaction)
   5. `disputes` (parents: transaction, customer)

Notable 1f work items captured by this pre-flight:

- Reorder `transactions.ts:beginTransaction` so the transaction row is inserted
  before its `transaction_events` (currently events `:488/:505` precede the row
  `:537`).
- Preserve resolution semantics where the parent `marketplace_transactions` row
  is _updated_ after each child write (`resolution.ts:137`); the update must
  remain a repos write, not a JSONL one.
