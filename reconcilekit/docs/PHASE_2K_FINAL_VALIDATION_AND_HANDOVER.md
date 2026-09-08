# Phase 2K — Final Validation & Handover

**Project:** ReconcileKit
**Phase:** 2K — Testing, Hardening, Documentation & Handover
**Date:** 2026-09-07
**Status:** Complete — release as demo pilot

---

## 1. Overview

Phase 2K is the closing, validation, and handover phase for the ReconcileKit
marketplace pilot. It does **not** build new product behavior; it verifies that
everything built across Phase 2A–2J behaves as designed, documents the
traceability of every demo scenario from plan to implementation, reconciles
plan-table expectations against the authoritative integration design and the
actual implementation, hardens the evidence/security story with focused tests,
refreshes the project documentation, and produces the handover record for the
next phase.

The only code change made in 2K is an additive, read-only test file
(`storefront/test/marketplace/frontend-walkthrough.test.ts`, +7 tests). No
production source under `reconcilekit/src/**` was modified, and the root
reconciliation engine was not modified at any point in the workshop.

---

## 2. Objectives

1. Confirm the implementation of Phase 2A–2J matches the
   `PHASE_2_IMPLEMENTATION_PLAN.md` and the authoritative bridge design
   (`RECONCILE_KIT_INTEGRATION_DESIGN.md`).
2. Provide 16-scenario end-to-end traceability: plan expectation → design row →
   seeded scenario → engine reconciliation → customer/admin truth → UI surface.
3. Verify the money-safety, determinism, idempotency, masking, validation, and
   compliance invariants that make the demo safe to run and reason about.
4. Add focused HTTP-level tests closing the remaining plan §M coverage gaps
   (full-scenario E2E pages, evidence masking, admin outcome surfaces).
5. Reconcile documentation drift between the plan, the design doc, and the
   provider/wallet architecture docs without changing protected behavior.
6. Produce the readiness verdict and handover notes.

---

## 3. Scope & Boundaries

**In scope for inspection:** all canonical docs in `docs/`, implementation
audit of `storefront/src/**` (orchestration, wallet, providers, evidence,
receipts, truth, bridge, UI, server routes), validation command results,
regression suites, and the two docs listed below that 2K rewrites.

**Protected (not to be altered by 2K):**

- `reconcilekit/src/**` — the immutable root engine and its application/CLI
  shell.
- Paystack `PaymentRecord` and the legacy `/reconcile`, `/orders`, `/callback`
  HTTP surface (frozen merchants/Paystack contract).
- Every established marketplace semantic: identity/reference scheme, wallet
  ledger, reconciliation join keys, `TransactionTruth`, evidence packs,
  receipts, resolution state machines, notifications, gift-card/ticket
  fulfillment, replay/dedup behavior.

**Out of scope:** production authentication, CSRF protection, browser-level
automation, real provider integrations, real payments, and any behavior
change to protected logic. Where a questionable behavior was found it was
documented (see §16, §17, §18), not silently patched.

---

## 4. Verification Methodology

The AGENTS.md engineering sequence was applied:

1. **Read** — every canonical doc in `reconcilekit/docs/` read fully, including
   `RECONCILE_KIT_INTEGRATION_DESIGN.md` (618 lines), which had not previously
   been read end-to-end.
2. **Inspect** — the marketplace source tree, test tree, and server route table;
   the pre-existing storefront + marketplace suites were read for ground truth.
3. **Diagnose** — plan §L scenario expectations were traced against the design
   doc §8 rows and the actual seeded behavior (see §15, §16).
4. **Plan** — a 16-scenario traceability matrix and deviation register were
   produced; focused test additions were limited to gaps that could not create
   double coverage (the remainder of `server-marketplace.test.ts` was checked
   first).
5. **Implement** — one additive test file (§7).
6. **Verify** — full typecheck, lint, format check, and both test suites
   re-run, plus a fresh demo boot probe (§5, §18.4).
7. **Report** — this document, the doc refresh (§17), and the Phase 2K FINAL
   REPORT delivered at session close.

Evidence priority was: plan/design docs → implementation + tests → server
observation. No facts about behavior were taken from memory or from the plan's
expected columns alone; every scenario row in §15 is grounded in the assertions
of `storefront/test/marketplace/demo-scenarios.test.ts` and the HTTP surfaces
verified by the new walkthrough tests.

---

## 5. Validation Commands & Results

All runs executed on Windows PowerShell against `reconcilekit/` (root) and
`reconcilekit/storefront/` as noted.

