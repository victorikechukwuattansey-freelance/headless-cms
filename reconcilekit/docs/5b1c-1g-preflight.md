# 1g Pre-Flight

Read-only investigation. No src/, test/, or schema changes; no commits.
Scope tables: `marketplace_orders`, `marketplace_transactions`,
`marketplace_provider_attempts`, `marketplace_payments`.

Schema: `reconcilekit/storefront/prisma/schema.prisma`
Runtime: `reconcilekit/storefront/src/`

---

## Summary (one-line verdict)

**1g is safe to scope as a single increment** (all four tables live on one write
path and form a strict chain `orders → transactions → {provider_attempts,
payments}`), **provided the `marketplace_payments` piece is treated as the
final, separate commit** — it is the only table with a cross-model collision
(the shared legacy `payments` kind, Gap 2); everything else is a pure
store→repos repoint.

---

## Intra-1g migration order

FK-safety order (parents before children):

1. **`marketplace_orders`** — parent `marketplace_customers` (already on repos
   since 1b/1c; `seed.ts:156`).
2. **`marketplace_transactions`** — parents `marketplace_orders`,
   `marketplace_customers`.
3. **`marketplace_provider_attempts`** — parent `marketplace_transactions`.
4. **`marketplace_payments`** — parents `marketplace_transactions`,
   `marketplace_customers`.

So: `orders → transactions → {provider_attempts, payments}`.
(`provider_attempts` and `payments` are siblings; either order works.)

---

## Per-table analysis

Legend: **FK** = real constraint (`@relation`); **soft** = bare `String`
(no constraint). `onUpdate` is `Cascade` (Prisma default) everywhere; only
`onDelete` is explicit.

### marketplace_orders

Model `MarketplaceOrder` (`schema.prisma:121-138`), `@@map("marketplace_orders")`.

**FK list**

| source col    | target model          | target col | onDelete   | onUpdate          | kind            |
| ------------- | --------------------- | ---------- | ---------- | ----------------- | --------------- |
| `customer_id` | `MarketplaceCustomer` | `id`       | `Restrict` | Cascade (default) | **FK** (`:133`) |

Soft references: `service_id` (bare `String`, → catalog service id).

**Runtime write sites**

| file:line                              | function                                      | parent/child write at this site                                    | ordering                                                                                |
| -------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `src/marketplace/transactions.ts:1927` | `insertOrder` (via `beginTransaction` `:475`) | INSERT order; parent `marketplace_customers` (repos, pre-existing) | **parent-first** (customer on repos; order written before its child transaction `:537`) |
| `src/marketplace/transactions.ts:1894` | `persistOrderStatus`                          | UPDATE (status/updatedAt, latest-wins); reads own row `:1887`      | after transaction (called `:700` failure / success path)                                |

Parent persistence: customer via **repos**; order via **store (JSONL)**.

**Runtime read sites**

| file:line                              | function                     | method           |
| -------------------------------------- | ---------------------------- | ---------------- |
| `src/ui/client.ts:470`                 | `orderAmounts`               | `readLatestById` |
| `src/ui/client.ts:644`                 | `transactionDetailViewModel` | `readLatestById` |
| `src/ui/client.ts:783`                 | `ensureReceipt`              | `readLatestById` |
| `src/marketplace/transactions.ts:1888` | `persistOrderStatus`         | `readLatestById` |
| `src/marketplace/transactions.ts:2352` | `finishResult`               | `readLatestById` |
| `src/marketplace/transactions.ts:2450` | `replayResult`               | `readLatestById` |

Blocker: none (`marketplace_orders` only depends on `marketplace_customers`).

### marketplace_transactions

Model `MarketplaceTransaction` (`schema.prisma:140-177`),
`@@map("marketplace_transactions")`.

**FK list**

| source col    | target model          | target col | onDelete   | onUpdate          | kind            |
| ------------- | --------------------- | ---------- | ---------- | ----------------- | --------------- |
| `order_id`    | `MarketplaceOrder`    | `id`       | `Restrict` | Cascade (default) | **FK** (`:158`) |
| `customer_id` | `MarketplaceCustomer` | `id`       | `Restrict` | Cascade (default) | **FK** (`:159`) |

