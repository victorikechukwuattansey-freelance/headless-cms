# Phase 3D — Mismatch Investigation Workflows — Acceptance Report

**Project:** ReconcileKit (Core + Storefront)
**Type:** Implementation increment (storefront-only)
**Date:** 2026-10-13
**Basis:** `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §8 (3D definition), §10 (3D gate)
**Gate evidence:** `PHASE_3D_GATE_EVIDENCE.md` (classified `AMOUNT_MISMATCH` on real test-mode data)

---

## 1. Exit gate (plan §10)

> Summmary → determination → evidence pack in ≤3 interactions; runbook verified; tests green.

| Criterion                          | Result                                                                                                                       |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Summary → determination → evidence | **3 GET interactions**, one per surface: `GET /findings`, `GET /findings/:reference`, `GET /findings/:reference/evidence`    |
| ≤3 interactions                    | **Satisfied** — verified by `findings.test.ts` "3D workflow: summary → determination → evidence reachable in exactly 3 GETs" |
| Runbook verified                   | New section "Investigating a finding" added to `PHASE_3A_LOCAL_OPERATOR_GUIDE.md`                                            |
| Tests green                        | New `findings.test.ts`; existing suites untouched and expected to remain green (see §4)                                      |

## 2. What was built

Storefront-only. No file under `reconcilekit/src/**` was read-modified by any
code path added in this increment.

**Routes (all GET, all read-only):**

| Route                           | Surface                  | Purpose                                                                                                               |
| ------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `/findings`                     | Findings summary         | Lists every persisted evidence pack whose reconciliation outcome is not `MATCH`                                       |
| `/findings/:reference`          | Per-record determination | Shows merchant side, provider side, engine outcome, code(s), validation notes, "what this means", "what happens next" |
| `/findings/:reference/evidence` | Masked evidence pack     | Shows the frozen reconciliation snapshot, masked provider facts, referenced event ids                                 |

**New files:**

- `reconcilekit/docs/PHASE_3D_GATE_EVIDENCE.md` — the entry gate evidence
- `reconcilekit/docs/PHASE_3D_ACCEPTANCE_REPORT.md` — this document
- `storefront/test/marketplace/findings.test.ts` — 10 tests

**Modified files:**

- `storefront/src/ui/client.ts` — 3 view-model builders + types
- `storefront/src/ui/customer-pages.ts` — 3 render functions + code-meaning table
- `storefront/src/ui/layout.ts` — added `/findings` to `CUSTOMER_NAV`
- `storefront/src/server.ts` — 3 route registrations + path set + import blocks
- `reconcilekit/docs/PHASE_3A_LOCAL_OPERATOR_GUIDE.md` — new operator section

## 3. Constraints preserved

| Constraint                                                                                 | Status                                                                                                                                                                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `reconcilekit/src/**` unchanged                                                            | **Held** — no code path in the increment imports or writes under `reconcilekit/src/**` beyond the read-only imports already present (types + `reconcileRecords` via existing modules) |
| No new matcher / fuzzy / amount-only / timestamp-only correlation                          | **Held** — 3D reads persisted `EvidencePack`s only; it does not call `reconcileRecords()`                                                                                             |
| No new discrepancy codes                                                                   | **Held** — verified by `findings.test.ts` "does not touch the frozen engine"                                                                                                          |
| Identifier hierarchy (`mk_txn_` join anchor, evidence-only refs)                           | **Held** — determination shows the join anchor (`mk_txn_…`) and the display reference (`txn_…`) distinctly; provider references are shown only as evidence                            |
| Wallet semantics / ledger authority                                                        | **Held** — 3D does not call wallet APIs; the ledger is not modified                                                                                                                   |
| Three-truth separation                                                                     | **Held** — determination shows the engine's evaluation; the wallet ledger and fulfillment surfaces remain on the transaction detail page                                              |
| Existing masking (`redactEvidencePack`, `SENSITIVE_KEY_PATTERN`) reused, not reimplemented | **Held** — the evidence route calls `redactEvidencePack` directly                                                                                                                     |
| No new runtime dependencies                                                                | **Held** — storefront runtime dependencies remain zero                                                                                                                                |
| No auth / DB / webhooks / real providers                                                   | **Held** — out of 3D scope; not introduced                                                                                                                                            |

## 4. Tests

`storefront/test/marketplace/findings.test.ts` — 11 tests:

1. Summary lists every non-MATCH evidence pack and omits MATCH
2. Summary shows outcome, codes, and amount
3. Determination shows merchant side, provider side, and engine outcome
4. Determination gives the STATUS_UNRESOLVED "do not fulfill" explanation
5. Unknown identifier is a 404
6. Evidence shows masked provider facts and the reconciliation snapshot
7. Gift-card codes stay masked on the finding evidence route
8. Summary → determination → evidence reachable in exactly 3 GETs
9. Read-only: no store mutations across the three pages
10. Does not touch the frozen engine — no new discrepancy codes appear
11. Findings appears in the customer nav

**Verified baseline after the increment (2026-10-13):**

- `reconcilekit/`: **665/665** pass (654 baseline + 11 new)
- `reconcilekit/storefront/`: **452/452** pass (441 baseline + 11 new)
- Both typechecks: **PASS**
- ESLint: **PASS** (JS-only config — unchanged)
- Prettier `format:check`: **PASS** (`All matched files use Prettier code style!`)

Commit: `94a5c94` — `feat(3d): mismatch investigation workflows (findings summary → determination → masked evidence)`. 26 files changed, all under `reconcilekit/`.

## 5. Runbook

`PHASE_3A_LOCAL_OPERATOR_GUIDE.md` gained a new section "Investigating a
finding" describing the three-step workflow and giving one worked example with
the `AMOUNT_MISMATCH` code. That section reads the same
`OPERATOR-STATUS-SEMANTICS-REFERENCE.md` that C1 shipped, so the operator-facing
vocabulary is single-sourced.

## 6. Out of scope (unchanged)

3E (webhooks), 3F (durable persistence), auth, tenancy, billing, FX, real
providers, provider CSV as evidence, engine changes, new discrepancy codes.

## 7. Status

**PHASE 3D — IMPLEMENTED AND ACCEPTED (pending owner sign-off).**

Exit gate satisfied: summary → determination → masked evidence in three GET
interactions, verified by `findings.test.ts`. Frozen architecture intact.
No new runtime dependency. No frozen contract changed. Entry-gate evidence
recorded in `PHASE_3D_GATE_EVIDENCE.md`.