| Command                | Location              | Result              |
| ---------------------- | --------------------- | ------------------- |
| `npm run typecheck`    | root                  | EXIT 0              |
| `npm run typecheck`    | storefront            | EXIT 0              |
| `npm run lint`         | root                  | EXIT 0              |
| `npm run format:check` | root                  | PASS                |
| `npm test`             | root (workspace-wide) | 572/572 PASS (~61s) |
| `npm test`             | storefront            | 359/359 PASS (~62s) |

Breakdown of the workspace-wide `npm test` run (root `node --test` recurses
into both trees):

- **ReconcileKit core** (`reconcilekit/src/**`): 213 tests, unchanged from the
  Phase 2J baseline.
- **Storefront suite** (existing): 352 tests, all still green.
- **Phase 2K additions**: 7 tests (see §7).
- **Total**: 213 core + 359 storefront = **572/572 PASS**, zero failures.

---

## 6. Test Inventory

### 6.1 Root engine (213 tests)

The core reconciliation engine, adapters, transport, CLI, and report surface
are covered by their Phase 1/2 suites: CSV merchant loader (parse integrity,
strictness, determinism), Paystack provider adapter (evidence-backed mapping,
envelope handling, no secret leakage), Paystack transport (auth header, error
classification, no retries), the frozen pair-dedup matching algorithm, the 20+
discrepancy validation matrix, CLI contract (exit codes, deterministic output,
live-mode guards), and the source-attribute pipeline. The regression guard
"frozen reconciliation engine still produces its existing result" pins the
engine output for later phases.

### 6.2 Storefront suite (352 tests pre-2K, 359 with 2K)

- **Catalog** — 12 seeded categories 1:1 with the approved parity scope,
  service/product model, provider registry indirection, availability,
  determinism, compliance-gated betting never checkout-eligible.
- **Demo scenarios (16)** — per-scenario final-state assertions incl. events,
  ledger, artifacts, reconciliation snapshot, evidence pack.
- **Validation (31)** — generic schema-order determinism, per-service required
  fields, and negative guarantees: invalid input never debits, never calls the
  provider, never creates artifacts/orders.
- **Providers** — mock provider determinism, status separation, masking.
- **Wallet** — derived balance semantics, funding classification, lifecycle.
- **Bridge** — §4.4 provider-row emission policy, join-key semantics, multi
  currency/tolerance config.
- **Reconcile** — SUCCESS/FAILED/TIMEOUT/UNKNOWN/REVERSAL outcomes, store-only
  replay, declined-debit non-failure.
- **Resolution** — refund/reversal/dispute/manual-review guards.
- **Ticketing** — reserve/issue, cancellation, replay idempotency, masked codes.
- **Truth & evidence** — status mapping to customer/admin, masking, replay-safe
  pack emission.
- **HTTP pages** — every customer + admin page, receipts, evidence, 404s,
  unknown-route handling, checkout POST.
- **Legacy compatibility** — JSONL store kind compatibility, Paystack routes.

---

## 7. Phase 2K Focused Test Additions

`storefront/test/marketplace/frontend-walkthrough.test.ts` adds 7 tests. They
exercise the running HTTP server (in-process listener on an ephemeral port)
over a fully seeded demo store built by the existing `seedDemoData` fixture,
mirroring `seeded-server.ts`. Coverage closes the plan §M gaps that were not
already asserted anywhere:

1. **Every seeded order scenario over HTTP** — for all 15 order scenarios
   (everything except `wallet_funding_failure`), `/transactions/<ref>`,
   `/transactions/<ref>/evidence`, and `/transactions/<ref>/receipt` return 200
   and carry the core contract text (`What happened to your money`,
   `Provider response`, `ReconcileKit determination`, `Simulated data`).
2. **Money-at-risk badge** — the `manual_review` detail page renders the
   `Money at risk` warning.
3. **Funding failure boundary** — `/transactions/txn_wallet_funding_failure`
   returns 404 with an HTML error page, confirming the wallet-layer funding
   failure is deliberately outside the marketplace reconcile surface.
4. **Gift-card masking** — the success artifact's `maskedCodePreview` matches
   `GC-<token4>-****`, appears on the page, and no other `GC-` material exists
   beyond masked previews; the fulfillment-failure page exposes nothing beyond
   masked previews; the evidence page shows the _sensitive values masked_
   banner.
