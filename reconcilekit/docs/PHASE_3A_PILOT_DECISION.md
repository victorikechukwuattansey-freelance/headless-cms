# Phase 3A Pilot Decision

**Project:** ReconcileKit (Core + Storefront)
**Type:** Decision artifact (evidence-based decision recorded; documentation only — no implementation performed)
**Date:** 2026-09-11
**Authoritative inputs:** `PHASE_3A_PILOT_FINDINGS.md` (cross-operator analysis); `PHASE_3A_OPERATOR_1_EVIDENCE.md`; `PHASE_3A_OPERATOR_2_EVIDENCE.md`; `PHASE_3A_PILOT_EXECUTION_WORKSHEET.md`; `PHASE_3A_PILOT_INPUT_CONTRACT.md`; `PHASE_3A_LOCAL_OPERATOR_GUIDE.md`; `PHASE_3A_BLOCKER_ANALYSIS.md`; `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md`

---

## 1. Decision

**PASS WITH CONDITIONS**

The two operator runs satisfy the Phase 3A acceptance criteria for the operational pilot. Both runs are complete, real (test-mode) data was used, provider evidence was Paystack test mode, a real status disagreement was surfaced and understood in each run, findings and this decision record exist, and no ReconcileKit correctness defect was demonstrated. The conditions below are required because a usability gap is evidenced: the `abandoned→UNKNOWN` / `STATUS_UNRESOLVED` status semantics are not independently obvious to operators, and live-mode provider-only noise was confusing in both runs.

## 2. Acceptance Criteria Review

| Criterion                                                        | Evidence                                                                                                                                                    | Status                             |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| ≥2 real operators complete ≥1 full end-to-end reconciliation     | Operator 1 (RK-PILOT-006..010) and Operator 2 (RK-PILOT-011..015) each completed inspect → preview → review → recorded run → replay, in file and live modes | PASS                               |
| Real merchant data                                               | Real Paystack test-mode transaction states captured to merchant CSV snapshots (5 rows per run)                                                              | PASS                               |
| Paystack test-mode provider evidence                             | Live test-mode fetch + Paystack Verify JSON in each run; `sk_test_...` used, never printed/written                                                          | PASS                               |
| ≥1 real discrepancy surfaced and understood                      | RK-PILOT-009/010 and RK-PILOT-014/015: merchant `PENDING` vs provider `abandoned→UNKNOWN`; both operators echoed "started but never paid / do not fulfill"  | PASS                               |
| Findings log produced                                            | Operator evidence documents + `PHASE_3A_PILOT_FINDINGS.md`                                                                                                  | PASS                               |
| Decision record produced                                         | This document                                                                                                                                               | PASS                               |
| Evidence sufficient to explain the result                        | Both operators: Sufficient                                                                                                                                  | PASS                               |
| Operators could interpret results without substantial assistance | Operator 1: Yes (after mapping cited). Operator 2: No — required explanation. Worksheet §15 "ready to pass" item not fully met                              | PARTIAL — the basis for Conditions |
| Baseline green; engine untouched                                 | No source/test/schema/fixture/CLI/manifest change in either run; frozen engine used unchanged                                                               | PASS                               |

## 3. Evidence Supporting Decision

- Both operators completed the full procedure **independently** (fresh transactions, references, amounts, timestamps, and separate pilot-data directories; Operator 2 interpretation captured in its own words before this analysis).
- **Identical reconciliation shape** in both runs: 3 MATCH / 2 STATUS_UNRESOLVED, deterministic exact-reference matching, recorded 5 → replayed 5, store at exactly 5 lines.
- **Live and Verify-file modes agree** in both runs, confirming the reconciliation result is not an artifact of provider-evidence mode.
- **Correct conservative behavior:** the engine preserved `abandoned→UNKNOWN` and surfaced `STATUS_UNRESOLVED` rather than guessing or relabeling; both operators reached the correct safety-critical operational conclusion (do not fulfill, follow up, leave unresolved).
- **No defect:** both evidence documents and the analysis find no ReconcileKit correctness defect and no blocked step.
- **Usability condition evidence:** Operator 2 independently could not interpret the result without the `abandoned→UNKNOWN` explanation; Operator 1 needed the same mapping cited; both flagged live-mode provider-only noise and the absence of a scoped live fetch.

## 4. Conditions

If PASS WITH CONDITIONS:

1. **Ship operator-facing status-semantics documentation** covering the frozen mapping (`success→SUCCESS`, `failed→FAILED`, `pending→PENDING`, `abandoned→UNKNOWN`, never `CANCELLED`) and the meaning of `STATUS_UNRESOLVED` (an unresolved status pair with a defined operator action: do not fulfill, follow up, verify) before the broader merchant-facing pilot. Must be published as part of the operator on-ramp / local operator guide.
2. **Document live-mode whole-account scope and provide a scoped alternative** — either ship a reference/date-window scoping option for `--live-paystack` or make Verify-file mode the documented standard for windowed reconciliation — so provider-only account history does not confuse operators in the next wave.
3. **Record Cloudflare Turnstile as an environmental limitation** in the operator runbook, stating that hosted-checkout completion is a manual/browser step or requires the direct-charge path (no ReconcileKit change is required for it).

No condition requires an engine, adapter, matcher, identifier, mapping, or intake change.

## 5. Required Follow-up

### Required before broader deployment

- The three conditions in §4 (all are documentation/UX and operational guidance; none is code).

### Recommended but non-blocking

- Recruit additional, genuinely independent operators for the next wave (the two pilot operators share the same human + AI-assistant pair — recorded as a stewardship caveat).
- Add a scoped `--live-paystack` option (reference/date window) to remove provider-only noise; optional engineering, not required by the decision.
- Add a status-semantics quick-reference to the operator guide.

### Operational follow-up

- Apply the recorded next-action uniformly to `STATUS_UNRESOLVED` events (do not fulfill; follow up with customer; keep unresolved until payment evidence confirms capture).
- Keep the four pilot unresolved refunds/orders (RK-PILOT-009, 010, 014, 015) open in the merchant ledgers pending confirmation, as the operators concluded.

## 6. Deferred Items

No frozen architecture decision is reopened by this decision. In particular:

- `abandoned → UNKNOWN` remains (never `CANCELLED`); `STATUS_UNRESOLVED` remains report data with its current meaning.
- No new discrepancy codes, no fuzzy/probabilistic/amount-only/timestamp-only matching.
- Provider CSV remains ineligible as provider evidence (no deterministic join anchor).
- 3E (webhooks) and 3F (persistence) remain gated; no pilot finding in these two runs is recorded as triggering them.
- Production rails, FX, betting, tenant/org, provider expansion, and unrelated Phase 3 work remain out of scope.

## 7. Decision Rationale

The decision is PASS WITH CONDITIONS rather than PASS, ITERATE, or BLOCKED, from the actual evidence:

- **Not ITERATE:** worksheet §15 "requires another iteration" items are all unmet — operators prepared merchant inputs reliably (5/5 accepted both runs); provider evidence was obtained reliably in two modes; the join anchor was present and deterministic in every row; findings were explainable from available evidence (sufficient, both runs); operators agreed on meaning (both: started-but-never-paid, do not fulfill); no critical safety/privacy issue; no software defect blocked completion.
- **Not BLOCKED:** no blocker at any step; the only prior 3A blockers (from the blocker analysis) were operator-rail gaps that the pilot CLI and guide already resolve, as evidenced by both runs completing.
- **Not clean PASS:** the worksheet readiness item "Operators could interpret results without substantial assistance" is only partially met (Operator 2 could not independently interpret; Operator 1 needed the mapping cited), and both runs flagged live-mode provider-only noise. These are usability conditions of a correct tool, so the pass carries conditions rather than being unconditional.
- **Why a conditions-pass is correct here:** correct conservative reconciliation behavior (an unresolved status pair reported as `STATUS_UNRESOLVED`) is not a defect merely because the operator needed an explanation (analysis §6, §8); a usability gap warrants documented conditions, not an iteration, per the decision discipline. The evidence establishes transaction truth and operator actionability in both runs.

## 8. Scope Boundary

Phase 3A validates **operational usability and evidence sufficiency** — it does not itself authorize:

- production Paystack credentials;
- production deployment;
- production money movement;
- FX / currency conversion;
- betting / operational betting flows;
- tenant/org implementation;
- unrelated Phase 3 work (3C/3D/3E/3F are governed by their own gates; 3E and 3F remain gated).

The next implementation phase, if any, will be authorized only after this Phase 3A decision has been reviewed by the owner.

## 9. Status

PHASE 3A DECISION RECORDED — **PASS WITH CONDITIONS** — CROSS-OPERATOR ANALYSIS COMPLETE

Next implementation phase: PENDING OWNER REVIEW.