Soft references: `service_id` (bare), `provider_id` (bare). `reference` is
`@unique` (not a FK).

**Runtime write sites**

| file:line                              | function                          | parent/child write at this site                                                                                                                      | ordering                                                                                                               |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/marketplace/transactions.ts:537`  | `beginTransaction` (`initial`)    | INSERT transaction; **child** writes nearby: `transaction_events` `:488/:505` (1f), order `:475`; and this row is a **parent** for attempts/payments | order `:475` before transaction `:537` ✓; **events `:488/:505` before transaction `:537` ✗** (see Child-before-parent) |
| `src/marketplace/transactions.ts:1877` | `persistTransaction`              | INSERT/UPDATE final state (latest-wins)                                                                                                              | after the initial row                                                                                                  |
| `src/marketplace/reconcile.ts:252`     | `reconcileMarketplaceTransaction` | UPDATE (reconcileOutcome/customerStatus/adminStatus)                                                                                                 | after evidence pack `:251`; parent row read `:142` (pre-exists)                                                        |
| `src/marketplace/resolution.ts:137`    | `updateResolutionStatus`          | UPDATE (resolutionStatus/updatedAt)                                                                                                                  | after the child record in every resolution flow                                                                        |
| `src/marketplace/seed.ts:226`          | `seedOrderScenario`               | UPDATE (`demoScenarioName`)                                                                                                                          | after execute + reconcile                                                                                              |

Parent persistence: order/customer via **store**/repos respectively; all
transaction writes via **store (JSONL)**.

**Runtime read sites**

| file:line                                         | function                          | method                                    |
| ------------------------------------------------- | --------------------------------- | ----------------------------------------- |
| `src/ui/client.ts:354` (via `latestTransactions`) | `findTransactionByIdentifier`     | `readAll` + hand-rolled latest-wins `Map` |
| `src/ui/client.ts:1046`                           | `findingsSummaryViewModel`        | `readAll` + `latestTransactionMap`        |
| `src/marketplace/transactions.ts:466`             | `beginTransaction` (replay guard) | `readLatestById`                          |
| `src/marketplace/transactions.ts:2391`            | `marketplaceTransactionFacts`     | `readLatestById`                          |
| `src/marketplace/reconcile.ts:143`                | `reconcileMarketplaceTransaction` | `readLatestById`                          |
| `src/marketplace/resolution.ts:72`                | `requireTransaction`              | `readLatestById`                          |
| `src/marketplace/ticketing.ts:156`                | `cancelTicketTransaction`         | `readLatestById`                          |
| `src/marketplace/seed.ts:218`                     | `seedOrderScenario`               | `readLatestById`                          |

Blocker: depends on `marketplace_orders` (must migrate in the same increment,
orders first).

### marketplace_provider_attempts

Model `MarketplaceProviderAttempt` (`schema.prisma:179-199`),
`@@map("marketplace_provider_attempts")`.

**FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:195`) |

Soft references: `service_id` (bare), `provider_id` (bare).

**Runtime write sites**

