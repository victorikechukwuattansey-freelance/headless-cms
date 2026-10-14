# Phase 3A — Condition Disposition and Next-Phase Entry Gate

**Project:** ReconcileKit (Core + Storefront)
**Type:** Governance artifact (documentation only — no implementation, no source/test/fixture/CLI/manifest changes)
**Date:** 2026-09-11
**Decision assessed:** `PHASE_3A_PILOT_DECISION.md` — **PASS WITH CONDITIONS**
**Owner disposition status:** RECORDED — see "## Owner Approval" below.

---

## Owner Approval

**Date of approval:** 2026-09-11

The owner explicitly approved:

> "I approve the Phase 3A decision of PASS WITH CONDITIONS. Both identified conditions are non-blocking follow-up items. Condition 1 (UNKNOWN/STATUS_UNRESOLVED explanation) and Condition 2 (live provider-only noise) should not block the next implementation phase. No change to the reconciliation engine or frozen architecture is authorized by this approval."

- **Approved decision:** Phase 3A **PASS WITH CONDITIONS** — retained.
- **Condition 1 disposition:** **NON-BLOCKING FOLLOW-UP**.
- **Condition 2 disposition:** **NON-BLOCKING FOLLOW-UP**.
- Neither condition blocks the next implementation phase.
- No reconciliation-engine or frozen-architecture change was authorized by this approval.

This approval is authoritative for this governance increment. It does not authorize the UNKNOWN-explanation improvement, live-provider scoping/filtering, any reconciliation-engine change, or any reopening of the frozen architecture.

---

## Part 1 — Pilot Decision Consistency Check

### Actual criterion count

The approved `PHASE_3A_PILOT_DECISION.md` §2 table contains **9 distinct acceptance criteria**:

| #   | Criterion (from decision doc §2)                                 | Status  |
| --- | ---------------------------------------------------------------- | ------- |
| 1   | ≥2 real operators complete ≥1 full end-to-end reconciliation     | PASS    |
| 2   | Real merchant data                                               | PASS    |
| 3   | Paystack test-mode provider evidence                             | PASS    |
| 4   | ≥1 real discrepancy surfaced and understood                      | PASS    |
| 5   | Findings log produced                                            | PASS    |
| 6   | Decision record produced                                         | PASS    |
| 7   | Evidence sufficient to explain the result                        | PASS    |
| 8   | Operators could interpret results without substantial assistance | PARTIAL |
| 9   | Baseline green; engine untouched                                 | PASS    |

**Result: 8 of 9 PASS; 1 PARTIAL (criterion 8 — the basis for the two conditions).**

The decision doc §2 contains no aggregate count statement. The previous report's "PASS on 10 of 11 items" was an inaccurate informal summary (wrong numerator and wrong denominator). **No editorial correction to `PHASE_3A_PILOT_DECISION.md` is required** — the document's own table is internally consistent.

The `PHASE_3A_PILOT_EXECUTION_WORKSHEET.md` §2 lists **12 granular checkboxes**. The decision doc consolidated these logically: Operator 1 + Operator 2 → criterion 1; discrepancy surfaced + understood → criterion 4; preview/recorded/replay → absorbed into criterion 1 (e2e reconciliation). This consolidation is correct, not inconsistent — different granularity for different audiences.