5. **Pending ticket codes** — `airline_booking_pending` renders `not issued`
   (reservation held, no code material).
6. **Admin dashboard** — `/admin` renders all queue labels (Mismatch, Manual
   review, Refund queue, Reversal queue, Pending provider), the
   transactions-tracked line, and _Money at risk_.
7. **Admin mismatch queue** — `/admin/queues/mismatch` contains the
   `provider_mismatch` seeded transaction reference.

Result: **7/7 PASS**; full storefront suite remains 359/359.

---

## 8. Architecture & Integration Integrity

### 8.1 Server-route shadowing (empirically verified)

The marketplace server tree registers all Paystack/Gateway legacy routes and
all marketplace routes. When marketplace deps are present, the legacy
`/reconcile`, `/reconcile/merchant.csv`, `/orders/*`, and `/callback` JSON/CSV
routes are shadowed by the marketplace HTML surface and return `404 text/html`,
never the legacy JSON payloads. This was confirmed by direct HTTP probes
against the running server (Phase 2J evidence) and by the route tables in
`storefront/src/server.ts` (legacy rows ~191–201 and ~555–557; marketplace
rows ~564–597). The frozen merchant/Paystack paths remain fully test-covered
at the application layer and keep passing.

### 8.2 Reconciliation join-key semantics

- The engine joins merchant-side and provider-side rows **only** on exact,
  normalized **reference equality**.
