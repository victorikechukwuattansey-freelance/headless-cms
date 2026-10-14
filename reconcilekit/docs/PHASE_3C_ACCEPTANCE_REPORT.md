# PHASE 3C - IMPLEMENTATION AND ACCEPTANCE REPORT

**Project:** Reconcile Kit
**Phase:** 3C - Transaction-Truth Customer Detail Surface
**Date:** 2026-09-12
**Status:** `PHASE 3C IMPLEMENTED AND ACCEPTED`

> **Method note.** This report follows the workspace's `Read → Inspect → Diagnose → Plan → Implement → Verify → Report` engineering sequence (per `ENGINEERING.md`). Work is presentation-only: the existing `/transactions/:id` customer route was enhanced. No engine, matcher, persistence, architecture, or runtime-dependency change was made. 3A owner disposition (PASS WITH CONDITIONS), `PHASE_3A_CONDITION_DISPOSITION_AND_PHASE_4_ENTRY_GATE.md`, governs this phase.

---

## A. Scope Delivered

Phase 3C enhances the **existing** customer transaction-detail surface (one route, no duplicate) into an interactive **transaction-truth surface** with three kept-distinct record statements and a reconciliation determination, reusing the frozen viewmodel/engine output.

- **Three render states, driven by the frozen `reconcileOutcome`:** `SUCCESS` (MATCH), `DISCREPANCY` (DISCREPANCY as-is), `UNRESOLVED` (everything else: UNRESOLVED, MISSING_PROVIDER_RECORD, UNMATCHED_PROVIDER_RECORD, null/UNKNOWN). No new state machine was introduced.
- **State-aware determination banner** replaces the generic outcome banner on the detail page only. Shared `resultBanner` stays untouched for admin/other surfaces.
- **Distinct truth cards:** "What happened to your money" (payment layer statement), "Provider response" (unchanged), **"Ledger truth"** (new — real `wallet_ledger` entries for the transaction), **"Fulfillment truth"** (new — fulfillment status + delivered artifacts, explicitly kept separate from payment success), **"What happens next"** (new — plain-language `truth.nextAction` / `truth.explanation` and resolution line).
- Existing receipt/evidence detail links, action buttons, tickets/gift-card/timeline blocks, and the "Simulated data" card are unchanged.
- Wallet ledger entries flow through the existing viewmodel (`TransactionDetailViewModel.ledger`).

Not implemented (explicitly out of scope, still gated): Phase 3D investigation workflows, 3E webhooks, 3F durable persistence, auth, multi-tenancy, billing, deployment, FX, betting, provider expansion, and any engine/matcher change.

## B. Files Created / Modified

