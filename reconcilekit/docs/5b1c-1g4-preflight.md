# 1g.4 Pre-Flight (payments vs marketplace_payments)

Read-only investigation. No code, test, or schema changes; no commits.
Scope: resolve the `payments` vs `marketplace_payments` split (handoff
decision #5, Gap 2) and decide whether 1g.4 is a distinct increment.

Working dir for all commands: `reconcilekit/storefront`.

---

## Summary

**Verdict (a)** — 1g.4 is a distinct increment: repoint the five
marketplace payment call sites from the JSONL `payments` kind onto the
already-landed `MarketplacePaymentRepository` (`marketplace_payments`
table). The collision asked about in §7 **is real** (both record shapes
share the `payments.jsonl` kind), but it does **not** require a prior
kinds-split (verdict c) and is **not** evidence for deferral (verdict b):
the repoint _is_ the separation, and the repository, table, and tests for
it already exist. One caveat is flagged: decision #5's wording
("repoint is 5B.1c → 5B.1e") is ambiguous about _timing_, and grep cannot
settle a schedule — it settles scope only.

---

## Schema — both models

Both models exist. `Prisma Payment` and `Prisma MarketplacePayment` are
distinct (`prisma/schema.prisma`).

### `MarketplacePayment` (schema.prisma:201-223)

```prisma
model MarketplacePayment {
  id                  String    @id
  transactionId       String    @map("transaction_id")
  orderId             String    @map("order_id")
  customerId          String    @map("customer_id")
  walletReference     String    @map("wallet_reference")
  providerReference   String?   @map("provider_reference")
  expectedAmountMinor Int       @map("expected_amount_minor")
  actualAmountMinor   Int?      @map("actual_amount_minor")
  currency            String
  status              String
  paidAt              DateTime? @map("paid_at") @db.Timestamptz(6)
  metadata            Json
  recordedAt          DateTime  @map("recorded_at") @db.Timestamptz(6)

  transaction MarketplaceTransaction @relation(fields: [transactionId], references: [id], onDelete: Restrict)
  customer    MarketplaceCustomer    @relation(fields: [customerId], references: [id], onDelete: Restrict)

  @@index([transactionId])
  @@index([orderId])
  @@index([customerId])
  @@map("marketplace_payments")
}
```

- Table: `marketplace_payments`.
- Outbound relations: `transactionId → marketplace_transactions.id`
  (Restrict), `customerId → marketplace_customers.id` (Restrict).
- Distinguishing fields vs `Payment`: `transactionId`, `customerId`,
  `walletReference`, `expectedAmountMinor`, `actualAmountMinor`,
  `providerReference` (nullable). No `businessId`, no `paystackReference`,
  no `refundStatus`. `order_id` is **not** unique.

### `Payment` (schema.prisma:597-616)

```prisma
model Payment {
  id                String    @id
  orderId           String    @map("order_id")
  businessId        String    @map("business_id")
  expectedAmount    Int       @map("expected_amount")
  currency          String
  paystackReference String    @map("paystack_reference")
  status            String
  paidAt            DateTime? @map("paid_at") @db.Timestamptz(6)
  refundStatus      String    @map("refund_status")
  metadata          Json
  recordedAt        DateTime  @map("recorded_at") @db.Timestamptz(6)

  order    Order    @relation(fields: [orderId], references: [id], onDelete: Restrict)
  business Business @relation(fields: [businessId], references: [id], onDelete: Restrict)

  @@index([orderId])
  @@index([businessId])
  @@map("payments")
}
```

- Table: `payments`.
- Outbound relations: `orderId → orders.id` (Restrict),
  `businessId → businesses.id` (Restrict).
- Distinguishing fields vs `MarketplacePayment`: `businessId` (required),
  `paystackReference` (required, NOT NULL since the
  `20261016094131_payments_reference_not_null` migration),
  `refundStatus`, `expectedAmount` (no `_minor` suffix). No
  `transactionId`, no `customerId`, no wallet fields.

**Answer:** both models exist. `MarketplacePayment` was created by
migration `20261015231236_marketplace_gap_fixes` (`migration.sql:23`);
`Payment` by `20261015162346_initial` (`migration.sql:406`).

---

## JSONL store — kind collision

`src/store/jsonl-store.ts` (lines 4-65):

```ts
export type StoreKind =
  | "businesses"
  | "products"
  | "users"
  | "sessions"
  | "orders"
  | "payments" // <-- only payment-like kind
  | "marketplace_customers"
  | "marketplace_catalog"
  | "catalog_categories"
  | "catalog_services"
  | "catalog_products"
  | "marketplace_orders"
  | "marketplace_transactions"
  | "marketplace_provider_attempts"
  | "wallets"
  | "wallet_ledger"
  | "transaction_events"
  | "evidence_packs"
  | "receipts"
  | "refunds"
  | "reversals"
  | "disputes"
  | "manual_reviews"
  | "notifications"
  | "ticket_artifacts"
  | "gift_card_artifacts"
  | "organizations"
  | "memberships"
  | "payment_events";
```

```ts
const KIND_FILE_NAMES: Readonly<Record<StoreKind, string>> = {
  ...
  payments: "payments.jsonl",
  ...
};
```

- Is `payments` a valid kind? **Yes**; file `payments.jsonl`.
- Is `marketplace_payments` a valid kind? **No** — it is absent from both
  the `StoreKind` union and `KIND_FILE_NAMES`. There is no
  `marketplace-payments.jsonl`.
- Does the store distinguish the two record shapes? **No.** `payments` is
  the only payment-like kind, and the store is untyped at rest
  (`readAll<T>(kind)` is a caller-supplied cast). Both
  `MarketplacePaymentRecord` and the legacy `PaymentRecord` are written to
  and read from the single `payments.jsonl` file. The kind is **overloaded**.

The repository layer already separates them, however:

| Repository                                                   | File                                          | Table                  | Record type                                                 | Wired?                  |
| ------------------------------------------------------------ | --------------------------------------------- | ---------------------- | ----------------------------------------------------------- | ----------------------- |
| `PaymentRepository` (`repos.payments`)                       | `src/db/repositories/payments.ts`             | `payments`             | `PaymentRecord` (`src/domain/types.ts`)                     | yes — `index.ts:63,102` |
| `MarketplacePaymentRepository` (`repos.marketplacePayments`) | `src/db/repositories/marketplace-payments.ts` | `marketplace_payments` | `MarketplacePaymentRecord` (`src/marketplace/types.ts:321`) | yes — `index.ts:54,91`  |

Both repos carry an explicit "Do not merge" note
(`payments.ts:5-9`, `marketplace-payments.ts:19-20`), and each has its own
unit test (`test/db/repositories/payments.test.ts`,
`test/db/repositories/marketplace-payments.test.ts`).

`payments.ts` is **legacy Paystack only**. `marketplace_payments.ts` is the
marketplace target and its docstring already names the pending repoint:

```text
* NOTE — new kind, not yet in StoreKind. This repo targets the
* `marketplace_payments` Prisma table (created by the addendum migration)
* while the JSONL store still writes to the legacy `payments` kind. The
* repoint of the five marketplace call sites (`resolution.ts:87`,
* `transactions.ts:2400/2455`, `client.ts:654`, plus the write at
* `transactions.ts:656`) is 5B.1c / 5B.1e. ...
```

---

## Writes to `payments` (per site)

```text
Get-ChildItem src -Recurse -Filter *.ts | Select-String -Pattern 'insert\("payments"|insert<[^>]*>\("payments"'
```

| file:line                             | function                   | runtime type written                                                                                                     | code path                |
| ------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| `src/server.ts:423`                   | `handleCreateOrder`        | `PaymentRecord` (legacy; `orderId`/`paystackReference`/`refundStatus` present)                                           | legacy Paystack checkout |
| `src/application/verify-order.ts:147` | `verifyOrder`              | `PaymentRecord` (legacy; `candidate` built from Paystack verification)                                                   | legacy Paystack verify   |
| `src/marketplace/transactions.ts:656` | `runPaymentAndFulfillment` | `MarketplacePaymentRecord` (`toWalletPaymentRecord(debit.evidence, orderId)`, declared at `:809`/`:954`/`:1162`/`:2293`) | marketplace checkout     |

So the single `payments.jsonl` file receives **both** shapes today: two
legacy writers and one marketplace writer.

---

## Writes to `marketplace_payments` (per site)

```text
Get-ChildItem src -Recurse -Filter *.ts | Select-String -Pattern 'marketplace_payments|marketplacePayments|MarketplacePayment'
```

Result: the only references are the repository itself plus its wiring.

- `src/db/repositories/marketplace-payments.ts` — defines
  `MarketplacePaymentRepository` (`insert` → `client.marketplacePayment.upsert`,
  `readLatestById`, `findByOrderId`).
- `src/db/repositories/index.ts:21,54,91` — import, field, construction.
- `src/db/smoke.ts:50` — `"marketplace_payments"` appears in the expected-
  tables list (table-existence smoke check only; writes nothing).

**There are ZERO production write sites to `marketplace_payments`.**
`repos.marketplacePayments.insert` is called only from the repository unit
test (`test/db/repositories/marketplace-payments.test.ts`), inside a
`withRollback` transaction. Conclusion: the `marketplace_payments` table
is created and empty; no schema default or migration populates it (both
migrations only `CREATE TABLE` / add indexes + FKs). Marketplace payment
data currently lives **only** in `payments.jsonl`.

Observation (non-blocking): the `MarketplacePayment` schema has no
`simulated` column, but `MarketplacePaymentRecord.simulated` is required
(`types.ts:335`). `fromPrismaPayment` hardcodes `simulated: true`
(`marketplace-payments.ts:121`) and `toPrismaPayment` drops it — same
literal-not-stored pattern as Gap 3 for orders.

---

## Reads (per site, both kinds)

```text
Get-ChildItem src -Recurse -Filter *.ts | Select-String -Pattern '"payments"'
```

### JSONL `payments` kind — marketplace shape (`MarketplacePaymentRecord`)

| file:line                              | function                         | note                                                                                                                                                                                                                 |
| -------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/marketplace/resolution.ts:86`     | `requirePayment(store, orderId)` | `readAll<MarketplacePaymentRecord>("payments")` then `.find(c => c.orderId === orderId)`; called at `:181` (`initiateTransactionRefund`) and `:351` (`reverseTransactionDebit`) — both already have `repos` in scope |
| `src/marketplace/transactions.ts:2394` | `marketplaceTransactionFacts`    | `readAll<MarketplacePaymentRecord>("payments")` then `find(orderId)`                                                                                                                                                 |
| `src/marketplace/transactions.ts:2446` | `replayResult`                   | `readAll<MarketplacePaymentRecord>("payments")` then `find(orderId)`                                                                                                                                                 |
| `src/ui/client.ts:636`                 | `transactionDetailViewModel`     | `readAll<MarketplacePaymentRecord>("payments")` then `find(orderId)`                                                                                                                                                 |

These are exactly the five sites named in the repo docstring
(`resolution.ts`, `transactions.ts:2394/2446`, `client.ts`, plus the write
at `transactions.ts:656`).

### JSONL `payments` kind — legacy shape (`PaymentRecord`)

| file:line                            | function             | note                                           |
| ------------------------------------ | -------------------- | ---------------------------------------------- |
| `src/server.ts:536`                  | `handleReconcile`    | `readAll<PaymentRecord>("payments")`           |
| `src/server.ts:574`                  | `handleReconcileCsv` | `readAll<PaymentRecord>("payments")`           |
| `src/application/verify-order.ts:93` | `verifyOrder`        | `readLatestById<PaymentRecord>("payments", …)` |

Legacy Paystack path (`server.ts`, `application/verify-order.ts`) still
reads/writes the JSONL kind; `repos.payments` has **zero production
callers** (grep `repos\.payments` → only the `index.ts:63` declaration).

---

## Test inventory

```text
Get-ChildItem test -Recurse -Filter *.ts | Select-String -Pattern '"payments"|"marketplace_payments"'
```

### JSONL `payments` kind — marketplace shape

| file:line                                               | helper / test                                                                            | reads                                           | source      |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------- |
| `test/marketplace/transactions.test.ts:84` (`:88`)      | `paymentForOrder(store, orderId)`                                                        | `readAll<MarketplacePaymentRecord>("payments")` | JSONL store |
| `test/marketplace/reconcile.test.ts:66` (`:72`)         | `snapshotRows(store, repos)`                                                             | `readAll("payments")`                           | JSONL store |
| `test/marketplace/gift-card.test.ts:336`                | test "gift card replay is idempotent…" (leak scan)                                       | `readAll("payments")`                           | JSONL store |
| `test/marketplace/wallet-lifecycle.test.ts:455`, `:470` | test "reconciliation never causes provider side effects" (before/after snapshot objects) | `readAll("payments").length`                    | JSONL store |

### JSONL `payments` kind — legacy shape

| file:line                                                       | helper / test                                  | reads/writes                                                       | source      |
| --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------ | ----------- |
| `test/reconcile-server.test.ts:29`                              | `startServer(seed?: readonly PaymentRecord[])` | `insert("payments", record)`                                       | JSONL store |
| `test/server.test.ts:161`                                       | `seedVerifyFixture`                            | `insert("payments", payment)` (`payment: PaymentRecord` at `:148`) | JSONL store |
| `test/server.test.ts:288`, `:464`, `:528`, `:591`, `:612`       | server handler tests                           | `readLatestById<PaymentRecord>("payments", order.id)`              | JSONL store |
| `test/server.test.ts:365`                                       | —                                              | `readAll<PaymentRecord>("payments")`                               | JSONL store |
| `test/verify-order.test.ts:81`                                  | —                                              | `insert("payments", payment)`                                      | JSONL store |
| `test/verify-order.test.ts:122`                                 | `paymentCount(store)`                          | `readAll<PaymentRecord>("payments").length`                        | JSONL store |
| `test/verify-order.test.ts:149`, `:253`, `:342`, `:366`, `:391` | —                                              | `readLatestById<PaymentRecord>("payments", ORDER_ID)`              | JSONL store |
| `test/verify-order.test.ts:214`                                 | —                                              | `readAll<PaymentRecord>("payments")`                               | JSONL store |

### Generic / non-shape-specific

| file:line                                        | helper / test                                              | note                                                                                             | source      |
| ------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------- |
| `test/marketplace/store-kinds.test.ts:62`, `:64` | "jsonl store keeps existing legacy store kinds compatible" | `StubRecord { id, value }` — generic kind-compatibility probe, **not** a payment of either shape | JSONL store |

### Repository-level (not JSONL)

| file                                                | covers                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| `test/db/repositories/payments.test.ts`             | `repos.payments` (legacy, `payments` table)                |
| `test/db/repositories/marketplace-payments.test.ts` | `repos.marketplacePayments` (`marketplace_payments` table) |

No test references the JSONL kind `"marketplace_payments"` (it is not a
valid kind).

---

## Collision analysis

**Is the `payments` kind overloaded? Yes.** `payments.jsonl` holds both
`PaymentRecord` and `MarketplacePaymentRecord`.

- **Can one file hold both shapes without corruption or type confusion?**
  At rest, yes mechanically — the store persists opaque JSON and casts on
  read, so nothing crashes. But the two shapes are **not disjoint**:
  shared keys are `id`, `orderId`, `currency`, `status`, `paidAt`,
  `metadata`, `recordedAt`. Worse, both paths name the record after the
  order (`PaymentRecord.id = order.id`; `MarketplacePaymentRecord.id =
orderId ?? transactionId`), so the id namespaces are **not** separated by
  construction. A `readAll<MarketplacePaymentRecord>("payments")` would
  happily cast a legacy row to the marketplace type, leaving
  `transactionId`/`customerId`/`walletReference`/`expectedAmountMinor`
  `undefined`. That is latent type confusion, not a crash — currently
  invisible because the legacy (`server.ts`) and marketplace
  (`ui/client.ts`) readers run against different stores/configs in
  practice.
- **Do they read from separate files today?** No — one file,
  `payments.jsonl`.
- **Does the `marketplace_payments` table already have data / a writer?**
  No. Zero production writers (§4); the only writes are the repo unit test
  inside a rolled-back transaction. No migration or seed inserts rows.
  The table is created and empty.
- **Is any mixed data checked into the repo?** No. The only `*.jsonl` file
  on disk is `storefront/data/payment-events.jsonl`; no `payments.jsonl`
  fixture exists.

**Consequence:** the repoint in 1g.4 removes marketplace writes/reads from
the shared kind, so `payments.jsonl` becomes legacy-only going forward.
That _resolves_ the overload for the marketplace side; it does not require
a pre-emptive kinds split. The legacy side (`payments.jsonl` +
`repos.payments`) is a separate concern: `repos.payments` exists with zero
production callers, i.e. the legacy repoint has not started either — that
is the "5B.1e" half of decision #5's wording, not 1g work.

---

## Recommendation

**Verdict (a): 1g.4 is a distinct increment — migrate the marketplace
payment calls off the JSONL `payments` kind onto `repos.marketplacePayments`.**

Evidence:

1. The target repository already exists, is wired, and is unit-tested with
   exactly the required surface: `insert` (`upsert`), `readLatestById`,
   `findByOrderId` (`marketplace-payments.ts:42,50,59`).
2. Exactly five marketplace call sites remain on the JSONL `payments`
   kind, grep-confirmed, and they match the repo docstring's own list:
   `resolution.ts:86` (+ callers `:181`, `:351`), `transactions.ts:656`
   (write), `transactions.ts:2394`, `transactions.ts:2446`,
   `client.ts:636`.
3. `marketplace_payments` has zero production writers, so the repoint is
   genuinely pending, not already done elsewhere.
4. The overload is real (§7) but is **not** a prerequisite for a split —
   the repoint performs the separation for the marketplace side.

Caveat (flagged, not resolved by grep): decision #5 says "repoint is
5B.1c → 5B.1e", and the repo docstring repeats "5B.1c / 5B.1e". Grep
settles **scope**, not **schedule**. If the intent of #5 is that the
_legacy_ Paystack `payments` kind moves as part of 5B.1e, that is
consistent with verdict (a): 1g.4 handles the marketplace half now, and
the `payments` StoreKind stays in place until the legacy half migrates.
Verdict (b) (defer 1g.4 to 5B.1e entirely) is not supported by evidence —
the five sites are marketplace-path sites in the same family as the
1g.1/1g.2/1g.3 kinds, and their target repo is already staged. Verdict (c)
is not required — no pre-emptive split is needed.

**Prerequisites / risks for 1g.4 (verify during implementation, not
assumed here):**

- FK ordering: `marketplace_payments.transaction_id → marketplace_transactions.id`
  and `customer_id → marketplace_customers.id`. The transaction row is
  written earlier in the same flow (inserted in 1g.2); the customer is
  seeded. Under Postgres the payment insert now requires both to exist.
  The write at `transactions.ts:656` runs after that insert, so ordering
  should hold — but it must be verified, and any test that reached this
  site without a persisted transaction/customer would fail on FK.
- Semantic difference on read: current marketplace reads use
  `.find(c => c.orderId === o)` (first match in file order); the repo's
  `findByOrderId` orders `recordedAt desc` ("latest write wins"). For the
  single-row-per-order invariant this is equivalent, but the change in
  match semantics should be stated, not silent.
- Repo `insert` is an upsert (append-latest-wins), matching the other
  migrated kinds; confirm this is intended for payments (same class as the
  open D2 question for wallet-ledger).
- `simulated` is not persisted (§4 observation) — pre-existing, not a 1g.4
  blocker.
- Test-store topology: four marketplace test helpers currently read the
  JSONL store; moving them to `repos.marketplacePayments` means tests that
  run against module-level committed `repos` (rather than `withRollback`)
  will need before/after deltas or transaction scoping — the same class of
  adjustment approved for `input-validation.test.ts` in 1g.3. Identify
  which files are affected before editing.

---

## Suggested 1g.4 scope (verdict a)

**Source (4 files):**

| file                                          | change                                                                                                                                                                                                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/marketplace/resolution.ts`               | `requirePayment(store, orderId)` → `requirePayment(repos, orderId)`, body → `repos.marketplacePayments.findByOrderId(orderId)`; call sites `:181`, `:351` pass `repos` (both functions already hold `repos`)                                                                                    |
| `src/marketplace/transactions.ts`             | write `:656` `store.insert("payments", paymentRecord)` → `repos.marketplacePayments.insert(paymentRecord)` (use `deps.repos`, as `debitWallet` does at `:644`); reads `:2394` (`marketplaceTransactionFacts`) and `:2446` (`replayResult`) → `repos.marketplacePayments.findByOrderId(orderId)` |
| `src/ui/client.ts`                            | `:636` → `deps.repos.marketplacePayments.findByOrderId(transaction.orderId)`                                                                                                                                                                                                                    |
| `src/db/repositories/marketplace-payments.ts` | docstring only — drop the "not yet in StoreKind / repoint is pending" note now that the repoint lands                                                                                                                                                                                           |

**Tests (4 files, marketplace-shape readers only):**
`test/marketplace/transactions.test.ts` (`paymentForOrder`),
`test/marketplace/reconcile.test.ts` (`snapshotRows` payments row),
`test/marketplace/gift-card.test.ts` (leak scan),
`test/marketplace/wallet-lifecycle.test.ts` (snapshot fields) → read via
`repos.marketplacePayments`. **Leave** `test/marketplace/store-kinds.test.ts`
(generic legacy kind probe).

**Out of scope (legacy half / 5B.1e):** `src/server.ts:423/536/574`,
`src/application/verify-order.ts:93/147`, `repos.payments` repoint, and the
legacy-shape tests (`reconcile-server.test.ts`, `server.test.ts`,
`verify-order.test.ts`, `db/repositories/payments.test.ts`). The `payments`
StoreKind is **not** removed by 1g.4.

**Blockers:** none identified. Prerequisites to verify are listed above.

---

## Report

1. File created: `reconcilekit/docs/5b1c-1g4-preflight.md`
2. Verdict: **(a)** — 1g.4 is a distinct increment (repoint the five
   marketplace payment sites to `repos.marketplacePayments`), with the
   timing caveat on decision #5's wording flagged.
3. Key grep evidence: 5 remaining marketplace call sites on the JSONL
   `payments` kind (`resolution.ts:86`, `transactions.ts:656/2394/2446`,
   `client.ts:636`); zero production writers to `marketplace_payments`
   (`repos.marketplacePayments` appears only in the repo + wiring +
   `smoke.ts:50`); `marketplace_payments` absent from `StoreKind`.
4. Suggested scope: 4 source files + 4 test files (table above); legacy
   Paystack path and the `payments` StoreKind remain for 5B.1e.
5. JSONL `payments` kind overloaded: **yes** — `PaymentRecord` (legacy
   Paystack: `server.ts`, `application/verify-order.ts`) **and**
   `MarketplacePaymentRecord` (marketplace: `transactions.ts`, read by
   `resolution.ts`, `client.ts`) share `payments.jsonl`.