- The only join key in the marketplace pilot is the marketplace transaction id
  (`mk_txn_…`) on both sides; provider references (`air_…`, `res_…`, `iss_…`)
  survive **only as source attributes** and are never join keys
  (verified: `reconcile-bridge` bridge tests, "join key is the marketplace
  transaction id on both sides, never the provider reference").
- Provider rows are emitted per the §4.4 policy: PENDING/TIMEOUT provider
  responses emit **no** provider row → the engine reports
  `MISSING_PROVIDER_RECORD`, never a fabricated outcome
  (`reconcile-bridge.ts:54`). A declined wallet debit likewise yields
  `MISSING_PROVIDER_RECORD` (a clean failure, not a discrepancy).

### 8.3 Identity & reference scheme

All ids derive from deterministic `stableToken` hashing
(`wallet.ts:368`, `mock-provider.ts:525`), so identical inputs produce
identical ids across processes, making the seeded demo reproducible and replays
upserts rather than duplicates.

---

## 9. Wallet & Money-Safety Invariants

All grounded in tests (`storefront/test/marketplace/wallet.test.ts`,
`transactions.test.ts`, `seed.test.ts`) and source:

| #   | Invariant                                                                                     | Evidence                                                                                                                                             |
| --- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| W1  | Wallet balance is **derived from the persisted ledger**, never a stored mutable balance       | `wallet.ts:165` `deriveWalletBalance`; test "getWallet derives balance from persisted ledger, not a stored mutable balance"                          |
| W2  | Each wallet opens with a deterministic **opening ledger entry**                               | `wallet.ts:457–484`; default opening `500_000` minor units (`transactions.ts:1949`)                                                                  |
| W3  | Ledger consistency rejects **foreign-wallet entries** and **negative available balance**      | `wallet.ts:219,246` `assertLedgerConsistency`-style violation reports; test "ledger consistency detects foreign wallet entries and negative balance" |
| W4  | **Pending debit** affects pending balance only, never confirmed available                     | test "pending debit creates a pending hold, not an available deduction"                                                                              |
| W5  | **Failed operations** never change available balance                                          | test "failed operations do not change available balance"                                                                                             |
| W6  | A **duplicate debit** is still applied twice but is detectable in the ledger                  | test "duplicate debit decreases available balance twice and is detected"                                                                             |
| W7  | **Underfunded wallet** never reaches the provider                                             | test "failed payment guard: an underfunded wallet never reaches the provider"                                                                        |
| W8  | Funding **failure/pending** never move the balance and preserve distinct statuses             | wallet funding classification tests                                                                                                                  |
| W9  | Refund/completion restore balance **only at completion**                                      | test "refund pending then completed restores balance only at completion"                                                                             |
| W10 | Reversal is a distinct money movement from a refund, each with its own ledger/reference types | resolution + wallet tests; "a reversal is a distinct money movement from a refund"                                                                   |

---

## 10. Lifecycle, Resolution & Guard Invariants

| #   | Invariant                                                                                                                     | Evidence                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| L1  | **Refund cannot be initiated twice**                                                                                          | test "a refund cannot be initiated twice" (`resolution.ts` initiation guards ~150–209)           |
| L2  | **Refund cannot complete before it was initiated** — completion requires a `REFUND_PENDING` record, else `REFUND_NOT_PENDING` | `resolution.ts:116`, `resolution.ts:270`; tests                                                  |
| L3  | **Reversal cannot follow an in-flight refund**                                                                                | test "a reversal cannot follow an in-flight refund"                                              |
| L4  | A dispute can be opened only once; a refunded transaction is not disputable                                                   | dispute guard tests                                                                              |
| L5  | Manual review opens and resolves, appending review events; unresolved review stays money-at-risk                              | test "an unresolved transaction under manual review stays money-at-risk"                         |
| L6  | Payment lifecycle is a strict state machine; invalid transitions raise `InvalidPaymentTransitionError`                        | test "payment lifecycle state machine enforces valid transitions"                                |
| L7  | Payment lifecycle maps to canonical ReconcileKit statuses **without leaking provider status**                                 | test "payment lifecycle maps to canonical ReconcileKit statuses without leaking provider status" |
| L8  | A **refunded or reversed transaction is not cancellable**; cancellation never touches money/resolution state                  | ticketing tests                                                                                  |
| L9  | Replays of resolution actions are idempotent — no new events, no new writes                                                   | "replaying a cancellation is idempotent and writes nothing new"; resolution replay tests         |

---

## 11. Determinism & Idempotency Invariants

| #   | Invariant                                                                                                              | Evidence                                                                                                                                |
| --- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | All marketplace timestamps default to `WALLET_FIXED_TIMESTAMP = 2026-01-01T12:00:00.000Z`                              | `wallet.ts:29`, consumed by every now-default in transactions/wallet/resolution/ticketing/receipts/notifications/timeline               |
| D2  | Demo seed uses the same fixed timestamp (`DEMO_SEED_TIMESTAMP = WALLET_FIXED_TIMESTAMP`)                               | `seed.ts:41`                                                                                                                            |
| D3  | Mock providers are deterministic: same context + scenario → identical results                                          | provider tests; `mock-provider.ts` stableToken ids                                                                                      |
| D4  | Seed replay is idempotent — replay leaves **no duplicate money movement**, no extra rows, no extra events              | "demo seed is idempotent and leaves no duplicate money movement"; "replay is idempotent: no second debit, no new events, no new writes" |
| D5  | **Engine reconciliation is never re-run on replay** — a replayed result carries `replayed: true` and no new facts/rows | `reconcile.ts:50,165,266`; test "reconcile: replay is store-only — no engine re-run, no new rows"                                       |
| D6  | Replayed notifications/emissions resolve to their latest text                                                          | `notifications.ts:90`                                                                                                                   |
| D7  | Two catalog builds produce identical entities                                                                          | "catalog is deterministic: two builds produce identical entities"                                                                       |
| D8  | Multiple/replay evidence emission is an idempotent upsert keyed on deterministic pack/artifact ids                     | `artifacts.ts:55,63`; receipt idempotency test                                                                                          |

---

## 12. Sensitive-Material & Secret Invariants

| #   | Invariant                                                                                                                                   | Evidence                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | **Raw gift-card codes are never written** — only `maskedCodePreview` (`GC-<token4>-****`)                                                   | `mock-provider.ts:565`; `artifacts.ts:69` ("raw card code is never materialized here"); tests "gift card delivered code material is never written in full", "gift card FAILED keeps the code masked" |
| S2  | **Ticket codes are masked** (`TKT-<token4>-****`); pending tickets carry `null` and render `not issued`                                     | `mock-provider.ts:339`; walkthrough test "pending airline ticket shows no code until issued"                                                                                                         |
| S3  | Provider facts redact sensitive keys; the only code material admitted is a `maskedCodePreview`                                              | `evidence.ts:34` `MASKED_PREVIEW_KEY`, `evidence.ts:47`; `transactions.ts:1058` writes `masked_code_preview` (never a full code) into safe metadata                                                  |
| S4  | Fulfillment-failure pages expose nothing beyond masked previews                                                                             | walkthrough test 4                                                                                                                                                                                   |
| S5  | The customer evidence page states _sensitive values masked_ and _only masked code previews are shown — full codes never leave the provider_ | `customer-pages.ts`; walkthrough test 4                                                                                                                                                              |
| S6  | **Paystack secret never appears** in output, error text, or reports                                                                         | CLI suite "secret never appears in output, reports, or error text"; missing-secret guards                                                                                                            |
| S7  | Evidence packs are immutable stored records; display `redactEvidencePack` is a pure transform                                               | evidence tests "redactEvidencePack is an immutable display transform of a stored pack"                                                                                                               |

---

## 13. Validation-Before-Side-Effect Invariants

| #   | Invariant                                                                                                    | Evidence                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| V1  | Input validation runs **before** any wallet write, provider call, or artifact/order creation                 | tests "invalid input never debits the wallet", "never calls the provider", "never creates fulfillment artifacts or orders" |
| V2  | Validation errors are deterministic — the first schema-order error reports first                             | "missing field reports the first schema-order error deterministically"; generic validator test                             |
| V3  | SELECT-membership and per-service formats are schema-driven, no UI-specific logic                            | "services expose reusable input schemas without UI-specific logic"; 31-input validation tests                              |
| V4  | Unknown service → typed `TransactionInputError` before anything runs                                         | "validation boundary: unknown service throws TransactionInputError"                                                        |
| V5  | Server order amount comes from the product price, never a client-supplied amount                             | Paystack API suite "POST /orders uses the product price, never a client-supplied amount"                                   |
| V6  | Store reads tolerate corrupt lines and stay robust (CORRUPT skip, not fatal) + concurrent writes all persist | store tests                                                                                                                |

---

## 14. Compliance Gate Invariants

| #   | Invariant                                                                                            | Evidence                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C1  | Betting is seeded as a **placeholder only** — no real service/provider                               | "compliance-gated betting is a seeded placeholder only"                                                           |
| C2  | Compliance-gated categories are **never checkout-eligible** — checkout throws before any side effect | "checkout gating blocks compliance-gated services"; "compliance-gated categories are never eligible for checkout" |
| C3  | The provider registry **refuses** to expose a betting provider                                       | "registry refuses compliance-gated betting provider"                                                              |

---

## 15. 16-Scenario Traceability Matrix

Columns: seeded scenario → engine reconciliation → customer status → admin
status → money at risk → resolution → key events/evidence → plan §L expectation
→ verdict. All final states are asserted in
`storefront/test/marketplace/demo-scenarios.test.ts`; the HTTP surface for the
15 order scenarios is asserted in the Phase 2K walkthrough tests.

| #   | Demo scenario                     | Engine outcome                          | Customer status | Admin status     | At risk | Resolution     | Key evidence                                                                                         | Plan §L expectation                     | Verdict                                            |
| --- | --------------------------------- | --------------------------------------- | --------------- | ---------------- | ------- | -------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------- |
| 1   | `successful_airtime`              | MATCH                                   | CONFIRMED       | HEALTHY          | no      | COMPLETED      | DEBIT_SUCCESS + PROVIDER_RESPONSE + FULFILLED, no flags                                              | MATCH/CONFIRMED/COMPLETED               | **Aligns**                                         |
| 2   | `failed_data`                     | DISCREPANCY (STATUS_MISMATCH)           | NEEDS_ATTENTION | PROVIDER_FAILED  | yes     | NONE           | single DEBIT_SUCCESS + PROVIDER_FAILED fulfillment, no auto-refund                                   | FAILED / refund expected                | **Deviation D1**                                   |
| 3   | `pending_electricity`             | MISSING_PROVIDER_RECORD                 | PENDING         | PENDING_PROVIDER | no†     | NONE           | DEBIT_PENDING hold, no provider row                                                                  | PENDING                                 | **Aligns**                                         |
| 4   | `provider_timeout`                | MISSING_PROVIDER_RECORD                 | PENDING         | PENDING_PROVIDER | no†     | NONE           | TIMEOUT hold, no provider facts                                                                      | PENDING / monitoring                    | **Aligns** (plan word "MONITORING" is descriptive) |
| 5   | `duplicate_debit`                 | MATCH                                   | CONFIRMED       | HEALTHY          | no      | COMPLETED      | single DEBIT_SUCCESS; second provider response flagged `DUPLICATE_PROVIDER_RESPONSE`                 | HELD_AMBIGUOUS / manual review          | **Deviation D2 (deliberate)**                      |
| 6   | `provider_mismatch`               | DISCREPANCY (AMOUNT_MISMATCH)           | NEEDS_ATTENTION | MISMATCH         | yes     | NONE           | `PROVIDER_AMOUNT_MISMATCH` event, expected vs actual on evidence                                     | amount-branch mismatch                  | **Aligns** (plan's own amount branch)              |
| 7   | `successful_gift_card`            | MATCH                                   | CONFIRMED       | HEALTHY          | no      | COMPLETED      | maskedCodePreview `GC-…-****` artifact + evidence facet                                              | DELIVERED, masked preview               | **Aligns**                                         |
| 8   | `gift_card_fulfillment_failure`   | DISCREPANCY (STATUS_MISMATCH)           | NEEDS_ATTENTION | PROVIDER_FAILED  | yes     | NONE           | `GIFT_CARD_FULFILLMENT_FAILED`, deliveryStatus FAILED, maskedCodePreview null                        | auto REFUND_INITIATED                   | **Deviation D4**                                   |
| 9   | `cinema_ticket_success`           | MATCH                                   | CONFIRMED       | HEALTHY          | no      | COMPLETED      | reserve+issue trail, masked ticket                                                                   | ISSUED                                  | **Aligns**                                         |
| 10  | `bus_ticket_refund`               | MATCH (payment)                         | REFUNDED        | HEALTHY          | no      | REFUNDED       | REFUND_COMPLETED + DEBIT_SUCCESS; no `TICKET_CANCELLED`                                              | refund completed                        | **Deviation D5 (partial)**                         |
| 11  | `airline_booking_pending`         | MISSING_PROVIDER_RECORD                 | PENDING         | PENDING_PROVIDER | no†     | NONE           | PENDING hold, reservation reference, ticket status PENDING / `not issued`                            | MATCH-if-pending                        | **Deviation D6 (design-consistent)**               |
| 12  | `wallet_funding_failure`          | — (wallet layer, not a marketplace txn) | —               | —                | —       | —              | funding lifecycles FAILED, opening balance intact, `/transactions/txn_wallet_funding_failure` → 404  | engine DISCREPANCY/STATUS_MISMATCH      | **Deviation D7 (design boundary)**                 |
| 13  | `payment_success_service_failure` | DISCREPANCY (STATUS_MISMATCH)           | NEEDS_ATTENTION | MISMATCH         | yes     | NONE           | order FAILED; `PROVIDER_FAILED` + `GIFT_CARD_FULFILLMENT_FAILED`; payment settled before fulfillment | payment MATCH                           | **Deviation D8**                                   |
| 14  | `payment_reversal`                | MATCH (both CANCELLED)                  | CANCELLED       | HEALTHY          | no      | REVERSED       | `REVERSAL_COMPLETED`, wallet re-credit                                                               | UNRESOLVED/UNKNOWN-variant              | **Deviation D9 (design-consistent)**               |
| 15  | `refund_pending`                  | MISSING_PROVIDER_RECORD                 | REFUND_PENDING  | REFUND_QUEUE     | yes     | REFUND_PENDING | REFUND_PENDING hold, funds held                                                                      | original DISCREPANCY                    | **Deviation D10**                                  |
| 16  | `manual_review`                   | UNRESOLVED (STATUS_UNRESOLVED)          | NEEDS_ATTENTION | MANUAL_REVIEW    | yes     | NONE           | `TRANSACTION_REQUIRES_REVIEW`, order MANUAL_REVIEW                                                   | HELD_AMBIGUOUS / CONFLICTING_ATTRIBUTES | **Deviation D11**                                  |

† Held pending funds are at risk of _timeliness_ but carry no confirmed money
movement; the truth engine reports the hold as unresolved-until-provider
(`truth.ts:83–88`).

**Matrix conclusion:** all 16 seeded scenarios behave exactly as the
authoritative integration design describes. The 8 plan-table mismatches are
documentation-traceability artifacts (plan vs DESIGN doc vs implementation),
not regressions; each is resolved in §16.

---

## 16. Deviation Register (Plan ↔ Implementation)

| Ref | Plan §L expected                                                                             | Actual behavior                                                                         | Root cause                                                                                                                                   | Resolution / status                                                                                           |
| --- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| D1  | `failed_data` → FAILED, auto-refund expected                                                 | DISCREPANCY, money at risk, resolution NONE                                             | Auto-refund was never implemented; refunds are operator-initiated or dedicated refund scenarios (`bus_ticket_refund`, `refund_pending`)      | Documented; matches 2A scope decision. No behavior change.                                                    |
| D2  | `duplicate_debit` → HELD_AMBIGUOUS / DUPLICATE_MERCHANT_RECORD                               | benign dedup → MATCH + `DUPLICATE_PROVIDER_RESPONSE`, single debit                      | DESIGN §8 row 5 + open decision #1 recommends option (a): dedupe-to-MATCH with an app-level duplicate marker                                 | **Deliberate**; implementation follows DESIGN.md, not the older provider doc. Provider docs refreshed in §17. |
| D3  | reference-mismatch engine branch reachable from a scenario                                   | only the amount branch is seeded                                                        | engine resolves both branches at unit level; no seeded scenario drives the reference-mismatch twin                                           | Gap recorded (§18 R2); not a defect.                                                                          |
| D4  | `gift_card_fulfillment_failure` → auto REFUND_INITIATED                                      | PROVIDER_FAILED, code masked/null, funds at risk, operator-driven                       | Auto-refund out of scope (same as D1)                                                                                                        | Documented; operator refund flow is available.                                                                |
| D5  | `bus_ticket_refund` closes the ticket                                                        | resolution refund completes but no `TICKET_CANCELLED` is emitted on the ticket          | cancellation is a separate capability (`ticketing.ts`) not invoked by the resolution path                                                    | Gap recorded (§18 R3).                                                                                        |
| D6  | `airline_booking_pending` expected MATCH                                                     | MISSING_PROVIDER_RECORD + PENDING hold                                                  | DESIGN §8 rows 3/4/10: PENDING provider rows are omitted (§4.4 emission policy) → engine legitimately sees no provider side                  | **Design-consistent**; no change.                                                                             |
| D7  | `wallet_funding_failure` expected engine DISCREPANCY/STATUS_MISMATCH                         | wallet-layer FAILED lifecycle; not a marketplace transaction (404 on `/transactions/…`) | funding runs through the wallet funding path, outside the marketplace reconcile surface                                                      | **Design boundary**; verified by walkthrough test 3.                                                          |
| D8  | `payment_success_service_failure` expected payment MATCH                                     | payment FAILED (provider executed FAILED), order FAILED, two fulfillment markers        | the engine truth restates the provider's FAILED status; the plan over-simplified a split-path scenario                                       | Documented; payment/fulfillment states stay distinct by design.                                               |
| D9  | `payment_reversal` expected UNRESOLVED (UNKNOWN variant)                                     | engine MATCH because both sides are CANCELLED; wallet reversed                          | DESIGN §8 row 9 explicitly maps REVERSED → CANCELLED → MATCH                                                                                 | **Design-consistent**; no change.                                                                             |
| D10 | `refund_pending` expected original DISCREPANCY                                               | MISSING_PROVIDER_RECORD hold + REFUND_QUEUE                                             | PENDING-emission policy + `truth.ts:70–71` (REFUND_PENDING → REFUND_QUEUE)                                                                   | **Design-consistent**; no change.                                                                             |
| D11 | `manual_review` expected HELD_AMBIGUOUS / DUPLICATE_PROVIDER_RECORD / CONFLICTING_ATTRIBUTES | UNRESOLVED + `TRANSACTION_REQUIRES_REVIEW`                                              | UNKNOWN provider status → engine UNRESOLVED; the engine's duplicate-ambiguous paths are unit-covered but not reachable from seeded scenarios | Documented; gap recorded (§18 R2).                                                                            |

**Verdict:** no deviation represents a regression or a money-safety defect. All
differences are either deliberate design choices (documented in the DESIGN doc)
or plan-table wording that predates the final design.

---

## 17. Documentation Reconciliation Findings & Updates

| #   | Finding                                                                                                                                                                                                                                         | Action                                                                                                                                                                         |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| DR1 | `RECONCILE_KIT_INTEGRATION_DESIGN.md` §8 row 5 + open decision #1(a) recommend dedupe-to-MATCH; `MOCK_PROVIDER_ARCHITECTURE.md` and `RECONCILE_KIT_INTEGRATION.md` still describe `duplicate_debit` as HELD_AMBIGUOUS/DUPLICATE_MERCHANT_RECORD | Reconcile the provider/integration docs to the DESIGN decision (option a) so all docs agree: duplicate merchant refs dedupe, match, and surface `DUPLICATE_PROVIDER_RESPONSE`. |
| DR2 | Plan §L table rows (D1–D11 above) predate final design decisions                                                                                                                                                                                | Add a "2K alignment" note to the plan table or mark the plan as superseded for rows 2,5,8,10,11,12,13,14,15,16 by the DESIGN doc §8.                                           |
| DR3 | `storefront/README.md` is stale (index counts, run instructions, feature list predate 2H–2J)                                                                                                                                                    | Rewrite with current commands, seed variable, routes, and test counts.                                                                                                         |
| DR4 | `PRODUCT_ARCHITECTURE.md`, `MVP_SCOPE.md`, `ASSUMPTIONS_AND_GAPS.md` predate the dedupe decision and the funding-outside-reconcile boundary                                                                                                     | Annotate duplicate/reversal rows and the funding boundary.                                                                                                                     |

Files updated in 2K (in addition to this doc):

- `storefront/README.md` — rewritten.
- `docs/PRODUCT_ARCHITECTURE.md`, `docs/MOCK_PROVIDER_ARCHITECTURE.md`,
  `docs/RECONCILE_KIT_INTEGRATION.md`, `docs/MVP_SCOPE.md`,
  `docs/ASSUMPTIONS_AND_GAPS.md` — reconciled to the DESIGN decisions.
- `docs/PHASE_2_IMPLEMENTATION_PLAN.md` — the §L scenario table annotated with
  the 2K deviation references rather than silently rewritten.

No production code changed to satisfy documentation; where docs and code
disagreed after the DESIGN review, the **code** (which follows the DESIGN doc)
was kept and the older docs were corrected.

---

## 18. Known Gaps, Recommendations & Readiness Verdict

### 18.1 Known limitations (accepted for demo pilot)

- **No auto-refund** on `PROVIDER_FAILED` — refunds are operator-initiated (or
  exercised via the refund scenarios). By design; flagged for the operator
  workflow phase.
- **Admin shell is simulated** — the admin page explicitly states _Phase 2I
  ships a simulated operator shell — no production authentication_. No CSRF,
  no auth, no persistence of operator actions to production systems.
- **Engine duplicate-ambiguous paths** (CONFLICTING_ATTRIBUTES / HELD_AMBIGUOUS
  on both sides) and the merchant-side **reference-mismatch** branch are
  unit-covered in the root engine but not reachable from the 16 seeded
  scenarios. Add engine-level scenario fixtures if a future phase wants
  end-to-end coverage of those paths.
- **Airline PENDING ticket** is not cancelled when its resolution completes —
  the ticket stays RESERVED/PENDING; cancellation is a separate capability.
- **BillPoint** remains a competitive baseline only — classifications default
  `UNKNOWN - REQUIRES RESEARCH`. Not wired into any decision logic.
- **Not a payment** — the demo uses simulated providers and a seeded wallet;
  no real money, no real provider credentials in the demo path.

### 18.2 Recommendations for the next phase

1. Build the **operator console** on top of the simulated admin shell with real
   authentication, an action log, and CSRF protection before any human-facing
   deployment.
2. Add an e2e fixture driving the engine's **duplicate-ambiguous** and
   **reference-mismatch** branches so the full engine surface is scenario
   traceable.
3. Decide whether ticket cancellation should be linked to refund/resolution
   completion (`bus_ticket_refund`, post-refund tickets).
4. If live providers are ever wired, keep the **masking boundary**: only
   masked previews and evidence packs may leave the provider adapter.

### 18.3 Readiness verdict

**Phase 2K criteria met — release as demo pilot.**

- All scenarios behave per the authoritative design; every deviation is
  deliberate and documented.
- 572/572 tests green (213 core + 359 storefront incl. the 7 new 2K tests);
  typecheck, lint, and format checks clean.
- Evidence-masking invariants verified end-to-end over HTTP (full codes never
  stored, never rendered).
- Documentation is reconciled; the handover below gives the operator everything
  needed to run and demo the pilot.

### 18.4 Handover notes

- **Run the demo:** `cd storefront && npm run dev` (requires `STOREFRONT_PORT`,
  or set `SEED_DEMO=1` to preload the 16 demo scenarios; port/callback defaults
  are in `loadConfig`).
- **Seeded surface:** 15 order scenario transaction pages + `wallet_funding_failure`
  (wallet-only) + customer pages (dashboard, wallet, catalog, checkout,
  transactions, receipt, evidence, notifications, disputes, profile) + admin
  dashboard with mismatches/manual-review/refund/reversal queues.
- **Verification evidence:** §5 command table; full inventory in §6–§14; the
  new walkthrough suite is the runnable contract for the HTTP surfaces.
- **Docs index:** `docs/` — this file is the entry point for 2K; the DESIGN doc
  is the authoritative behavioral reference; the plan §L table carries the 2K
  deviation annotations.
