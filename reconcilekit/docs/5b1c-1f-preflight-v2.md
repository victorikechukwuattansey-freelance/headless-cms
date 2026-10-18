# 1f Pre-Flight v2

**Summary:** 1f is unblocked (1g closed); the 7 scope tables carry **12 hard FKs** (9 of them to `marketplace_transactions`); audit result is **0 BROKEN-value sites, 2 BROKEN-ordering sites (both fixed by the already-ruled `beginTransaction` reorder), 1 RISKY site (`receipts` pack-existence)**; recommended decomposition is **4 sub-increments**.

**Provenance.** Read-only investigation. No `src/`, `test/`, or schema changes; no commits. Line numbers are grep-derived against HEAD `b772ad9` (docs commit) whose code tree is `43d96c8`. Where v1 and the tree disagree, the tree wins (anti-instruction: grep is authoritative).

---

## Part 1 — Full FK graph (per table)

Source: `prisma/schema.prisma:267-393` and `prisma/migrations/*/migration.sql` (constraint lines quoted below; both agree).

| table                | FK column          | → target                      | nullable? | index / unique on source   | onDelete / onUpdate | kind |
| -------------------- | ------------------ | ----------------------------- | --------- | -------------------------- | ------------------- | ---- |
| `transaction_events` | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |
| `evidence_packs`     | `transaction_id`   | `marketplace_transactions.id` | no        | **`@unique`** (1:1)        | Restrict / Cascade  | FK   |
| `receipts`           | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |
| `receipts`           | `evidence_pack_id` | `evidence_packs.id`           | no        | **none**                   | Restrict / Cascade  | FK   |
| `refunds`            | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |
| `reversals`          | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |
| `disputes`           | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |
| `disputes`           | `customer_id`      | `marketplace_customers.id`    | no        | `@@index([customerId])`    | Restrict / Cascade  | FK   |
| `manual_reviews`     | `transaction_id`   | `marketplace_transactions.id` | no        | `@@index([transactionId])` | Restrict / Cascade  | FK   |

Migration confirmation (all 9):

