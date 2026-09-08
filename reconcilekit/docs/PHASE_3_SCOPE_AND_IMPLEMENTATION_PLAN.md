# Reconcile Kit — Phase 3 Scope & Implementation Plan

> **Status:** APPROVED AS PLANNING DELIVERABLE — read-only for source. No
> implementation happens from this document.
> **Baseline authority:** `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md`
> (frozen). This plan extends Phase 2; it does not reopen it.

---

## 1. Executive Summary

Phase 2 delivered and froze a local-first validation marketplace: mock digital
services, a mock wallet, deterministic mock providers, the Payment Source
Layer, and ReconcileKit-backed transaction truth — proven by
**Storefront 388/388** and **Root 601/601**, both typechecks, ESLint, and
Prettier.

Phase 3 answers the question Phase 2 deliberately deferred: **does the tool,
in real operator hands, achieve the validation the product was built for?**

The recommended approach is **Strategy A — Operational Reconciliation Pilot
First**, wrapped in four low-risk supporting tracks:

- 3A Operational Reconciliation Pilot (spine)
- 3B Merchant CSV onboarding & export tooling
- 3C Transaction-truth customer surface (one interactive UI)
- 3D Mismatch investigation workflows

Two infrastructure tracks (**3E webhook ingestion**, **3F durable
persistence**) are defined but **gated**: they start only when a concrete pilot
finding justifies them and the owner approves. Production auth, CSRF,
deployment, billing, multi-tenancy, FX, operational betting, provider
expansion, and any engine change remain explicit **non-goals**.

Decision: `PHASE 3 PLAN APPROVED FOR IMPLEMENTATION`.
Final gate: `CLEARED FOR PHASE 3 IMPLEMENTATION`.

---

## 2. Baseline (Frozen Phase 2 State)

Frozen by `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` (re-verified
2026-09-08):

```text
Storefront tests:  388/388 passing
Root tests:        601/601 passing
Storefront typecheck: PASS
Root typecheck:       PASS
ESLint:               PASS
Prettier:             PASS
```

Invariants Phase 3 must preserve (freeze §4, §9):

- Reconcile Kit boundary: `reconcileRecords()` is the single matcher; exact
  reference matching only; no fuzzy/probabilistic/amount-only correlation.
- Three separate truths (payment / ledger / fulfillment) are never collapsed.
- Wallet is append-only, ledger-authoritative; reconciliation is read-only.
- Identifier hierarchy (§5): `mk_txn_...` join anchor + provider `reference`,
  `txn_...` display-only, `wld_...` / `ps_...` / provider refs evidence-only.
- Protected core: `reconcilekit/src/**` and `PaymentRecord`.
- Phase 3 entry criteria (§13) are satisfied.

---

## 3. Problem Statement

The validation MVP exists. What remains unanswered, in order of business
relevance:

1. **Operator comprehension** — can a real operator read a reconciliation
   report and answer "what did I ask for / what happened to my money / what
   did the provider say / what did ReconcileKit determine / what happens
   next"?
2. **Input reality** — merchant dashboards/CSV exports arrive in the wild in
   messy shapes (major units, extra columns, human timestamps). The intake
   path assumes contract-perfect input.
3. **Demo-ability** — the transaction truth the backend produces is not yet
   visible on a customer-facing surface that could be shown to a partner,
   investor, or first design partner.
4. **Operational depth** — when a real mismatch appears, an operator needs a
   drill-down that ends at a masked evidence pack, not a summary line.

Phase 3 is the **first question-first phase**: the pilot produces the findings
that decide which deferred engineering (webhooks, persistence, provider
expansion) is real work versus speculative hardening.

---

## 4. Candidate Workstreams

Scored 1–5 on seven axes; **cost and risk are scored so 5 = most expensive /
riskiest** and therefore subtract from net attractiveness.