| file:line                              | function                | parent/child write at this site       | ordering                                                                                                 |
| -------------------------------------- | ----------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/marketplace/transactions.ts:1984` | `recordProviderAttempt` | INSERT attempt (child of transaction) | **parent-first** — called from `runPaymentAndFulfillment` (:547), transaction row already written `:537` |

Parent persistence: **store (JSONL)**.

**Runtime read sites**

| file:line                              | function                      | method                                        |
| -------------------------------------- | ----------------------------- | --------------------------------------------- |
| `src/ui/client.ts:411`                 | `latestAttempt`               | `readAll` + hand-rolled `.filter`             |
| `src/marketplace/transactions.ts:2398` | `marketplaceTransactionFacts` | `readAll` + hand-rolled `.filter`             |
| `src/marketplace/transactions.ts:2454` | `replayResult`                | `readAll` + hand-rolled `.filter`             |
| `src/marketplace/reconcile.ts:86`      | `readEvidenceFacts`           | `readAll` + hand-rolled `.filter` + `.at(-1)` |

Blocker: depends on `marketplace_transactions` (same increment).

### marketplace_payments

Model `MarketplacePayment` (`schema.prisma:201-223`),
`@@map("marketplace_payments")`.

**FK list**

| source col       | target model             | target col | onDelete   | onUpdate          | kind            |
| ---------------- | ------------------------ | ---------- | ---------- | ----------------- | --------------- |
| `transaction_id` | `MarketplaceTransaction` | `id`       | `Restrict` | Cascade (default) | **FK** (`:216`) |
| `customer_id`    | `MarketplaceCustomer`    | `id`       | `Restrict` | Cascade (default) | **FK** (`:217`) |

Soft references: `order_id` (bare `String @map("order_id")`, indexed, **no
relation**) → `marketplace_orders.id`; `wallet_reference` (bare) →
`wallet_ledger`; `provider_reference` (bare). This `order_id` being a bare
column is the Gap 2 soft reference.

**Runtime write sites**

**None.** `marketplace_payments` is **not a JSONL `StoreKind`** (`jsonl-store.ts`
`:4-33` lists `marketplace_orders`/`marketplace_transactions`/
`marketplace_provider_attempts` but **not** `marketplace_payments`), and the
only mention in `src/` is `smoke.ts:50` (`EXPECTED_TABLES`). Today the
`MarketplacePaymentRecord` is written to the **shared legacy `payments` kind**:

| file:line                             | function                   | note                                                                                                                           | ordering                   |
| ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| `src/marketplace/transactions.ts:658` | `runPaymentAndFulfillment` | `store.insert("payments", toWalletPaymentRecord(debit.evidence, orderId))` — the de-facto future `marketplace_payments` writer | after transaction `:537` ✓ |

Parent persistence: **store (JSONL)** (`payments` kind).

**Runtime read sites**

The table is read via the `payments` kind, filtered to `MarketplacePaymentRecord`:

| file:line                              | function                      | method                                   |
| -------------------------------------- | ----------------------------- | ---------------------------------------- |
| `src/ui/client.ts:648`                 | `transactionDetailViewModel`  | `readAll` + hand-rolled `.find(orderId)` |
| `src/marketplace/transactions.ts:2401` | `marketplaceTransactionFacts` | `readAll` + hand-rolled `.find(orderId)` |
| `src/marketplace/transactions.ts:2456` | `replayResult`                | `readAll` + hand-rolled `.find(orderId)` |
| `src/marketplace/resolution.ts:88`     | `requirePayment`              | `readAll` + hand-rolled `.find(orderId)` |

The repo `MarketplacePaymentRepository` already exists
(`src/db/repositories/marketplace-payments.ts`) with `insert`,
`readLatestById`, `findByOrderId` — **unused**. Its own doc-comment flags the
Gap 2 repoint as 5B.1c/5B.1e work.

Blocker: depends on `marketplace_transactions`; plus the Gap 2 kind split
(legacy `Payment` model keeps the `payments` table; marketplace records move to
`marketplace_payments`).

---

## Child-before-parent ordering

**Finding (flagged): `transaction_events` written before their parent
`marketplace_transactions`.**
`src/marketplace/transactions.ts:beginTransaction` pushes `ORDER_CREATED`
(`:488`) and `QUOTE_RECORDED` (`:505`) events via `appendTransactionEvent`
**before** the transaction row is inserted at `:537`. The event rows FK to
`marketplace_transactions.id`.

- Classification: **1f blocker, not a 1g blocker.** `transaction_events` is a
  1f table; during 1g alone the events still land in the JSONL store (no FK), so
  nothing fails. The violation only materialises in 1f, once events move to
  Postgres with the FK enforced.
- Recommendation: fix the order in **1g** opportunistically (move the
  `marketplace_transactions` insert above the two `appendTransactionEvent`
  calls). It is behaviour-preserving — event ids are `buildEventId(txnId, seq)`
  and `seq` is derived from the existing count, not from write order — so it is
  safe to do early and spares 1f a latent FK failure.

**No other child-before-parent ordering found within 1g scope:**

- order `:475` → transaction `:537` → attempts `:1984` / payment `:658`: all
  parent-first. ✓
- `reconcile.ts` writes the evidence pack `:251` then _updates_ the transaction
  `:252`; the transaction already exists (read `:142`), so this is a
  parent-then-update, not a violation. ✓
- `resolution.ts:137` updates the parent _after_ its child record — intentional
  latest-wins state propagation, parent row pre-exists. ✓

---

## Stale-test inventory (per file, counts)

All counts are **store reads/writes of the four scope tables** that will stop
seeing data once the tables move to Postgres. No direct `prisma.*` writes to any
of the four tables exist in `test/` (grep: 0 matches).

| file                                        | count | lines (kind · method)                                                                                                     | effect when table moves                                                                            |
| ------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `test/marketplace/demo-scenarios.test.ts`   | 1     | `:93` orders · `readLatestById`                                                                                           | **FAIL** (expects non-null)                                                                        |
| `test/marketplace/findings.test.ts`         | 2     | `:267`,`:285` transactions · `readAll`                                                                                    | **silently weakens** (deepEqual `[]` vs `[]`)                                                      |
| `test/marketplace/gift-card.test.ts`        | 4     | `:145`,`:322` attempts · `readAll`; `:308` transactions · `readAll`+filter; `:367` transactions · `readLatestById`        | **FAIL**                                                                                           |
| `test/marketplace/input-validation.test.ts` | 2     | `:57` attempts · `readAll`; `:61` orders · `readAll`                                                                      | **FAIL** (counts expected > 0)                                                                     |
| `test/marketplace/reconcile.test.ts`        | 2     | `:70` attempts · `readAll` (via `snapshotRows`); `:120` transactions · `readLatestById`                                   | `:70` **silently weakens**; `:120` **FAIL**                                                        |
| `test/marketplace/resolution.test.ts`       | 1     | `:77` transactions · `readLatestById`                                                                                     | **FAIL**                                                                                           |
| `test/marketplace/seed.test.ts`             | 1     | `:118` transactions · `readLatestById`                                                                                    | **FAIL**                                                                                           |
| `test/marketplace/store-kinds.test.ts`      | 3     | `:44` transactions · `insert`; `:47` · `readLatestById`; `:51` · `readAll`                                                | **NOT stale** — unit test of the JSONL store's generic behaviour (writes/reads the store directly) |
| `test/marketplace/ticketing.test.ts`        | 4     | `:101`,`:483` attempts · `readAll`+filter; `:236` transactions · `readAll`; `:317` transactions · `readLatestById`        | `:236` **silently weakens** (`length===0` vacuous); `:101`,`:483`,`:317` **FAIL**                  |
| `test/marketplace/transactions.test.ts`     | 3     | `:68` attempts · `readAll`; `:83` orders · `readLatestById`; `:896` transactions · `readAll`+filter                       | **FAIL**                                                                                           |
| `test/marketplace/wallet-lifecycle.test.ts` | 6     | `:420`,`:461`,`:476` attempts · `readAll`; `:439` transactions · `readLatestById`; `:464`,`:479` transactions · `readAll` | **FAIL**                                                                                           |

**Totals:** 29 store touch-points across 11 files. **`store-kinds.test.ts` is the
only non-stale file** (direct store unit test). The genuine stale set is **26
touch-points across 10 files** (29 minus `store-kinds`'s 3 = 26,
of which **4 silently weaken** rather than fail:
`findings.test.ts:267/285`, `reconcile.test.ts:70`, `ticketing.test.ts:236`.

Hard-coded filters (child-of-nothing checks that will read empty):

- `gift-card.test.ts:309` `(row as { id: string }).id === first.transaction.id`
- `transactions.test.ts:897` `(record as { id: string }).id === first.transaction.id`
- `ticketing.test.ts:101` `(row as { transactionId: string }).transactionId === …`

---

## MarketplaceTransactionDeps shape

Defined in `src/marketplace/transactions.ts:81-86`:

```ts
export interface MarketplaceTransactionDeps {
  readonly store: JsonlStore;
  readonly repos: Repositories;
  readonly registry: MarketplaceProviderRegistry;
  readonly catalog: MarketplaceCatalog;
}
```

- Carries `repos: Repositories`? **YES.**
- Carries `store: JsonlStore`? **YES.**
- Other fields to change for 1g? **None.** The shape is already correct; 1g only
  switches the four tables' call sites from `store` to `repos`. `store` stays
  (still used for `transaction_events`, `evidence_packs`, `receipts`, artifacts,
  `payments` until 1f and the Gap 2 split). Constructed at `main.ts:42-47` and
  `seed.ts:315` as `{ store, repos, registry, catalog }`.

---

## MarketplaceReconcileDeps shape

Defined in `src/marketplace/reconcile.ts:34-37`:

```ts
export interface MarketplaceReconcileDeps {
  readonly store: JsonlStore;
  readonly catalog: MarketplaceCatalog;
}
```

- Carries `repos: Repositories`? **NO.**
- Carries `store: JsonlStore`? **YES.**
- **Must change in 1g: add `repos: Repositories`.** `reconcile.ts` currently
  uses `store` for two 1g tables — `marketplace_transactions`
  (read `:143`, update `:252`) and `marketplace_provider_attempts` (read `:86`).
  Its other `store` uses are 1f/out-of-scope (`evidence_packs` writes/reads,
  `transaction_events`, `ticket_artifacts`/`gift_card_artifacts` `:101-104`).
- `truth.ts` is **pure** (no I/O — confirmed: its only "store" occurrences are
  comments at `:35,:165`), so the 1f pre-flight's note that "truth.ts uses store
  for marketplace_transactions" is **not the case**; the transaction read lives
  in `reconcile.ts:143`. No change needed in `truth.ts`.
- Constructed at `seed.ts:316` as `{ store, catalog }` (and in tests via a
  `reconcileDeps(store)` helper) — both must gain `repos`.

---

## Recommended 1g scope

- **Intra-1g order:** `marketplace_orders` → `marketplace_transactions` →
  `{marketplace_provider_attempts, marketplace_payments}`.
- **Tests to update in the same commit (stale readers):**
  `demo-scenarios.test.ts` (1), `findings.test.ts` (2, weaken-only),
  `gift-card.test.ts` (4), `input-validation.test.ts` (2),
  `reconcile.test.ts` (2, one weaken-only), `resolution.test.ts` (1),
  `seed.test.ts` (1), `ticketing.test.ts` (4, one weaken-only),
  `transactions.test.ts` (3), `wallet-lifecycle.test.ts` (6).
  **Exclude `store-kinds.test.ts`** (JSONL-store unit test — keep as-is).
- **src ordering fix required in 1g:** move the `marketplace_transactions` insert
  (`transactions.ts:537`) above the two `appendTransactionEvent` calls
  (`:488`/`:505`). Strictly a 1f blocker, but cheap and safe to land in 1g so 1f
  does not inherit an FK violation. No other ordering fix needed in 1g.
- **Also required in 1g:** widen `MarketplaceReconcileDeps` with `repos` and
  repoint `reconcile.ts:143/:252/:86` (and the `reconcileDeps(...)` test helper).
- **Verdict:** **one increment is fine**, but sequence it as
  (1) orders + transactions + provider_attempts (pure repoint), then
  (2) **`marketplace_payments` as its own commit** — it is the only piece that
  splits the shared legacy `payments` kind (Gap 2) and must leave the `Payment`
  model / `payments` table untouched. If the payments split looks larger than
  expected during implementation, split it out to **1g-b** rather than expanding
  the core commit.
