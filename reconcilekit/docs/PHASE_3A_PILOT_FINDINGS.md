# Phase 3A Pilot Findings

**Project:** ReconcileKit (Core + Storefront)
**Type:** Analysis artifact (cross-operator evidence analysis; documentation only — no implementation performed)
**Date:** 2026-09-11
**Status:** Analysis complete; decision recorded in `docs/PHASE_3A_PILOT_DECISION.md`

This document compares Operator 1 and Operator 2 (both completed, independently) from the evidence in their individual evidence documents. It classifies every finding, identifies common findings, and states whether any genuine product defect was demonstrated. It does not reopen frozen decisions and does not relabel reconciliation codes.

---

## 1. Pilot Scope

What was actually tested (from the operator evidence documents):

- Real Paystack **test-mode** transactions generated for each operator run (Operator 1: RK-PILOT-006..010; Operator 2: RK-PILOT-011..015), each with 3 confirmed payments and 2 started-but-never-completed ("abandoned") payments.
- Real merchant CSV snapshots in the frozen contract shape (5 data rows each), interpreted as integer **minor units** (kobo), currency NGN, `created_at` as the selected timestamp field.
- Real Paystack provider evidence in both approved forms: **live test-mode fetch** (`--live-paystack`) and a **Paystack Verify JSON file** (`--provider`).
- Full operator CLI procedure per run: **inspect → preview → review before writing → persisted run (`--run`) → exactly-once replay**.
- Provider evidence scoping difference between live mode (whole account) and Verify-file mode (5 pilot refs only) was observed and documented in both runs.
- The tool under test is the operator CLI `storefront/src/cli/pilot-run.ts`; the frozen engine, matcher, adapters, and intake were used unchanged. No source, test, schema, fixture, CLI, or package manifest changed in either run.

Out of scope for this analysis: 3C/3D surfaces, 3E/3F, production rails, FX, betting, tenant/org, provider expansion. Not modified, not re-analyzed beyond what the evidence documents support.

## 2. Operators

| Operator   | Completed | Real Test Data                                                                                  | Full E2E Run                                                                  | Notes                                                                                                                                                              |
| ---------- | --------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Operator 1 | Yes       | Yes — 5 real Paystack test-mode transactions (RK-PILOT-006..010)                                | Yes — file mode then live mode; preview → recorded → replay                   | Session operator (human-supervised AI-assisted), acting as Operator 1. Date 2026-09-11.                                                                            |
| Operator 2 | Yes       | Yes — 5 fresh, independently generated real Paystack test-mode transactions (RK-PILOT-011..015) | Yes — live mode primary, Verify-file cross-check; preview → recorded → replay | Human operator; mechanical execution performed by the OpenCode session on the operator's behalf; interpretation captured from the human operator. Date 2026-09-11. |