| ID  | Workstream                                      | Customer value | Validation value | Commercial value | Architecture leverage | Cost (5=expensive) | Risk (5=high) | Dependency pressure (5=blocks many) |
| --- | ----------------------------------------------- | -------------- | ---------------- | ---------------- | --------------------- | ------------------ | ------------- | ----------------------------------- |
| C1  | Operational Reconciliation Pilot                | 4              | 5                | 4                | 1                     | 1                  | 2             | 4                                   |
| C2  | Transaction-truth customer UI                   | 5              | 4                | 4                | 2                     | 3                  | 2             | 2                                   |
| C3  | Merchant CSV intake & onboarding                | 4              | 4                | 3                | 1                     | 2                  | 2             | 3                                   |
| C4  | Provider Webhook / event ingestion              | 3              | 3                | 3                | 4                     | 3                  | 3             | 3                                   |
| C5  | Mismatch investigation workflows                | 3              | 4                | 3                | 2                     | 3                  | 2             | 2                                   |
| C6  | Durable production persistence                  | 2              | 1                | 2                | 3                     | 5                  | 4             | 4                                   |
| C7  | Payment-source expansion (PSP parity)           | 3              | 3                | 3                | 3                     | 4                  | 3             | 1                                   |
| C8  | Production hardening (auth/CSRF/deploy/billing) | 1              | 1                | 2                | 2                     | 5                  | 4             | 5                                   |

---

## 5. Prioritization Matrix

| Rank | ID  | Net value (value axes − cost − risk) | Why it ranks where it does                                                                                                                                                     |
| ---- | --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | C1  | 14 − 3 = 11                          | Highest validation value at the lowest cost and architectural risk; unblocks every downstream decision.                                                                        |
| 2    | C3  | 12 − 4 = 8                           | Cheap, directly feeds the pilot; turns messy operator exports into the contract.                                                                                               |
| 3    | C2  | 15 − 5 = 10                          | Highest raw customer value but costs more than C1/C3; **rank is sequence, not raw score** — listed below C3 because the pilot must first define what truth the UI should show. |
| 4    | C4  | 13 − 6 = 7                           | Strong architectural leverage (uses existing `pevt_...` idempotency) but validates little until a pilot exists.                                                                |
| 5    | C5  | 12 − 5 = 7                           | Operational depth only matters once a real mismatch has been found.                                                                                                            |
| 6    | C7  | 12 − 7 = 5                           | Attractive commercially, speculative until the pilot names a provider gap.                                                                                                     |
| 7    | C6  | 8 − 9 = −1                           | Real need, but only if the pilot demands it; otherwise premature.                                                                                                              |
| 8    | C8  | 6 − 9 = −3                           | Highest cost, lowest validation value; Phase 4.                                                                                                                                |

> **Note:** rank = priority order (a deliberate sequence decision), not a
> strictly descending sort of the net-value column. C2 scores higher than C3
> but follows it because the pilot determines what the UI must show.

**Rank these on value, not hardening.** C1, C3, C2, C5 are selected for Phase 3
because they produce evidence. C4 is gated. C6 is gated. C7 and C8 are not
Phase 3 work.

---

## 6. Strategy Options

### Option A — Operational Reconciliation Pilot First

Run the existing engine and storefront against **real small bill-payment / VTU
operators** using Paystack test mode and their real merchant export CSVs.
Collect: reports they can read, mismatches they find, evidence packs they can
act on.

- **Pros:** cheapest, fastest signal; zero architecture risk; tests the
  actual product promise with no investment in speculative rails.
- **Cons:** proves comprehension, not scale; operators must be recruited;
  no visible customer UI yet.
- **Enables:** an evidence-based decision on webhooks/persistence.
- **Complexity:** LOW–MEDIUM. **Validation:** the core measure.

### Option B — Production Infrastructure First

Durable DB, auth, CSRF, deployment before any pilot.

- **Pros:** removes prototype limitations; feels concrete.
- **Cons:** highest cost (C6+C8 = net −4); validates nothing about trust;
  contradicts §12 (production infra explicitly deferred).
- **Enables:** a hosted product — which no pilot has yet justified.
- **Complexity:** HIGH. **Validation:** LOW.

### Option C — Payment-Source Expansion First

Add `BANK_TRANSFER`, `MANUAL_CSV`, `FLUTTERWAVE`, `FUTURE_PSP` ingestion.

- **Pros:** strengthens provider-neutral normalization; commercially
  defensible breadth story.
- **Cons:** validates normalization the pilot has not yet proven to matter;
  C7 = net 5; expensive (cost 4) before any revenue signal.
- **Enables:** a parity marketing claim only with `BILLPOINT_PARITY_MATRIX.md`
  research still `UNKNOWN - REQUIRES RESEARCH`.
- **Complexity:** MEDIUM–HIGH. **Validation:** MEDIUM.