```
ALTER TABLE "transaction_events"  ADD CONSTRAINT "transaction_events_transaction_id_fkey"  FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "evidence_packs"      ADD CONSTRAINT "evidence_packs_transaction_id_fkey"      FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipts"            ADD CONSTRAINT "receipts_transaction_id_fkey"            FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "receipts"            ADD CONSTRAINT "receipts_evidence_pack_id_fkey"          FOREIGN KEY ("evidence_pack_id") REFERENCES "evidence_packs"("id")          ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds"             ADD CONSTRAINT "refunds_transaction_id_fkey"             FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reversals"           ADD CONSTRAINT "reversals_transaction_id_fkey"           FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes"            ADD CONSTRAINT "disputes_transaction_id_fkey"            FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disputes"            ADD CONSTRAINT "disputes_customer_id_fkey"               FOREIGN KEY ("customer_id")      REFERENCES "marketplace_customers"("id")    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "manual_reviews"      ADD CONSTRAINT "manual_reviews_transaction_id_fkey"      FOREIGN KEY ("transaction_id")   REFERENCES "marketplace_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Soft references (no constraint, nothing to satisfy at insert):**

| table            | column                 | points at                             |
| ---------------- | ---------------------- | ------------------------------------- |
| `evidence_packs` | `provider_reference`   | provider attempt reference            |
| `evidence_packs` | `payment_reference`    | payment record reference              |
| `evidence_packs` | `timeline_event_ids[]` | `transaction_events.id` (array)       |
| `evidence_packs` | `audit_event_ids[]`    | `wallet_ledger` audit entries (array) |
| `refunds`        | `ledger_reference`     | `wallet_ledger.reference`             |
| `reversals`      | `ledger_reference`     | `wallet_ledger.reference`             |
| `manual_reviews` | `assigned_to`          | operator identity (bare string)       |

**Not a FK:** every one of the 7 tables also carries a `simulated` field in its _domain type_ but has **no `simulated` column in the schema**; the repositories accept the field and ignore it, and `fromPrisma*` re-synthesises `simulated: true`. Consistent across all 7 — same shape as the already-recorded Gap 3. No action.

**Non-nullable string columns that are not FKs but are NOT NULL** (empty string would not fail, but is a data-quality hazard): `evidence_packs.customer_reference`, `receipts.currency`, `refunds.currency`/`status`/`reason`, `reversals.*`, `disputes.reason`/`status`/`message`, `manual_reviews.reason`/`status`, and every `label`/`description`/`type` on `transaction_events`. Audited in Part 2 only where a caller can produce `""`.

---

## Part 2 — Write-site value audit

Grep provenance (all write sites for the 7 tables, `src/` only):

```
src\marketplace\receipts.ts:61      await store.insert("receipts", record);
src\marketplace\reconcile.ts:259    await store.insert("evidence_packs", pack);
src\marketplace\resolution.ts:207   await store.insert("refunds", refund);
src\marketplace\resolution.ts:296   await store.insert("refunds", completed);
src\marketplace\resolution.ts:377   await store.insert("reversals", reversal);
src\marketplace\resolution.ts:475   await store.insert("disputes", dispute);
src\marketplace\resolution.ts:536   await store.insert("disputes", resolved);
src\marketplace\resolution.ts:614   await store.insert("manual_reviews", review);
src\marketplace\resolution.ts:674   await store.insert("manual_reviews", resolved);
src\marketplace\timeline.ts:88      await store.insert("transaction_events", event);
```

There are **10 write sites**, and **no `repos.<table>.insert` caller** exists for any of the 7 (anti-instruction honoured: not trusting v1's list; v1 also missed the paired _reads_ below).

### transaction_events

Single funnel: `timeline.ts:69` `appendTransactionEvent(store, input)` → `store.insert("transaction_events", event)` at `:88`. **43 call sites** funnel here.

FK value: `transactionId: input.transactionId` — `AppendTransactionEventInput.transactionId` is `readonly transactionId: string` (required, non-optional; `timeline.ts:59`). Never derived from an optional source.

Parent: `marketplace_transactions` — on repos since 1g.2.

| call site                                                                                                                                                                                                                                                     | parent persisted first?                                                                            | class                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| `transactions.ts:486` and `:503` (`executeMarketplaceTransaction` → `beginTransaction`)                                                                                                                                                                       | **NO** — appends precede the parent insert at `:535`                                               | **BROKEN (ordering)** |
| `reconcile.ts:205`, `:219`                                                                                                                                                                                                                                    | yes — tx read at `:142` from repos                                                                 | CLEAN                 |
| `resolution.ts:210`, `:225`, `:299`, `:380`, `:395`, `:478`, `:548`, `:686`                                                                                                                                                                                   | yes — `requireTransaction` (`resolution.ts:67`) reads from repos in every enclosing function       | CLEAN                 |
| `ticketing.ts:239`                                                                                                                                                                                                                                            | yes — tx read at `:156`                                                                            | CLEAN                 |
| `transactions.ts` fulfilment block (`:627`, `:664`, `:680`, `:724`, `:741`, `:759`, `:869`, `:1031`, `:1050`, `:1068`, `:1238`, `:1259`, `:1302`, `:1319`, `:1437`, `:1465`, `:1481`, `:1508`, `:1524`, `:1562`, `:1600`, `:1618`, `:1636`, `:1655`, `:1675`) | yes — all run after the parent insert at `:535` (same call, or replay path which reads `:465-469`) | CLEAN                 |
| `transactions.ts:1774`, `:1786`, `:1798`, `:1809` (helpers returning an event)                                                                                                                                                                                | yes — invoked from the fulfilment/replay paths                                                     | CLEAN                 |

Evidence for the sole BROKEN group (`transactions.ts:484-535`):

```ts
484:   const queued: TransactionEvent[] = [];
485:   queued.push(
486:     await appendTransactionEvent(store, {          // <-- child write #1
487:       transactionId,
...
502:   queued.push(
503:     await appendTransactionEvent(store, {          // <-- child write #2
504:       transactionId,
...
520:   const initial = buildTransactionRecord({ ... });
535:   await deps.repos.marketplaceTransactions.insert(initial);   // <-- parent write
```

**Fix (already ruled, scoped in Part 3):** move the two `appendTransactionEvent` calls to after `:535` in the same sub-increment that migrates `transaction_events`.

**Second, non-ordering risk on this table (report, do not fix blind):** `timeline.ts:74-77` derives the event id from a **read**:

```ts
74:   const existing = await listTransactionEvents(store, input.transactionId);
75:   const seq = existing.length + 1;
76:   const event: TransactionEvent = { id: buildEventId(input.transactionId, seq), ... };
```

Under JSONL this was a single-process in-memory read. Under Postgres it becomes read-then-write, and `TransactionEventRepository.insert` is an **upsert keyed on `id`** — two appends that compute the same `seq` would silently overwrite (one event lost). The id _format_ is frozen (`ids.ts:80`, protected file), so any hardening must be transactional, not an id change. Compare 1g.3: `buildProviderAttemptId(transactionId, attemptNumber)` (`ids.ts:58`, used at `transactions.ts:1967`) takes a provider-supplied number, **not** a count read — so this pattern is genuinely new to `transaction_events`. Severity is arguable (read-modify-write races are already endemic and accepted in 1g: `resolveWallet`, `updateResolutionStatus` spread-updates, `requireX`-then-insert). **Ruling requested for 1f.1:** (a) inherit 1g's accepted semantics and document it, or (b) wrap appends in a DB transaction. Not a blocker either way.

### evidence_packs

Single writer: `reconcile.ts:259` in `reconcileMarketplaceTransaction` (`:136`). _(v1 cites `:251`; the current tree has it at `:259`.)_

```ts
241:   const pack: EvidencePack = {
242:     id: evidencePackId(input.transactionId),          // evp_<txId>, non-empty
243:     transactionId: input.transactionId,               // FK — non-empty, from input
244:     customerReference: facts.customerReference,       // NOT NULL string
...
258:   };
259:   await store.insert("evidence_packs", pack);
260:   await deps.repos.marketplaceTransactions.insert({ ...transaction, ... });  // parent UPDATE, after
```

- `transaction_id`: non-empty (`input.transactionId`); parent read at `:142` via `repos.marketplaceTransactions.readLatestById` → **parent exists before the child write**. **CLEAN.**
- `customer_reference`: `facts.customerReference` is copied from the transaction row (itself NOT NULL and non-empty since 1g.2). Not an empty-string hazard.
- Idempotency: the `@unique(transaction_id)` constraint is guarded by the early-return at `:152-171` (existing pack → replay, no write) plus the deterministic `evp_<txId>` id. No duplicate-insert hazard.
- **Paired read that must move with this table:** `reconcile.ts:152` `store.readLatestById<EvidencePack>("evidence_packs", ...)`.

**CLEAN (1 site).**

### receipts

Single writer: `receipts.ts:61` in `issueReceipt` (`:55`), sole caller `ui/client.ts:782` (`ensureReceipt`, `:763`), reached by the HTTP route `GET /transactions/:id/receipt` (`server.ts:819-831`).

```ts
30:     id: `rcpt_${input.transactionId}`,
31:     transactionId: input.transactionId,          // FK — non-empty
32:     evidencePackId: `evp_${input.transactionId}`, // FK — non-empty, but SEE BELOW
```

Caller, showing that pack existence is **not** enforced:

```ts
776:   const pack = await deps.store.readLatestById<EvidencePack>("evidence_packs", `evp_${transaction.id}`);
...
782:   const receipt = await issueReceipt(deps.store, {
783:     transactionId: transaction.id,
784:     customerReference: order?.customerReference ?? "",
785:     providerReference: pack?.providerReference ?? null,
786:     amountMinor: order?.quotedAmountMinor ?? pack?.amountMinor ?? 0,
787:     currency: order?.currency ?? pack?.currency ?? "NGN",
```

- `transaction_id`: non-empty; parent on repos since 1g.2 → ordering fine.
- `evidence_pack_id`: **always non-empty** (deterministic `evp_<txId>`), but the parent row is **not guaranteed to exist**. `pack` may be `null` — the caller's `?? ""` / `?? 0` / `?? "NGN"` fallbacks exist precisely for that case — and `issueReceipt` will still write `evidencePackId = evp_<txId>`. Under JSONL that is a harmless dangling reference; under Postgres `receipts_evidence_pack_id_fkey` **fails the insert**.
- Currently masked: every exercised path reconciles before the receipt page. `src/marketplace/seed.ts:211` reconciles each seeded order; `test/marketplace/seeded-server.ts:46` reconciles the HTTP fixtures; `frontend-walkthrough.test.ts:99-124` hits `/receipt` for every seeded order and asserts 200. So the risk is **latent, not reproduced by a current test**.

**Class: RISKY (parent-before-child not guaranteed by construction).** Fix to land in the `receipts` sub-increment, pick one: (a) `issueReceipt` requires the pack id to resolve (throw a domain error when absent), (b) `ensureReceipt` reconciles when the pack is missing, or (c) the receipt route 409s when no pack exists. This is a behaviour decision (not a mechanical repoint) → **name it in the sub-increment's task**, and note it does not need a pre-dispatch ruling because all three options live inside 1f scope.

**Paired read:** the repository's `readLatestById` exists; the UI reads `store.readLatestById<ReceiptRecord>("receipts", ...)` at `ui/client.ts:648`.

### refunds

Two writers, both in `resolution.ts`; both parents read from repos first.

- `resolution.ts:207` (`initiateTransactionRefund`, `:152`): `transactionId: input.transactionId` (non-empty); parent via `requireTransaction(repos, …)` at `:162`. `ledgerReference` (`:191-193`) is the nullable soft ref — may legitimately be `null`. **CLEAN.**
- `resolution.ts:296` (`completeTransactionRefund`, `:254`): `completed = { ...refund, status: "COMPLETED", ... }` where `refund` is read at `:266`; `transactionId` inherited non-empty. **CLEAN.**
- **Paired reads that must move with this table:** `resolution.ts:169` and `:266` (`store.readLatestById<RefundRecord>("refunds", …)`).

### reversals

One writer: `resolution.ts:377` (`reverseTransactionDebit`, `:337`): `transactionId: input.transactionId`; parent via `requireTransaction` at `:347`. `ledgerReference` nullable soft ref. **CLEAN.** No read site for `reversals` in `src/` (the repo has `readLatestById`; nothing calls it).

### disputes

Two writers, both in `resolution.ts`.

- `resolution.ts:475` (`openDispute`, `:431`): `transactionId: input.transactionId`; `customerId: transaction.customerId` (`:466`) where `transaction` comes from `requireTransaction` at `:442`. A `""` customer id cannot reach here: `marketplace_transactions.customer_id` is a NOT NULL FK enforced since 1g.2, so the row could not exist with an empty customer. **CLEAN** for both FKs.
- `resolution.ts:536` (`resolveDispute`, `:505`): `resolved = { ...dispute, status: "RESOLVED", ... }`, `dispute` read at `:516` → same non-empty `transactionId`/`customerId`. **CLEAN.**
- **Paired reads:** `resolution.ts:449`, `:516`; plus `ui/client.ts:660` (`readLatestById<DisputeRecord>`) and `ui/client.ts:821` (`readAll<DisputeRecord>("disputes")`).

### manual_reviews

Two writers, both in `resolution.ts`.

- `resolution.ts:614` (`markManualReview`, `:581`): `transactionId: input.transactionId`; parent via `requireTransaction` at `:592`; `assignedTo: input.assignedTo ?? existing?.assignedTo ?? null` → nullable column, `null` is legal. **CLEAN.**
- `resolution.ts:674` (`resolveManualReview`, `:644`): `resolved = { ...review, ... }`, `review` read at `:655`. **CLEAN.**
- **Paired reads:** `resolution.ts:599`, `:655`; plus `ui/client.ts:664`.

---

## Summary of CLEAN / RISKY / BROKEN sites (counts per table)

| table                | write sites (src)                          | CLEAN         | RISKY                              | BROKEN                                                                 | notes                                         |
| -------------------- | ------------------------------------------ | ------------- | ---------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- |
| `transaction_events` | 1 funnel (`timeline.ts:88`), 43 call sites | 41 call sites | 1 (id-seq read-then-write, §above) | **2** call sites (`transactions.ts:486`, `:503` — child before parent) | BROKEN pair fixed by the Part 3 reorder       |
| `evidence_packs`     | 1 (`reconcile.ts:259`)                     | 1             | 0                                  | 0                                                                      |                                               |
| `receipts`           | 1 (`receipts.ts:61`)                       | 0             | **1**                              | 0                                                                      | pack-existence not enforced by the write site |
| `refunds`            | 2 (`resolution.ts:207`, `:296`)            | 2             | 0                                  | 0                                                                      |                                               |
| `reversals`          | 1 (`resolution.ts:377`)                    | 1             | 0                                  | 0                                                                      |                                               |
| `disputes`           | 2 (`resolution.ts:475`, `:536`)            | 2             | 0                                  | 0                                                                      | both FKs verified                             |
| `manual_reviews`     | 2 (`resolution.ts:614`, `:674`)            | 2             | 0                                  | 0                                                                      |                                               |
| **total**            | **10 sites**                               | **7**         | **2**                              | **2**                                                                  |                                               |

No table reaches the "3+ BROKEN sites" threshold that would force a design pass. The only source-level change outside a mechanical repoint is the `beginTransaction` reorder (already ruled) and the two optional hardenings named above.

**Attack surface the count hides (all inside 1f scope, all must move with their table):** reads. `ui/client.ts` alone reads these kinds at `:378`, `:640`, `:648`, `:652`, `:660`, `:664`, `:752`, `:776`, `:821`, `:1037`, `:1122`, `:1172` — i.e. each sub-increment's diff is **write + every paired read**, not write-only.

---

## Part 3 — beginTransaction reorder scope

Confirmed against the tree (`executeMarketplaceTransaction` starts at `transactions.ts:434`; `runPaymentAndFulfillment` at `:593`). The 80 lines around the anomaly:

```ts
470:
471:   const quote = quoteService(deps.catalog, service);
472:   const customerReference = buildCustomerReference(input.customerId);
473:   const createdOrder = await insertOrder(deps.repos, { ... });      // order row (repos)
...
484:   const queued: TransactionEvent[] = [];
485:   queued.push(
486:     await appendTransactionEvent(store, {                           // (A) event seq 1
487:       transactionId,
488:       type: TransactionEventType.OrderCreated,
...
499:       occurredAt: now,
500:     }),
501:   );
502:   queued.push(
503:     await appendTransactionEvent(store, {                           // (B) event seq 2
504:       transactionId,
505:       type: TransactionEventType.QuoteRecorded,
...
516:       occurredAt: now,
517:     }),
518:   );
519:
520:   const initial = buildTransactionRecord({                          // pure builder
521:     transactionId, orderId, customerId: input.customerId, service, reference,
522:     scenario: input.scenario, paymentStatus: "PENDING", fulfillmentStatus: "NOT_STARTED",
...
534:     now,
535:   });
535:   await deps.repos.marketplaceTransactions.insert(initial);         // (C) parent row
536:
537:   const walletId = await resolveWallet(deps.repos, { ... });        // (D) wallet
...
545:   return runPaymentAndFulfillment({
546:     store, deps, service, sourceInput: input, quote, transactionId,
547:     reference, orderId, customerReference, now, queued, seed, walletId,
548:   });
```

**What depends on (A)/(B) happening before (C)?** Nothing. Between `:484` and `:535` the code only (i) appends the two events, (ii) calls the pure `buildTransactionRecord`, (iii) inserts the row. No reads of the event log occur in that window: `buildTransactionRecord` is a pure function, and `appendTransactionEvent` (`timeline.ts:69-90`) reads the event log only for its own next sequence number. The only consumer of the two appends is the local `queued` array, which is passed to `runPaymentAndFulfillment` **by value** (`:545-548`) and copied there (`transactions.ts:623` `const events = [...queued]`).

**What depends on (C) happening before (A)/(B)?** Nothing today (JSONL has no FK), and nothing will after the reorder: `resolveWallet` (D) and `runPaymentAndFulfillment` do not read events.

**Is the reorder behaviour-preserving?** Yes, given the event **sequence number is count-derived, not write-order-derived** (`timeline.ts:74-75`: `seq = listTransactionEvents(txId).length + 1`). Immediately before (A) the count for this brand-new transaction is `0`; immediately before (B) it is `1`. Reordering (C) to precede (A)/(B) does not change either count, so the two events still get `seq` 1 and 2 and the same ids (`evt_<txId>_1`, `evt_<txId>_2`). The subsequent events appended inside `runPaymentAndFulfillment` still start at `seq` 3.

Behaviour-preserving diff (shape only — not applied, this is read-only):

```diff
-  const queued: TransactionEvent[] = [];
-  queued.push(await appendTransactionEvent(store, { ...OrderCreated... }));
-  queued.push(await appendTransactionEvent(store, { ...QuoteRecorded... }));
-
   const initial = buildTransactionRecord({ ... });
   await deps.repos.marketplaceTransactions.insert(initial);

+  const queued: TransactionEvent[] = [];
+  queued.push(await appendTransactionEvent(store, { ...OrderCreated... }));
+  queued.push(await appendTransactionEvent(store, { ...QuoteRecorded... }));
+
   const walletId = await resolveWallet(deps.repos, { ... });
```

The one invariant to preserve in the task: **the two appends must keep their relative order** (OrderCreated before QuoteRecorded) so `result.events` and the returned timeline stay byte-identical. Verified: `queued` order becomes `result.events[0..1]` via `transactions.ts:623`.

**Verdict: the reorder is a task, not a design decision.** No STOP condition triggered.

---

## Part 4 — Intra-1f dependency order

Verified against Part 1's FKs. The FK graph restricted to 1f is:

```
transaction_events ─┐
evidence_packs ─────┼──> marketplace_transactions   (repos since 1g.2 — satisfied)
receipts ───────────┤
refunds ────────────┤
reversals ──────────┤
disputes ───────────┼──> marketplace_customers      (repos since 1b/1c — satisfied)
manual_reviews ─────┘

receipts ──────────────> evidence_packs             (INTRA-1f — the only one)
```

So there is exactly **one** intra-1f ordering constraint: `evidence_packs` must land in Postgres before `receipts` inserts. (If `receipts` migrated first, its `evidence_pack_id` would point at a row that exists only in JSONL → FK failure.)

Corrections to v1's suggested order:

- v1's sequence (`transaction_events → evidence_packs → receipts → refunds/reversals/manual_reviews → disputes`) is **right on the constraint** but implies `disputes` must come last. Nothing forces that: `disputes.customer_id` targets `marketplace_customers`, which is already on repos, and `disputes.transaction_id` targets the same parent as the other three. `disputes` may group with the other resolution tables.
- `transaction_events` has **no** dependency on any other 1f table, so it can be done in any slot (it goes first only because it carries the reorder).
- Everything else (`evidence_packs`, `refunds`, `reversals`, `disputes`, `manual_reviews`) is mutually independent.

---

## Part 5 — Recommended decomposition

**4 sub-increments**, mirroring 1g's rhythm:

| sub-inc  | tables                                               | boundary conditions                                                                                                                        | source writes                               | paired reads to repoint                                                 |
| -------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------------------------- |
| **1f.1** | `transaction_events`                                 | Parent `marketplace_transactions` on repos (1g.2) ✓. **Requires the Part 3 reorder.** Carries the seq/id ruling (Part 2).                  | `timeline.ts:88`                            | `timeline.ts:97`, `transactions.ts:2450`, `ui/client.ts:646`            |
| **1f.2** | `evidence_packs`                                     | Parent on repos ✓. No 1f-internal dep.                                                                                                     | `reconcile.ts:259`                          | `reconcile.ts:152`, `ui/client.ts:378/640/752/776/1037/1122/1172`       |
| **1f.3** | `receipts`                                           | **Requires 1f.2** (`evidence_pack_id` FK). Carries the RISKY pack-existence fix (pick option a/b/c).                                       | `receipts.ts:61`                            | `ui/client.ts:648`                                                      |
| **1f.4** | `refunds`, `reversals`, `disputes`, `manual_reviews` | Parent on repos ✓; no intra-1f or inter-table FK. Four tables, one file, identical shape (write + paired read + `updateResolutionStatus`). | `resolution.ts:207/296/377/475/536/614/674` | `resolution.ts:169/266/449/516/599/655`, `ui/client.ts:652/660/664/821` |

Rationale for grouping the four resolution tables into one sub-increment: they share a single file and one pattern, have no FK among themselves, and splitting them would mean three extra commits touching `resolution.ts` in the same places. If the owner prefers 1g-sized diffs, the natural split is **1f.4** = `refunds` + `reversals` and **1f.5** = `disputes` + `manual_reviews` (5 sub-increments total); the FK graph permits it.

Order is otherwise free except: (1) `evidence_packs` before `receipts`, (2) the reorder lands with 1f.1.

Test surface per sub-increment (grep-verified readers that will need repointing):

- `transaction_events`: `test/marketplace/timeline.test.ts:119`
- `evidence_packs`: `test/marketplace/findings.test.ts:266/282/295`, `reconcile.test.ts:312`, `store-kinds.test.ts:108/110/114`
- `receipts`: `test/marketplace/evidence.test.ts:226`, `gift-card.test.ts:253/378/382`
- `refunds`/`reversals`: `test/marketplace/resolution.test.ts:103`, `ticketing.test.ts:352/360`
- `disputes`/`manual_reviews`: no direct `store.readAll` in tests (exercised through the resolution actions)

The repository layer for all 7 is already scaffolded and unit-tested (`test/db/repositories/{transaction-events,evidence-packs,receipts,refunds,reversals,disputes,manual-reviews}.test.ts`), so each sub-increment is repoint + test repoint, same shape as 1g.

---

## Part 6 — Surprises

1. **v1's line citations drift from the tree.** v1 cites the evidence-pack write at `reconcile.ts:251`; it is at `:259`. v1 cites the refund write at `resolution.ts:210`; it is at `:207`. The offsets are not consistent across files, so v1's citations cannot be used for line-precise work. v2 re-derived every citation from grep against `43d96c8`. (v1's _conclusions_ — the 1g blocker and the events reorder — are unaffected and were re-confirmed.)

2. **v1 missed the paired reads.** v1's audit was write-sites-only. Every one of the 7 tables is also **read** from `src/` through the same JSONL kind, and for `refunds`/`disputes`/`manual_reviews` the reads are inside the _same functions_ as the writes (`resolution.ts:169/266`, `:449/516`, `:599/655`) — so those sub-increments must repoint reads and writes atomically or the read-modify-write cycle breaks (e.g. `completeTransactionRefund` reads the pending refund at `:266` and re-writes it at `:296`; a half-migrated pair would read `null` and throw `REFUND_NOT_PENDING`).

3. **`transaction_events` is written through a shared funnel also used by an out-of-scope feature.** `timeline.ts:69` is called from `ticketing.ts:239`, and `ticket_artifacts` is _not_ one of 1f's 7 tables. Migrating `transaction_events` therefore flips the ticketing path's event writes to Postgres while its artifact writes stay on JSONL. That is not an FK problem (`ticket_artifacts.transaction_id` already has its parent on repos), but it means 1f.1's diff reaches the ticketing feature, and any test that asserts "ticketing wrote N rows to the store" for events must be repointed too.

4. **`ui/client.ts` is a heavy reader of all 7 kinds** — 12 call sites (`:378/640/648/652/660/664/752/776/821/1037/1122/1172`). This is the largest single piece of scope in 1f and it is spread across four sub-increments. Worth telling each sub-increment's task explicitly that the UI layer is in scope for reads.

5. **`receipts.evidence_pack_id` has no index.** Every other FK in the 7 tables is indexed. Not a write-path problem (Postgres does not require an index on a FK) and deletes are `Restrict`-only in this app, so there is no current cost — but it is an asymmetry worth a deliberate accept/ignore ruling rather than a silent omission.

6. **`evidence_packs` carries two uniqueness constraints on the domain key** — `id` (`evp_<txId>`) and `@unique(transaction_id)`. The repository's upsert is keyed on `id` only; the second constraint is never exercised because the id is deterministic. Harmless, but it means the "one pack per transaction" rule is currently enforced by _convention_ (the deterministic id) plus a DB constraint, not by the write path.

7. **All 7 tables drop their `simulated` field on the Postgres side** (no `simulated` column exists; the repos re-synthesise `simulated: true`). Same shape as the already-recorded Gap 3 for `marketplace_orders`. Consistent and type-safe (`simulated: true` literal), so no action — recorded so it is not "discovered" again mid-migration.

8. **After 1f, 7 `StoreKind` entries become write-dead** (`jsonl-store.ts:21-27`: `transaction_events`, `evidence_packs`, `receipts`, `refunds`, `reversals`, `disputes`, `manual_reviews` — and their `.jsonl` files stop being created). `store-kinds.test.ts:68-118` asserts kind compatibility for `evidence_packs`, so pruning the union is **not** free. Do not remove or reconcile the kinds inside 1f; treat it as a follow-up decision.

9. **Not in 1f scope but adjacent:** `ticket_artifacts`, `gift_card_artifacts`, and `notifications` also carry `transaction_id` FKs to `marketplace_transactions` (migration lines quoted in Part 1's grep output). They are outside the 7 tables named in this pre-flight; flagged only so the 5B.1c table list is not mistaken for complete.