Independence notes, from the documents: Operator 2 used fresh references, amounts, timestamps, and a separate pilot-data directory; the worksheet §12 rule ("do not give Operator 2 Operator 1's conclusions before execution") is reflected in the evidence documents (Operator 2's interpretation was captured before this analysis and is recorded in its own words). The operators share the same human + AI-assistant pair (per both evidence documents); this is recorded as a stewardship caveat, not a fabrication. Two independent executions were completed.

## 3. Acceptance Criteria Evidence

Using the approved Phase 3 definition (plan §8, §10 gate 3A; worksheet §1–2). No criterion is market PASS unless the evidence supports it.

| Criterion                                                        | Evidence                                                                                                                                                                                                                                   | Result                                                                        |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| ≥2 real operators complete ≥1 full end-to-end reconciliation     | Operator 1: preview → persisted run (recorded 5) → replay (replayed 5), file + live modes. Operator 2: identical sequence with independent data.                                                                                           | PASS                                                                          |
| Real merchant data                                               | Real test-mode transaction states captured to merchant CSV snapshots; not synthetic fixtures.                                                                                                                                              | PASS                                                                          |
| Paystack test-mode provider evidence                             | Live test-mode fetch + Paystack Verify JSON file in both runs; secret `sk_test_...` used, never printed/written.                                                                                                                           | PASS                                                                          |
| Preview completed before recording                               | Both runs executed preview (phase `preview`, nothing written) before `--run`.                                                                                                                                                              | PASS                                                                          |
| Persisted run completed                                          | Both runs recorded exactly 5 events on first `--run`; store = 5 lines.                                                                                                                                                                     | PASS                                                                          |
| Replay / idempotency verified                                    | Both runs: recorded 0, replayed 5; store unchanged (5 lines).                                                                                                                                                                              | PASS                                                                          |
| ≥1 real discrepancy surfaced and understood                      | 2 per run: RK-PILOT-009/010 and RK-PILOT-014/015 — merchant `PENDING` vs provider `abandoned→UNKNOWN`, echoed back as "started but never paid / do not fulfill."                                                                           | PASS                                                                          |
| Evidence sufficient to explain the result                        | Both operators: Sufficient.                                                                                                                                                                                                                | PASS                                                                          |
| Findings captured                                                | Operator evidence documents produced; this cross-operator findings log.                                                                                                                                                                    | PASS                                                                          |
| Decision record produced                                         | `docs/PHASE_3A_PILOT_DECISION.md` produced by this increment.                                                                                                                                                                              | PASS                                                                          |
| Operators could interpret results without substantial assistance | Operator 1: Yes (after the frozen mapping was cited). Operator 2: No — required the `abandoned→UNKNOWN` mapping explanation.                                                                                                               | PARTIAL                                                                       |
| Baseline suites remain green; engine untouched                   | No source/test/schema/fixture/CLI change in either run; frozen engine reused unchanged. Baseline state as last verified in blocker analysis (Root 618/618, Storefront 405/405, typechecks, lint, format) is not invalidated by either run. | PASS (code untouched; suite not re-run for this documentation-only increment) |

## 4. Cross-Operator Comparison

| Dimension                                                | Operator 1                                                                                                     | Operator 2                                                                                                   | Agreement                                                               | Significance                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1. Test-mode transaction generation                      | RK-PILOT-006..010 via approved `POST /charge` inline-card path; 3 success / 2 abandoned; 08:01 UTC             | RK-PILOT-011..015 via same path; 3 success / 2 abandoned; 08:38 UTC                                          | Full (same method, same status mix)                                     | Consistent, reproducible generation; abandoned rows deliberately created to exercise the real condition |
| 2. Merchant CSV preparation                              | 5 data rows, contract-order columns, `SUCCESS`×3/`PENDING`×2, `source_reference` blank                         | 5 data rows, contract-order columns, `SUCCESS`×3/`PENDING`×2, `source_reference` blank                       | Full                                                                    | CSV contract is unambiguous and repeatable                                                              |
| 3. CSV acceptance                                        | 6 raw → 5 data, accepted 5, rejected 0                                                                         | 6 raw → 5 data, accepted 5, rejected 0                                                                       | Full                                                                    | Intake deterministic                                                                                    |
| 4. Amount-unit interpretation                            | `minor` (kobo), shown up front                                                                                 | `minor` (kobo), shown up front                                                                               | Full                                                                    | No unit ambiguity in either run                                                                         |
| 5. Currency handling                                     | NGN only; set `{NGN}`                                                                                          | NGN only; set `{NGN}`                                                                                        | Full                                                                    | No cross-currency mixing                                                                                |
| 6. Reference handling                                    | Present, unique, consistent; deterministic join anchor                                                         | Present, unique, consistent; deterministic join anchor                                                       | Full                                                                    | Join honesty held; refs matched exactly                                                                 |
| 7. Timestamp selection                                   | `created_at` (epoch-ms)                                                                                        | `created_at` (epoch-ms)                                                                                      | Full                                                                    | Single canonical timestamp field for both datasets                                                      |
| 8. Provider evidence acquisition                         | Live fetch (18 records) + Verify file (5); modes agree                                                         | Live fetch (23 records) + Verify file (5); modes agree                                                       | Full (counts differ by account history)                                 | Identical reconciliation result across modes in both runs                                               |
| 9. Preview usability                                     | Preview wrote nothing; interpretation correct; hesitation on live-vs-file mode choice resolved by running both | Preview wrote nothing; interpretation correct; no hesitation recorded                                        | High                                                                    | Preview is safe and legible; mode choice is the only friction point                                     |
| 10. Persisted run                                        | Recorded 5, replayed 0                                                                                         | Recorded 5, replayed 0                                                                                       | Full                                                                    | Exactly-once recording reproduced                                                                       |
| 11. Exactly-once replay                                  | Recorded 0, replayed 5; store unchanged                                                                        | Recorded 0, replayed 5; store unchanged                                                                      | Full                                                                    | Idempotency proven in both runs                                                                         |
| 12. MATCH interpretation                                 | "Paid in full; SUCCESS both sides"                                                                             | "Amounts/status/timestamp aligned (SUCCESS both sides)"                                                      | Full                                                                    | MATCH meaning unambiguous                                                                               |
| 13. STATUS_UNRESOLVED interpretation                     | Merchant `PENDING` vs provider `abandoned→UNKNOWN`; no auth captured; not settled                              | Merchant `PENDING` vs provider `abandoned→UNKNOWN`; no auth captured; not settled; result needed explanation | Full (interpretation) / PARTIAL (independent understanding, see row 15) | Both diagnosed correctly once the frozen mapping was cited                                              |
| 14. Evidence sufficiency                                 | Sufficient                                                                                                     | Sufficient                                                                                                   | Full                                                                    | Explanability does not depend on more evidence                                                          |
| 15. Operator ability to understand results independently | Yes                                                                                                            | No (required the mapping explanation)                                                                        | Partial — the one divergence                                            | Decisive usability signal: status semantics must be documented                                          |
| 16. Operator understanding of next action                | Do not fulfill 009/010; follow up with customer; fulfill the 3 matched                                         | Do not fulfill 014/015; follow up; verify evidence; leave unresolved                                         | Full                                                                    | Operational consequence is clear and safe in both runs                                                  |
| 17. Provider-only record noise                           | 13 in live mode; explainable account history; expected a scoped live fetch                                     | 18 in live mode; found noisy/confusing; expected a scoped live fetch                                         | Full (same cause and view)                                              | Usability issue, not a correctness defect                                                               |
| 18. Environmental limitations                            | Hosted checkout blocked by Cloudflare Turnstile; used approved direct-charge path                              | Hosted checkout blocked by Cloudflare Turnstile (re-confirmed); used approved path                           | Full                                                                    | Test-infrastructure limitation, not a ReconcileKit defect                                               |
| 19. Workflow friction                                    | Mode choice at Step 2; scoped live fetch unavailable                                                           | Scoped live fetch unavailable; provider-only noise                                                           | High                                                                    | Minor friction; no blocked step                                                                         |
| 20. Actual defects                                       | None demonstrated                                                                                              | None demonstrated                                                                                            | Full                                                                    | No ReconcileKit correctness defect evidenced                                                            |

## 5. Common Findings

Findings supported in **both** operator evidence documents (independently observed):

1. **3 MATCH / 2 STATUS_UNRESOLVED shape** — both runs produced exactly 3 MATCH and 2 STATUS_UNRESOLVED for 5 pilot rows. Confirmed common.
2. **Merchant `PENDING` vs provider `abandoned→UNKNOWN`** — the two unresolved findings in each run share the identical status pair and validation note ("status unresolved: merchant PENDING vs provider UNKNOWN"). Confirmed common.
3. **Need for explanation of the `UNKNOWN` status mapping** — Operator 1 cites the frozen mapping to explain the finding; Operator 2 explicitly could not interpret independently until the `abandoned→UNKNOWN` mapping and STATUS_UNRESOLVED meaning were explained. Confirmed common: the semantics are not self-documenting.
4. **Live-mode provider-only account-history noise** — 13 (Operator 1) and 18 (Operator 2) provider-only records, both identified as pre-existing account history outside the merchant window; both operators expected a scoped live fetch. Confirmed common (usability, not defect).
5. **Hosted checkout Turnstile limitation** — both runs were blocked by Cloudflare Turnstile on hosted checkout and used the approved direct-charge path instead. Confirmed common (environmental).
6. **Successful exactly-once replay** — both runs recorded 5 then replayed 5 with the store unchanged. Confirmed common (working as designed).
7. **Equivalent live vs Verify-file reconciliation** — both runs found the same matched-3/unresolved-2 result whether provider evidence came from the live fetch or the scoped Verify file. Confirmed common (working as designed).

## 6. Reconciliation Correctness

- **MATCH behavior:** both runs matched exactly the three confirmed payments; the engine joined on exact reference equality (`merchant_reference == ProviderPayment.reference`), amounts/status/timestamps aligned within tolerance. No mis-match, no missed match within the pilot window.
- **STATUS_UNRESOLVED behavior:** the engine preserved the provider's original `abandoned` status as `UNKNOWN` (frozen adapter mapping) and compared it against merchant `PENDING`, emitting `STATUS_UNRESOLVED`. This is correct conservative behavior: the engine refuses to guess or to relabel `abandoned` as `SUCCESS`, `FAILED`, or `CANCELLED`. It is report data (exit 0), not an error.
- **Deterministic matching:** only exact reference matching was used; no fuzzy, probabilistic, timestamp-only, or amount-only correlation appears in either run's evidence. References matched exactly and unresolved rows still shared matching references — the divergence is in status, not in identity.
- **Identifier handling:** `merchant_reference` populated; `transaction_id` null (never fabricated) for raw CSV intake; `source_reference` preserved but not used as a join key; provider `reference`/`id` carried through. No fabricated `mk_txn_...` anchors.
- **Replay / idempotency:** recorded 5 / replayed 5 in both runs; store file stayed at exactly 5 lines. Ingestion is exactly-once. As the worksheet notes, replay proves idempotency, not business correctness — business correctness is supported separately by the alignment of live and file reconciliation.

## 7. Evidence Sufficiency

- Evidence was **sufficient** in both runs to explain the findings (amounts, statuses, timestamps, references, and the provider's original abandoned status all available in CSV + Verify/live + CLI output).
- Sufficiency is **distinct** from ease of understanding. The evidence contained everything needed to _conclude_ "started but never paid" and "do not fulfill", but the _status vocabulary itself_ (`UNKNOWN` for abandoned, and the meaning of `STATUS_UNRESOLVED`) was not independently obvious to at least one operator. Evidence sufficiency: established. Independent obviousness: not universal.

## 8. Operator Usability

- **Status mapping explanation:** required in both runs to fully interpret the unresolved findings. Operator 1 recorded that the frozen `abandoned→UNKNOWN` mapping was cited and then marked independent interpretation "Yes"; Operator 2 explicitly required the explanation and marked independent interpretation "No". This is an operator-face documentation/UX gap, not an engine defect: the tool behaved correctly and conservatively.
- **Provider-only noise:** live mode surfaces whole-account history (13 / 18 records). Explainable as account history, not a defect, but both operators found the lack of a scoped live fetch a missing feature; Operator 2 found the noise confusing. Mitigated in both runs by Verify-file mode, which scopes to the 5 pilot references and yields the identical result.
- **Clarity of next action:** strong in both runs — "do not fulfill; follow up with customer; leave unresolved" (Operator 2) and "do not fulfill; follow up or cancel in ledger; fulfill the matched 3" (Operator 1). The operational consequence was unambiguous once the finding was understood.
- **Other observed friction:** Operator 1 hesitated briefly at Step 2 on live-vs-file mode choice (resolved by running both); Operator 2 reported no mode hesitation. Both expected scoped live evidence. No step blocked either operator.

## 9. Environmental Limitations

Recorded (from both operator evidence documents):

1. **Cloudflare Turnstile** blocks the Paystack hosted checkout in the automation environment (Cloudflare challenge frame observed; re-confirmed in Operator 2). Worked around with the previously approved Test Mode `POST /charge` inline-card route. Classified as an environmental / test-automation limitation, not a ReconcileKit defect. No ReconcileKit modification is warranted by it.
2. **Whole-account live fetch scope:** `--live-paystack` returns account history outside the merchant export window, producing provider-only noise. Classified as a scope limitation (usability + environmental), mitigated by Verify-file mode.
3. No test-mode API credit/limit blockers were encountered in either run; all created transactions were reflected exactly as created/charged.

## 10. Actual Defects

Only actual defects supported by evidence are listed.

- No engine, matcher, or adapter defect demonstrated — both runs produced deterministic, correct, conservative results.
- No intake defect — 5/5 accepted, 0 rejected, both runs.
- No idempotency defect — exactly-once verified in both runs.
- No identifier defect — no fabricated anchors; refs handled deterministically.
- The `abandoned→UNKNOWN` mapping and the provider-only noise are intentional behavior and/or documentation gaps, not defects (see Sections 5, 6, 8).

> **No ReconcileKit correctness defect was demonstrated by the two pilot runs.**

## 11. Recommended Follow-up

Follow-up is recommended only. Nothing below is implemented here.

### Documentation/UX follow-up

- Ship an operator-facing **status-semantics note** covering the frozen map (`success→SUCCESS`, `failed→FAILED`, `pending→PENDING`, `abandoned→UNKNOWN`, never `CANCELLED`) and the meaning of `STATUS_UNRESOLVED` (an unresolved status pair, not a confirmed mismatch; operational answer: do not fulfill, follow up, verify).
- Document the live-mode whole-account scope and instruct operators to use Verify-file mode (or a future scoped fetch) for windowed reconciliation.
- Document that hosted-checkout completion is a manual/browser step (Turnstile) or requires the direct-charge path.

### Engineering follow-up

- **None required by the pilot evidence.** Optional (non-blocking): a reference/date-window scoping option for `--live-paystack` to reduce provider-only noise. Any engine, adapter, or mapping change would require the frozen architecture-change procedure and is explicitly not recommended by this evidence.
- Gated tracks 3E (webhooks) and 3F (durable persistence) remain gated; no pilot finding in these runs is recorded as triggering them (no event-gap or data-loss evidence was produced).

### Operational follow-up

- Apply the recorded next-action uniformly to `STATUS_UNRESOLVED` events: do not fulfill, follow up with the customer, and leave unresolved until payment evidence confirms capture.
- For the wider pilot, recruit additional independent operators and apply the status-semantics documentation before opening.

## 12. Overall Findings

Both operators independently completed the full Phase 3A procedure against real Paystack test-mode transactions and real merchant CSVs, in file and live modes, with exactly-once replay and identical results across provider-evidence modes. Both surfaced and understood the same genuine status disagreement (merchant `PENDING` vs provider `abandoned→UNKNOWN`) and both reached the correct, safe operational conclusion (do not fulfill). Evidence was sufficient in both runs; no ReconcileKit correctness defect was demonstrated; deterministic matching and identifier honesty held throughout.

The one material divergence is usability: Operator 1 interpreted the result independently after the frozen mapping was cited, Operator 2 could not interpret independently without explanation. That is a documentation/UX gap in an otherwise correct tool, so it supports a conditioned pass rather than an iteration or a block. The remaining friction (provider-only noise, Turnstile limitation) is environmental/scope-level, not correctness-level.