### Option D — Customer-Facing Truth Surface First

Build the transaction timeline / receipt / evidence UI first.

- **Pros:** the strongest demo artifact; high customer value (C2 = 15).
- **Cons:** risks building UI against untested assumptions about what truth
  operators want shown; medium cost; should follow, not precede, pilot signal.
- **Enables:** partner/investor demos.
- **Complexity:** MEDIUM. **Validation:** MEDIUM (self-declared).

---

## 7. Recommended Strategy

**Option A — Operational Reconciliation Pilot First**, with 3B (CSV intake)
executed to feed it and 3C (truth surface) and 3D (investigation workflows)
scoped as supporting tracks. Gated tracks 3E (webhook) and 3F (persistence)
start only behind a documented pilot finding plus owner approval.

Rationale:

- C1 is the only candidate that is cheap, low-risk, high-validation, and
  unblocks decisions about everything else.
- Pilot findings are required before C6/C8 investment is defensible
  (the freeze's §12 explicitly deferred production infrastructure).
- 3C is deliberately placed _after_ pilot wave 1 so its screens show the
  truth operators actually needed, not the truth we assumed.

---

## 8. Phase 3 Scope

### In scope — tracks

| Track                                               | Objective                                                                                                                                                                                                   | Problem it answers                                                             | Complexity  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------- |
| **3A — Operational Reconciliation Pilot**           | Run ≥2 real operators through full reconcile runs (file mode then live Paystack test mode); collect findings log + decision record.                                                                         | Do operators understand, trust, and act on ReconcileKit truth?                 | LOW         |
| **3B — Merchant CSV intake & onboarding**           | From operator dashboard exports → contract-correct merchant rows (minor-unit conversion preview, column mapping, timestamp normalization). Ship the conversion guide promised by `README.md` §Amount Units. | Real-world input is messy; remove the friction without touching the engine.    | LOW         |
| **3C — Transaction-truth customer surface**         | One interactive transaction detail page: timeline, receipt, masked evidence pack, resolution status, "what happens next" — fed only by existing storefront modules.                                         | "Show me exactly what happened" needs a customer-visible surface.              | MEDIUM      |
| **3D — Mismatch investigation workflows**           | Drill-down from unresolved/mismatched summary → per-record determination → masked evidence pack, without mutating any truth.                                                                                | Operators need a path from "discrepancy" to "actionable verdict".              | MEDIUM      |
| **3E — Provider webhook / event ingestion (GATED)** | Ingest Paystack webhook events through the existing payment-source layer using `pevt_...` exact-once idempotency.                                                                                           | Only if a pilot finding shows callback/verify gaps lose or duplicate events.   | MEDIUM      |
| **3F — Durable persistence (GATED)**                | Choose and migrate to a durable store (e.g. snapshot + append) with lossless migration from JSONL.                                                                                                          | Only if pilot shows restart/concurrency data loss or multi-operator necessity. | MEDIUM–HIGH |

### Disposition of `§12` deferred work (freeze)

| Deferred capability                                                     | Phase 3 disposition                                                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant/org isolation                                                    | NON-GOAL — triggers Phase 4, not a step-down of Phase 3.                                                                                                        |
| `BANK_TRANSFER` / `MANUAL_CSV` / `FLUTTERWAVE` / `FUTURE_PSP` ingestion | NOT IN SCOPE. If a pilot operator names a specific source, it becomes an explicit Phase 3 extension request (documented, owner-approved), never a silent build. |
| Operational betting flow                                                | NON-GOAL — `FUTURE_COMPLIANCE_GATED` stays.                                                                                                                     |
| FX / currency conversion                                                | NON-GOAL — catalog currency namespaces stay explicit.                                                                                                           |
| Production persistence                                                  | **3F (GATED)** — no build without pilot finding + approval.                                                                                                     |
| Authentication / CSRF                                                   | NON-GOAL — local-first demo auth shell stays as built.                                                                                                          |
| Webhooks                                                                | **3E (GATED)** — no build without pilot finding + approval.                                                                                                     |
| Deployment / billing                                                    | NON-GOAL — Phase 4.                                                                                                                                             |
| UI interactivity (full admin)                                           | Partial — 3C + 3D are the only interactive surfaces; the rest of the static htmx shells stay.                                                                   |
| `WALLET_FIXED_TIMESTAMP` replacement                                    | NON-GOAL — prototype determinism is intentional.                                                                                                                |

---

## 9. Sequence (3A → 3B → …)

```text
Phase 3 kickoff
   │
   ├─▶ 3B CSV intake & onboarding tooling ──┐
   │         (feeds pilot wave 1)           │
   ▼                                        ▼
3A Pilot wave 1 (2 operators, file mode ──▶ operator runs live Paystack test)
   │                                        │
   ├─▶ findings log + decision record       │
   ▼                                        ▼
3C Transaction-truth surface   ◀──── 3A wave-1 findings shape the screens
   │
3D Mismatch investigation workflows (after wave 1 surfaces a real mismatch)
   │
   ├─▶ 3E GATE: did the pilot show callback/verify event-gaps? ── NO → Phase 4 backlog
   │        YES → owner approval → 3E
   └─▶ 3F GATE: did the pilot show data-loss/concurrency demand? ── NO → Phase 4 backlog
            YES → owner approval → 3F
```

Hard rule: 3A never waits on 3E/3F. 3C/3D never change engine, wallet, or
reconcile behavior.

---

## 10. Acceptance Gates

| Gate  | Entry                                                                         | Exit (acceptance)                                                                                                                    |
| ----- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 3A    | Baseline green; ≥2 operators recruited; Paystack test-mode accounts available | ≥2 operators each complete ≥1 full e2e reconcil; ≥1 real discrepancy surfaced & understood; findings log + decision record delivered |
| 3B    | Pilot samples collected                                                       | All pilot export samples converted to contract-correct merchant rows; conversion preview verified; guide shipped                     |
| 3C    | 3A wave 1 done                                                                | Detail page live for SUCCESS / DISCREPANCY / UNRESOLVED; evidence pack masked; tests green; baseline suites green                    |
| 3D    | ≥1 real mismatch from 3A                                                      | Summmary → determination → evidence pack in ≤3 interactions; runbook verified; tests green                                           |
| 3E    | Pilot finding + owner approval                                                | Idempotent webhook ingest (`pevt_...` stable); no duplicate/lost records; tests green; baseline green                                |
| 3F    | Pilot finding + owner approval                                                | Lossless migration; snapshot + append verified; baseline green; rollback documented                                                  |
| Close | All gates reached OR gated tracks explicitly deferred to Phase 4              | Phase 3 completion criteria (§17) met; no silent deferrals                                                                           |

Every gate failure returns to the owning track; engine and wallet boundaries
are never touched to reach a gate.

---

## 11. Pilot Readiness

**Required before pilot wave 1:**

- Operator on-ramp doc (quick start from `README.md` + file vs live modes).
- Merchant CSV contract + minor-unit conversion guide (**3B** deliverable).
- Evidence pack availability for every mismatch (existing
  `marketplace/truth.ts` + `marketplace/payment-sources/evidence.ts`
  masking; no new truth machinery).
- Paystack test-mode accounts for operators + owner.

**Useful (non-blocking):**

- Transaction-truth surface (**3C**) for operator-facing demos.
- Webhook auto-update (**3E**) to remove manual verification.
- Aggregated findings report template.

**Not required for pilot:**

- Auth, CSRF, durable DB, deployment, multi-tenancy, billing, FX.

---

## 12. Success Metrics

- **Pilot:** ≥2 operators complete ≥1 reconcile within 4 weeks; ≥1 real
  discrepancy found & echoed back correctly in the operator's own words;
  100% of mismatches have exportable masked evidence packs.
- **Onboarding:** every pilot CSV converts to contract rows without manual
  editing; conversion preview is the operator's single confirmation step.
- **Surface:** detail page renders SUCCESS + DISCREPANCY + UNRESOLVED states;
  evidence remains masked.
- **Engineering:** Root **601/601** and Storefront **388/388** remain green;
  engine untouched; **no net-new runtime dependencies** without approval.
- **Decision quality:** every deferred capability confidently classified as
  "do", "defer", or "drop" from pilot evidence — not from assumption.

---

## 13. Non-Goals (Phase 3)

- **No engine changes**: no fuzzy matching, no new matchers, no
  `reconcileRecords()` modifications, no new discrepancy codes.
- **No production rails**: auth, CSRF, deployment, billing, durable DB
  (gated, not authorized by default).
- **No multi-tenancy**, no org model.
- **No FX engine**, no operational betting, no real money movement, no real
  provider integrations beyond Paystack test mode.
- **No payment-source expansion** unless owner-approved as an explicit
  extension.
- **No stack swaps** (React/Vite/Next/Playwright/ORM) and no blanket
  replacement of the static htmx shells — only 3C/3D surfaces.
- **No `WALLET_FIXED_TIMESTAMP` replacement.**
- No `BILLPOINT_PARITY_MATRIX.md` parity claims without research (all rows
  remain `UNKNOWN - REQUIRES RESEARCH`).

---

## 14. Dependencies

| Dependency                                                               | Owner                     | Needed by   |
| ------------------------------------------------------------------------ | ------------------------- | ----------- |
| 2–3 pilot operators (small bill-payment / VTU businesses)                | Project owner             | 3A          |
| Paystack test-mode accounts + secret access per operator                 | Project owner / operators | 3A          |
| Real merchant dashboard CSV exports                                      | Operators                 | 3A, 3B      |
| Owner approval for gated tracks 3E/3F                                    | Project owner             | 3E, 3F      |
| Frozen baseline suites as regression guard                               | Repo                      | all tracks  |
| `BILLPOINT_PARITY_MATRIX.md` research (only if a parity claim is needed) | Project owner             | not Phase 3 |

---

## 15. Risks & Stop Conditions

| Risk                                                 | Likelihood | Impact | Mitigation                                                                                                         | Stop if                                                                      |
| ---------------------------------------------------- | ---------- | ------ | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| No pilot operators                                   | MED        | High   | Recruit from existing campaign/business network; wave 1 accepts 1 operator; document the blocker, do not fake data | Pilot unreachable AND 3C/3D/3E/3F start anyway without owner sign-off        |
| Paystack test-mode limits surface as "real" failures | MED        | Low    | Distinguish provider-access failures from reconciliation findings (existing exit-code model)                       | A "finding" is claimed as real money inconsistency                           |
| Messy operator CSVs can't be normalized              | MED        | MED    | 3B ships before wave 1; sample export grabbed at recruitment                                                       | Intake requires editing engine or adapter semantics                          |
| Scope creep into production rails                    | MED        | HIGH   | §13 non-goals + §8 gated tracks; every infra ask routed through a documented pilot finding                         | Any production-infra build begins without the 3E/3F gate                     |
| A pilot finding appears to require an engine fix     | LOW        | HIGH   | Freeze §14 architecture-change procedure; log the conflict, never silently patch the engine                        | Implementation proceeds on the protected core without explicit approval      |
| 3C UI scope explosion                                | MED        | MED    | 3C is a single page rendered by existing modules; no framework adoption                                            | 3C grows into a full UI phase within Phase 3                                 |
| 3A/3B/3C/3D drag past 6 weeks                        | MED        | MED    | Time-boxed waves; defer 3E/3F to Phase 4 at the 6-week mark                                                        | Phase 3 exceeds its window without a re-planned budget approved by the owner |

---

## 16. Architecture-Change Procedure

Real change requests that intersect the freeze follow
`PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §14 verbatim: **STOP → document
the conflict → identify the invariant → explain insufficiency → propose the
smallest change → identify affected tests and contracts → obtain explicit
approval → only then implement.** Implementation pressure never silently
reopens a frozen decision.

---

## 17. Phase 3 Completion Criteria

Phase 3 is complete when **A or B** holds, so that deferral becomes a recorded
decision, not a silent one:

- **A — Pilot-validated:** 3A and its supporting tracks (3B, 3C, 3D) pass
  their gates (§10), the findings log and decision record are filed, and the
  gated tracks are either triggered (approved) or explicitly deferred to
  Phase 4 with reasons.
- **B — Hard stop with documentation:** the pilot is unreachable or a
  protected-core conflict can't be resolved through §16; Phase 3 halts with
  the blocker documented and a re-plan requested.

In both paths: Root **601/601** + Storefront **388/388** + typechecks + lint +
format remain green; engine untouched; no unreviewed file changes.

---

## Decision & Final Gate

- **Decision:** `PHASE 3 PLAN APPROVED FOR IMPLEMENTATION`
- **Final gate:** `CLEARED FOR PHASE 3 IMPLEMENTATION`
- **Plan document:** `docs/PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md`
- **Baseline authority:** `docs/PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md`
- **Date:** 2026-09-08