The plan gate (`PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §10) states **5 aggregate criteria** (≥2 operators e2e; ≥1 real discrepancy surfaced & understood; findings log + decision record; baseline green; engine untouched). The decision doc's 9-row table maps to and satisfies all 5.

---

## Part 2 — Condition 1: STATUS_UNRESOLVED / abandoned → UNKNOWN

### Classification

**C — Non-blocking UX/documentation condition**

### Evidence

- Both operators encountered the same status pair (merchant `PENDING` vs provider `abandoned→UNKNOWN`) in their respective unresolved findings.
- The underlying behavior is deterministic and repeatable (identical status pair in both runs; identical frozen adapter mapping).
- No correctness defect was demonstrated — the engine preserved the provider's original `abandoned` status, mapped it to `UNKNOWN` (not `CANCELLED`), and surfaced `STATUS_UNRESOLVED` as report data (exit 0). This is the correct, conservative outcome under the frozen adapter design.
- Both operators understood the operational consequence after explanation: do not fulfill; follow up with customer; do not treat as paid.
- Operator 1 interpreted the result independently after the frozen mapping was cited.
- Operator 2 could **not** independently interpret the result and required the `abandoned→UNKNOWN` mapping explanation (Operator 2 Evidence §10, Q5; §12).
- Both operators agreed on the operational next action once the result was understood.
- Both evidence documents mark evidence sufficiency as **Sufficient**.

### Correctness vs. explainability

This is an **explainability/usability** gap, not a correctness gap.

- **Correctness:** The engine behaves correctly. The frozen adapter mapping (`abandoned → UNKNOWN`, never `CANCELLED`) produces an honest, conservative result that does not guess or relabel. The operator's correct operational decision ("do not fulfill") follows from understanding the output.
- **Explainability/usability:** The status vocabulary and its operational implication are not self-documenting to operators without reference to the internal adapter mapping. The output alone does not explain _why_ a provider status is `UNKNOWN` or what `STATUS_UNRESOLVED` means operationally.

### Requirement-level recommendation

> An operator should be able to understand why a provider status becomes `UNKNOWN` and what operational action is appropriate without consulting internal adapter documentation.

No implementation mechanism, UI design, or adapter change is specified here.

---

## Part 3 — Condition 2: Whole-account live provider retrieval / provider-only noise

### Classification

**C — Non-blocking operational/UX condition**

### Evidence

- Live mode (`--live-paystack`) returns the **entire test-mode account history**, not just the merchant snapshot window. Operator 1 observed 13 provider-only records; Operator 2 observed 18 (account grew between runs). Both are older account history (Slice 3 refs `stf_*`, `T545*`; earlier pilot attempts `RK-PILOT-001..005`, `RK-PILOT-A01..A05`).
- Both operators found the provider-only records noisy or confusing. Operator 1 expected a scoped live fetch; Operator 2 explicitly rated it as "confusing" (Operator 2 Evidence §10, Q5).
- **Reconciliation correctness is unaffected** — the Verify-file mode (`--provider`) scopes to the 5 pilot references and produces the **identical reconciliation result** (matched 3, unresolved 2, provider-only 0) in both runs.
- File mode is a fully functional scoped alternative that was used and verified in both runs.
- No step was blocked; both runs completed successfully.

### Three-way distinction

1. **Correctness of reconciliation:** Unaffected. Identical results in live and file modes for the pilot transactions.
2. **Scope of provider evidence retrieval:** Live mode returns whole-account history; this is the current behavior, not a defect, but it is broader than the merchant window and produces operator-facing noise.
3. **Operator's ability to understand provider-only records:** Both operators needed the cause explained; the live output does not itself explain why provider-only records appear.

### Requirement-level recommendation

> The live provider evidence workflow should make evidence scope explicit and reduce avoidable provider-only noise.

No filtering algorithm, date-window matching, amount/timestamp correlation, or reconciliation logic change is specified here.

---

## Part 4 — Condition Severity Matrix

| Condition                                       | Evidence                                                                                                                            | Correctness impact                             | Operator impact                                                                           | Blocking? | Disposition                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- | --------------------------------------- |
| 1 — `UNKNOWN` / `STATUS_UNRESOLVED` explanation | Both operators encountered; Operator 2 could not interpret independently; both understood operational consequence after explanation | None — engine correct and conservative         | At least one operator needed explanation; both operators agreed on meaning once explained | No        | Non-blocking UX/documentation condition |
| 2 — live provider-only noise                    | 13/18 provider-only records in both runs; file mode identical result; both operators expected scoped fetch                          | None — reconciliation identical in scoped mode | Both operators found noise confusing; scoped alternative available and verified           | No        | Non-blocking operational/UX condition   |

---

## Part 5 — Owner Decisions Recorded

Recorded 2026-09-11 from the owner approval quoted in "## Owner Approval". Both conditions are disposed **NON-BLOCKING FOLLOW-UP**; neither blocks the next implementation phase.

### Condition 1 — UNKNOWN / STATUS_UNRESOLVED explanation

Owner disposition: **NON-BLOCKING FOLLOW-UP**

- [ ] Required before broader pilot/deployment
- [x] Non-blocking follow-up
- [ ] Accepted limitation for current phase

Owner rationale: Owner approval — "Condition 1 (UNKNOWN/STATUS_UNRESOLVED explanation) ... should not block the next implementation phase."

### Condition 2 — live provider-only noise

Owner disposition: **NON-BLOCKING FOLLOW-UP**

- [ ] Required before broader pilot/deployment
- [x] Non-blocking follow-up
- [ ] Accepted limitation for current phase

Owner rationale: Owner approval — "Condition 2 (live provider-only noise) ... should not block the next implementation phase."

Both dispositions are recorded exactly as approved; nothing here reinterprets or strengthens the owner's approval.

---

## Part 6 — Next Implementation Entry Gate

### Technically established

All of the following are supported by the pilot evidence documents and prior acceptance:

- Phase 2 frozen architecture remains intact (engine untouched; `reconcilekit/src/**` unchanged; no protected core crossed).
- Phase 3B (merchant CSV intake & onboarding) works — the pilot CLI (`storefront/src/cli/pilot-run.ts`) successfully composed the Phase 3B intake, ingestion, and reconciliation pipeline in both runs.
- Phase 3A operational pilot completed with two independent operator runs against real Paystack test-mode data.
- No ReconcileKit correctness defect demonstrated.
- Real Paystack test-mode provider evidence worked (live + file, both verified).
- Exactly-once replay worked (recorded 5 → replayed 5; store unchanged) in both runs.
- Cross-provider evidence paths (live fetch and Verify file) agreed for the pilot transactions.

### Conditions requiring disposition

1. Condition 1 — `STATUS_UNRESOLVED` / `abandoned→UNKNOWN` status explanation (Part 2 above).
2. Condition 2 — live provider-only noise (Part 3 above).

### Still explicitly deferred

Using only `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` §8, §13, and `PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §12:

- **3E — Provider webhook / event ingestion** (gated): requires pilot finding + owner approval. The two pilot runs did not produce webhook/event-gap evidence triggering this gate.
- **3F — Durable persistence** (gated): requires pilot finding + owner approval. No data-loss/concurrency evidence from the pilot.
- **Tenant/org isolation** — Phase 4 non-goal (freeze §10; plan §8).
- **Production persistence, authentication, CSRF, deployment, billing** — non-goal (freeze §10; plan §13).
- **FX / currency conversion engine** — non-goal (plan §13).
- **Operational betting flow** — `FUTURE_COMPLIANCE_GATED` (freeze §4.9; plan §13).
- **`BANK_TRANSFER` / `MANUAL_CSV` / `FLUTTERWAVE` / `FUTURE_PSP` ingestion** — not in scope; extension requires owner approval (plan §8).
- **`WALLET_FIXED_TIMESTAMP` replacement** — non-goal (freeze §10; plan §13).
- **UI interactivity upgrade** (full admin replacing static htmx shells) — partially addressed by 3C/3D only (plan §8).

---

## Part 7 — Entry-Gate Rule

The project may enter the next implementation phase only if **all** of the following hold:

1. Phase 3A acceptance evidence is complete (it is — 9 criteria reviewed; 8 PASS, 1 PARTIAL).
2. The `PASS WITH CONDITIONS` decision is formally retained or otherwise resolved by the owner.
3. Every condition is explicitly classified as either:
   - blocking follow-up required before entry, or
   - non-blocking / accepted for the next phase.
4. No unresolved correctness defect exists (none).
5. The next implementation scope is already authorized by the approved planning document (3C and 3D are authorized after 3A wave 1, per plan §9).

**Outcomes:**

- If any condition is classified as **blocking** by the owner → entry gate = **BLOCKED PENDING CONDITION**.
- If both conditions are classified as **non-blocking / accepted** by the owner → entry gate = **CLEARED FOR NEXT IMPLEMENTATION PHASE**.

**Entry-gate result (2026-09-11):** The owner has confirmed the non-blocking classification for both conditions. The gate is therefore:

**CLEARED FOR NEXT IMPLEMENTATION PHASE**

The gate refers to the next authorized implementation phase per `PHASE_3_SCOPE_AND_IMPLEMENTATION_PLAN.md` (the plan's 3C/3D, authorized after 3A wave 1). No "Phase 4" scope is invented by this closure; "next implementation phase" means the next authorized implementation phase of the approved Phase 3 plan. 3E and 3F remain gated.

Rationale:

1. Phase 3A evidence is complete.
2. Phase 3A remains PASS WITH CONDITIONS.
3. Both conditions have explicit owner dispositions.
4. Both are non-blocking.
5. No correctness defect was demonstrated.
6. The next implementation scope is already authorized by the approved Phase 3 plan.

---

## Part 8 — Do Not Confuse Pilot Pass with Production Readiness

Phase 3A `PASS WITH CONDITIONS` does **NOT** authorize:

- production Paystack credentials;
- production money movement;
- production deployment;
- live customer financial data;
- FX / currency conversion;
- betting / operational betting flows;
- tenant/org implementation (unless separately authorized);
- unrelated feature expansion;
- automatic implementation of pilot recommendations.

Phase 3A validates **operational usability and evidence sufficiency** only.

The entry-gate clearance recorded in Part 7 does **NOT** change this boundary: clearance for the next implementation phase does not mean production-ready, and does not authorize any item listed above.

---

## Part 9 — Frozen Architecture Protection

The pilot did **not** justify reopening any of the following frozen Phase 2 decisions (`PHASE_2_ACCEPTANCE_AND_ARCHITECTURE_FREEZE.md` §4–§9):

- Provider-neutral boundary (freeze §4.1) — ReconcileKit remains provider-neutral; no PSP/processor role adopted.
- Payment / ledger / fulfillment truth separation (freeze §4.2, §6) — three truths remain independently representable.
- Single matcher `reconcileRecords()` (freeze §4.3) — no second, fuzzy, probabilistic, amount-only, or timestamp-only matcher introduced.
- Exact deterministic matching (freeze §4.4) — exact reference equality remains the sole anchor.
- `mk_txn_…` join semantics (freeze §4.4, §5) — the canonical marketplace join anchor is unchanged.
- Identifier hierarchy (freeze §5) — `mk_txn_…` = join anchor; `merchant_reference` = merchant key; `ProviderPayment.reference` = provider join; `wld_…`/`ps_…`/provider refs = evidence only; nothing fabricated.
- Wallet ledger authority (freeze §4.5, §7) — reconciliation consumes wallet evidence; never mutates, appends, reverses, refunds, or becomes wallet truth.
- No fuzzy/probabilistic matching (freeze §4.3) — confirmed in both pilot runs.
- Fulfillment outside reconciliation (freeze §4.6) — reconciliation never calls providers, reserves/issues tickets, issues gift cards, or creates provider attempts.
- Gift-card secret masking (freeze §4.7) — only masked representations cross presentation boundaries.
- Ticket reservation ≠ issuance (freeze §4.8) — no fabrication of issuance from timeout/failure.
- Betting compliance gate (freeze §4.9) — `FUTURE_COMPLIANCE_GATED` unchanged.

The owner approval recorded in this document does **NOT** authorize changes to any of the protected decisions listed above: provider-neutral boundary; payment/ledger/fulfillment separation; single matcher `reconcileRecords()`; exact deterministic matching; `mk_txn_…` join semantics; identifier hierarchy; wallet ledger authority; no fuzzy/probabilistic matching; fulfillment outside reconciliation; gift-card secret masking; ticket reservation ≠ issuance; betting compliance gate.

**No new frozen decisions are added by this governance increment.** The `abandoned → UNKNOWN` mapping and `STATUS_UNRESOLVED` report semantics remain as documented and tested.

---

## Part 10 — Recommended Follow-up Categories

### Condition follow-up record

#### Condition 1 — STATUS_UNRESOLVED

**Status:** Non-blocking follow-up

**Future requirement:** Improve operator-facing explanation of `UNKNOWN` / `STATUS_UNRESOLVED` so that the result and operational consequence are understandable without relying on internal adapter documentation.

No implementation in this increment.

#### Condition 2 — Live provider-only noise

**Status:** Non-blocking follow-up

**Future requirement:** Improve the live provider evidence workflow so evidence scope is explicit and avoidable provider-only noise is reduced.

No filtering algorithm or matching change in this increment.

> **These are requirements/follow-up items, not implementation authorization.**

### Required before broader deployment

Reserved — no condition is classified as **blocking** by the owner. Both conditions are **non-blocking follow-up**. If the owner later classifies a condition as blocking, it becomes required before the next broader pilot or deployment.

### Recommended UX/documentation work

- Ship an operator-facing **status-semantics reference** covering the frozen mapping (`success→SUCCESS`, `failed→FAILED`, `pending→PENDING`, `abandoned→UNKNOWN`, never `CANCELLED`) and the meaning of `STATUS_UNRESOLVED` (unresolved status pair; operational answer: do not fulfill, follow up, verify).
- Document the live-mode whole-account scope and instruct operators to use Verify-file mode for windowed reconciliation.
- Document that hosted-checkout completion is a manual/browser step (Cloudflare Turnstile) or requires the direct-charge path.

### Recommended operational work

- Recruit genuinely independent operators for the next wave (the two pilot operators share the same human + AI-assistant pair).
- Apply the recorded next-action uniformly to `STATUS_UNRESOLVED` events.
- Optionally add a scoped `--live-paystack` option (reference/date window) — this is an engineering enhancement, not a decision requirement.

### Not justified by current evidence

The pilot does **NOT** justify:

- changing `abandoned` to `CANCELLED` in the frozen adapter mapping;
- adding fuzzy matching;
- adding amount-only matching;
- adding timestamp-only matching;
- modifying the core matcher (`reconcileRecords`);
- changing merchant CSV semantics or the frozen CSV contract;
- reinterpreting `UNKNOWN` as a successful or failed payment state;
- introducing provider CSV ingestion as reconciliation evidence;
- any engine, adapter, or protected-core change.

---

## Part 11 — Owner Review Summary

| Decision                  | Current evidence                                            | Owner disposition (2026-09-11)                   |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Phase 3A overall          | 9 criteria assessed: 8 PASS, 1 PARTIAL; no defect           | PASS WITH CONDITIONS — retained                  |
| Condition 1               | Non-blocking UX/documentation — operator explainability gap | NON-BLOCKING FOLLOW-UP                           |
| Condition 2               | Non-blocking operational/UX — provider evidence scope noise | NON-BLOCKING FOLLOW-UP                           |
| Next implementation phase | Evidence supports clearance; owner disposition recorded     | Entry gate CLEARED FOR NEXT IMPLEMENTATION PHASE |

All owner decisions are recorded in "## Owner Approval". No decision in this document remains open.

---

## Part 12 — Final Status

PHASE 3A DECISION RETAINED — PASS WITH CONDITIONS — OWNER DISPOSITION RECORDED — ENTRY GATE CLEARED FOR NEXT IMPLEMENTATION PHASE

Neither condition blocks the next implementation phase. Commencing the next implementation increment still requires explicit owner authorization — it is not started by this document.