| File                                                                  | Change                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storefront/src/ui/client.ts`                                         | `TransactionDetailViewModel` gained `readonly ledger: readonly WalletLedgerEntry[]`; `transactionDetailViewModel` reads `wallet_ledger`, filters by `transactionId`, and returns `ledger`.                                                                       |
| `storefront/src/ui/customer-pages.ts`                                 | `renderTransactionDetailPage` rebuilt: state banner, payment/ledger/fulfillment/what-happens-next sections; new helpers `DetailRenderState`, `renderStateFor`, `stateBanner`, `paymentTruthBlock`, `ledgerTruthBlock`, `fulfillmentTruthBlock`, `whatNextBlock`. |
| `storefront/src/ui/layout.ts`                                         | `CHIP_CLASS` gained `SUCCESS` → good chip (presentation only; no behavior change).                                                                                                                                                                               |
| `storefront/test/marketplace/transaction-detail-states.test.ts` (new) | 9 tests: state coverage, truth separation, ledger truth, evidence masking, identifier semantics, receipt/evidence survival.                                                                                                                                      |

All changes are under `storefront/src/ui/` and `storefront/test/`. No `src/marketplace/**`, no `reconcilekit/src/**`.

## C. Architecture Compliance

- **Reuse, no duplication.** One route (`/transactions/:id`, `renderTransactionDetailPage`), the existing `transactionDetailViewModel`, and the frozen `reconcileRecords()` output. No second surface, no new API, no new store.
- **Determination displayed as-is.** Outcome and discrepancy codes come verbatim from the frozen determination; the view never re-derives or re-classifies beyond the presentation mapping in `renderStateFor`.
- **No new runtime dependencies.** The addition renders `WalletLedgerEntry` records already persisted by the existing wallet; zero new modules/upstreams.
- **Interactive boundary respected.** Pure server-rendered HTML with existing links; the seeded detail surface remains deterministic test-only.
- **Interoperability with the admin surface preserved.** The same `TransactionDetailViewModel` is consumed by `renderAdminTransactionDetailPage`; the added `ledger` field is provided by the shared constructor, so the admin consumer needed no change.

## D. Render States & Truth Separation

| State       | Frozen input                         | Surface                                                                                                                     |
| ----------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| SUCCESS     | `reconcileOutcome === "MATCH"`       | Green "MATCH — payment, ledger, provider, and fulfillment records line up." + "Money not at risk".                          |
| DISCREPANCY | `reconcileOutcome === "DISCREPANCY"` | Amber banner with the outcome and its codes verbatim (e.g. `AMOUNT_MISMATCH`) + "Money at risk" badge.                      |
| UNRESOLVED  | any other outcome / `null`           | Amber banner: outcome shown + Condition-1 copy (see E) — never a definitive failure claim, never a payment-confirmed claim. |

The page headline states **"Transaction truth — three separate records, shown distinctly."** Payment (payment-record statement + "Payment record status" pill), ledger (actual `wallet_ledger` rows: entry id/type/amount/status/reference/when), and fulfillment (status pill + delivered artifacts + provider-reported attempt) are rendered as three independent cards. The fulfillment card carries the explicit caveat: _"Confirmed payment and delivered fulfillment are separate statements — payment success does not mean the service was delivered."_

"Payment record status", "Expected amount", and "Amount charged" are presented from the payment record, separate from the provider-side "Provider response" card and separate from fulfillment. Input requested ("Airtime for <number> · AirTimeNG · <amount>") and the wallet reference stay visible.

## E. Condition Reconciliation (Phase 3A conditions, presentation-only)

- **Condition 1 — UNKNOWN must not be presented as failed or as proof of payment.** Satisfied. For every non-MATCH / non-DISCREPANCY outcome the state banner renders: _"We found records for this transaction, but they do not give us enough evidence to confirm exactly what happened. This is not proof that anything failed — and the system refuses to guess."_ Tests assert this copy renders for `manual_review` and `provider_timeout` and is absent from SUCCESS/DISCREPANCY. No default-to-credited or default-to-paid framing exists anywhere.
- **Condition 2 — provider-only noise must not be suppressed.** Satisfied. The change is presentation-only for transaction-scoped evidence; the frozen matcher/filter/ingestion are untouched, and genuine provider-only discrepancies still surface (`provider_mismatch` renders DISCREPANCY with codes). Whole provider-account history is never displayed — the surface shows only the transaction-anchored records.

Both conditions remain **non-blocking follow-ups** per the owner disposition; this phase honors them at runtime. Full closure of the owner follow-up is still owned outside this increment.

## F. Evidence Safety & Identifier Semantics

- Evidence continues to flow through the existing `redactEvidencePack` redaction; the evidence detail page declares "sensitive values masked".
- Test verifies no unmasked gift-card code reaches the HTML of either the detail or the evidence response (only the `GC-xxx-****` masked preview).
- Frozen identifier hierarchy preserved on the surface: `mk_txn_…` join anchor (transaction id, rendered exactly once), customer reference, provider reference, wallet reference, and ledger refs all remain distinct labeled rows. A test asserts the join anchor and provider reference are different renderings.
- Resolution status is displayed or omitted exactly as stored (`NONE` → no spurious resolution line; otherwise `mono`-prefixed as-is). No new resolution states.

## G. Timeline & "What happens next"

- Timeline, action buttons, tickets, gift-cards blocks, and receipt are unchanged; the receipt/evidence links resolve on every enhanced state (tested for SUCCESS, DISCREPANCY, UNRESOLVED).
- "What happens next" renders `truth.nextAction` and `truth.explanation` from the frozen truth and a resolution-status line — plain language only, derived text, never a new state machine.

## H. Test Results

| Gate                                                 | Result                                  |
| ---------------------------------------------------- | --------------------------------------- |
| Phase 3C tests (`transaction-detail-states.test.ts`) | **9/9 PASS**                            |
| Storefront suite (`npm test` from `storefront/`)     | **441/441 PASS** (432 baseline + 9 new) |
| Root suite (`npm test` from repo root, recursive)    | **654/654 PASS** (645 baseline + 9 new) |
| Storefront typecheck                                 | **PASS**                                |
| Root typecheck                                       | **PASS**                                |
| ESLint (`npm run lint`)                              | **PASS**                                |
| Prettier (`npm run format:check`)                    | **PASS**                                |

New tests cover: every demo order scenario renders all three truth cards + the fulfillment caveat; SUCCESS clean match; DISCREPANCY codes verbatim; UNRESOLVED Condition-1 copy; the pending-provider UNRESOLVED family; real ledger rows surfaced per transaction; masked evidence on detail + evidence responses; identifier-semantics distinctness; receipt/evidence links still resolve.

## I. Protected-Core Verification

- `reconcilekit/src/**` is **unchanged** — the phase stack (`Domain`, `Application`, engine stores) has no modification from this increment.
- The only files changed this increment are the three `storefront/src/ui/*` files and the new test (see B). No file under `reconcilekit/src/**` or `storefront/src/marketplace/**` was created or modified.
- `reconcileRecords()` remains the sole matcher; no second matcher, heuristic, or CoW; `reconcileOutcome`/codes are displayed, never recomputed.
- Pre-existing unrelated working-tree changes (`storefront/package.json` `pilot:run`, `docs/PHASE_3B_ACCEPTANCE_REPORT.md`) are untouched and outside this increment.

---

## Acceptance & Gate Decision

Phase 3C exit gate (plan `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §10): **"Detail page live for SUCCESS / DISCREPANCY / UNRESOLVED; evidence pack masked; tests green; baseline suites green."**

- ✅ Detail page live for SUCCESS (successful_airtime), DISCREPANCY (provider_mismatch), UNRESOLVED (manual_review, provider_timeout, and remaining order scenarios).
- ✅ Evidence pack masked (redaction verified on detail + evidence HTML).
- ✅ Tests green (9 new), all baseline suites green with zero regressions (441 / 441 storefront, 654 / 654 root).
- ✅ Protected core unchanged; zero engine/`src` modifications.

## CONCLUSION

**PHASE 3C IMPLEMENTED AND ACCEPTED. GATE CLEARED FOR PHASE 3D.**

Phase 3D (investigation workflows) **requires a real mismatch from the operational pilot** (per §10 gate) — this phase does not manufacture one. Phases 3E and 3F remain gated; auth, persistence, webhooks, deployment, and engine changes were not performed.
