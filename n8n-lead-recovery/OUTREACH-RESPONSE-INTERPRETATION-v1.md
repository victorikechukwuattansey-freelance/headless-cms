# Outreach Response Interpretation V1

**Status:** IMPLEMENTED — Phase 1 (engine) + Phase 2 (fixture corpus) + Phase 3 (workflow contract tests) + Phase 4 (workflow JSON) DONE; Phases 5-7 (harness/sheets) pending.
**Version:** 1.4 — 2026-09-12 (Phase 4 workflow; Phases 1-3 2026-09-12; prior artifacts frozen 2026-09-11 / reported 2026-09-12)
**Owner stage:** Inbound sequence step 3 of 5: **Capture → Reconcile → Interpret → Plan → Execute**
**Decision legend:** ✅ LOCKED · 🟡 RECOMMENDED · 🔷 OPEN · ⏸️ DEFERRED

> This document is the exact 25-section specification/contract for the future
> **Response Interpretation V1** artifact. It was produced by a read-only
> inspection pass over the existing repository. It creates **no production code**:
> no `src/response-interpretation.js` (or engine), no embedded code, no workflow
> JSON, no provider adapter, no fixtures, no harness, no AI prompts, no n8n nodes.
> The only artifact produced here is this specification.

---

## 1. Executive Summary

**Response Interpretation V1** is the intent layer that sits between the
deterministic evidence layer (**Response Reconciliation V1**) and the future
planning layer (**Plan**). It is the **first artifact allowed to read
`response_text`** through the durable Response Log. For every reconcilable
response row it produces a deterministic **intent label**, a **confidence
value**, a **repeatable evidence/explanation object**, and an **actionability
recommendation** — all emitted as a read-only report.

- It **interprets only**. It never sends, never replies, never schedules, never
  updates the Outreach Log, never updates Approved Outreach, never calls a
  provider, never invents identity, and never repairs either sheet.
- It is **read-only and deterministic**: identical inputs (Response Log rows +
  reconciliation evidence) produce byte-identical cards (modulo run identity),
  exactly like `reconcileResponses` before it.
- V1 is **rule-based phrase-signal classification only** — no LLM, no ML, no
  provider, no network, zero runtime dependencies. An AI/LLM model boundary is
  documented but explicitly **deferred** because it breaks the repository's
  determinism guarantee.
- The contract deliberately **does not elongate any frozen schema**: Response
  Log (12 cols) and Outreach Log (22 cols) are untouched; interpretation output
  is a report artifact only.
- The seam from Reconcile is tight: Interpretation **consumes** reconciliation
  cards (it never re-derives identity) and **joins** them to the Response Log
  rows by `response_id` to recover `response_text`.

Overall: **Contained, deterministic, read-only classification stage.** This
spec fixes the boundary, taxonomy, confidence/evidence model, output contract,
fixture/test strategy, workflow shape, storage decision, and the exact
next-session implementation plan.

---

## 2. Repository Inspection

Read in this pass (all under `n8n-lead-recovery/`, commonjs, zero runtime deps):

| Area | Inspected | Notes |
|---|---|---|
| Engines | `src/response-reconcile.js` (682 ln, full), `src/response-capture.js` (120+ ln), `src/reconcile.js`, `src/queue.js` (442 ln, full), `src/execution.js` (475 ln, full), `src/provider.js`, `src/schema.js` | contracts below |
| Embedded mirrors | `src/embedded-response-reconcile.js` (503 ln), `src/embedded-response-capture.js` (386 ln) | full mirrors; parity-tested |
| Fixture loaders | `src/response-reconcile-fixtures.js` (`TEST-RESP-RECON` / `RESP_RECON_REGEX`), `src/response-capture-fixtures.js` (`TEST-RESP` / `RESP_REGEX`), `fixtures/response-reconcile-fixtures.json` (636 ln), `fixtures/response-capture-fixtures.json` (698 ln) | namespace-validated loaders |
| Workflows | `Response-Reconciliation V1.json` (5 nodes, exact names captured), `Response-Capture V1.json` (9 nodes) | node graphs captured |
| Live runners | `scripts/run-response-reconciliation-live.js` (486 ln; `reconcileScoped`, `FIXED_NOW`, `RESPONSE_TAB='Response Log'`, `OUTREACH_TAB='Outreach Log'`), `scripts/run-response-capture-live.js` | seed/verify/cleanup/idempotency contract |
| Workflow builders | `scripts/build-response-reconciliation-workflow.js`, `scripts/build-response-capture-workflow.js` (SPREADSHEET_ID `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ` for all read/write nodes) | |
| Tests | `tests/response-reconcile-{engine,workflow,harness}.test.js`, `tests/response-capture-{engine,workflow,harness}.test.js` (+ baseline engine/workflow/harness suites) | full suite run this pass |
| Docs | `README.md`, `OUTREACH-RESPONSE-CAPTURE-v1.md`, `OUTREACH-RESPONSE-RECONCILIATION-v1.md`, `OUTREACH-EXECUTION-AND-DELIVERY-v1.md`, `OUTREACH-QUEUE-AND-PLANNING-v1.md`, `RUN-RECONCILIATION-AND-REPORTING-v1.md`, `GOOGLE-SHEETS-VERIFICATION-HARNESS-v0.1.md` | pipeline + conventions |
| Pkg | `package.json` (`test`, `response-capture:test/build/live`, `response-recon:test/build/live`, etc.) | scripts convention |

**Baseline verification (this pass):** `npm test` → **386/386 PASS** (321
pre-existing + 65 response-stage new: 21 reconcile engine + 18 reconcile
workflow + 26 reconcile harness). No tests altered.

**Frozen-artifact verification (this pass):** `n8n-lead-recovery/` is entirely
untracked in git (the last commit `9d46d18` predates it), so `git diff` cannot
prove byte-identity against HEAD. The guarantee holds **by construction**: this
session made **zero writes** (reads only). Response Capture V1 and Response
Reconciliation V1 files are byte-identical to their post-freeze state of the
prior session.

---

## 3. Frozen Contracts Confirmed ✅ LOCKED

These are inputs this specification must fit — they are frozen and must not be
silently changed by Interpretation.

**Response Log (12 cols)** — sole writer: Response Capture V1
`response_id | idempotency_key | lead_id | outreach_id | channel | provider_message_id | received_at | response_text | response_status | source | matched | notes`

- `response_status ∈ {CAPTURED, UNMATCHED}` for durable rows (INVALID/DUPLICATE never persist).
- `idempotency_key = (provider_message_id || event_id)::source`; `response_id = RESP-<fnv1a32hex>`.
- `outreach_id = EX-<lead_id>-<channel>` when resolved; UNMATCHED rows carry empty `lead_id`/`outreach_id`.
- **`response_text` is present here and nowhere downstream.** Reconcile deliberately drops it (`normalizeResponseRows` excludes `response_text`, `provider_message_id`, `source`).

**Outreach Log (22 cols)** — sole writer: Outreach Execution & Delivery V1
`outreach_id | lead_id | business_name | contact_name | channel | email | phone | message_variant | sent_at | follow_up_date | follow_up_number | reply_status | reply_date | pain_admitted | call_booked | call_date | paid_pilot_interest | objection | outcome | notes | status | provider_message_id`

- Only `outreach_id`, `lead_id`, `channel`, `sent_at` participate in reconciliation.
- `reply_status` is **never** proof of a send; only non-empty `sent_at` is proof.
- Execution writes `reply_status…outcome` as **canonical-empty**; they are reserved presentational fields owned by **no** current artifact.

**Reconciliation V1 report/cards**
- `RECONCILIATION_STATUS ∈ {VERIFIED, VIOLATION, NOT_VERIFIABLE}`; 11 categories; 5 violation categories.
- Card = `{ response_id, lead_id, outreach_id, channel, response_status, reconciliation_status, relationship, reason }`.
- Report = `{ run_id, run_at, detected_at, status, sources{response_log_ok,…}, summary{response_records, matched_records, unmatched_records, linked_records, not_verifiable, invalid_records, duplicate_records, violations, coverage_rate, exception_count}, results[], exceptions[] }`.
- `status ∈ {COMPLETED, INCOMPLETE}`; INCOMPLETE = any read failure → null summary metrics, never false-healthy.
- Workflow: exactly 5 nodes, no init node, `alwaysOutputData: true` top-level on `Reconcile Responses` so zero-row reads still COMPLETED.

**Pipeline order (docs-locked):** Capture → Reconcile → **Interpret** → Plan → Execute. Reconcile doc: "Response Interpretation V1 … is the next (separate) artifact."

**Namespace conventions:** `TEST-RESP-*` (capture), `TEST-RESP-RECON-*` (reconcile); live runners refuse any row whose lead_id is not in the scenario namespace; `response-interpretation` must use `TEST-RESP-INT-*`.

**Determinism contract:** pure functions with injectable `now`/`runId`; sorted output; identical inputs → byte-identical output (modulo run identity fields).

---

## 4. Interpretation Boundary

✅ **In scope (V1):** classify intent from durable Response Log text, score
confidence, produce explanations, recommend actionability, flag stop-contact,
flag manual review. Read exactly two sources: **durable Response Log rows**
(full 12-col record, incl. `response_text`) and **Reconciliation V1 report
cards** (per `response_id`). Emit a read-only report.

✅ **In scope (consumed, not re-derived):** the reconciliation verdict is
**input evidence, not recomputed**. Interpretation never re-indexes Outreach
Log, never re-validates `EX-<lead>-<channel>`, never re-checks proof.

🔷 **Out of scope (V1) — locked by task brief, enforced by test suite:**
- sends / replies / auto-reply emission (future Plan → Execute owns that);
- scheduling follow-ups, tone routing, copywriting;
- any write to Response Log, Outreach Log, Approved Outreach, Verified Leads, or a new tab;
- provider calls, EF, queues, enrichment;
- identity invention (UNMATCHED rows are never attributed);
- repair of reconciliation VIOLATIONs (manual, owned by operators per Reconcile doc §rules).

🔷 **Fatal-shape rule:** if interpretation ever needs a write, it must be a new
self-owned ledger behind an explicit gate, not a mutation of the three frozen
writable surfaces (Response Log, Outreach Log, Approved Outreach).

---

## 5. Interpretation Eligibility 🟡 RECOMMENDED

Eligible rows = durable Response Log rows that also appear as Reconciliation
report cards (`reconcileResponses` results). Expression per card:

| Reconciliation state | `response_text` present | Interpret? | Mode |
|---|---|---|---|
| VERIFIED (identity fully proven) | yes | ✅ auto-interpret | full intent classification + actionability |
| VIOLATION (evidence suspect) | yes | ✅ interpret, **review-only** | intent classified; `recommended_action` forced to MANUAL_REVIEW unless HARD_STOP |
| NOT_VERIFIABLE (incl. UNMATCHED, invalid) | yes | 🟡 interpret **review-only** | same review window; UNMATCHED/invalid rows carry empty identity so never actionable |
| any state | no / empty text | 🟡 **SKIPPED** status (defensive; capture guarantees non-empty) | not interpreted |

- **UNMATCHED rows are eligible for intent reading but never for action.** They
  carry empty `lead_id`/`outreach_id`; a future Plan stage cannot attach them to
  a lead. Recommended: classify for operator visibility, tag `actionable=false`
  for unmatched.
- No row is ever **excluded** outright: every durable row is either
  `INTERPRETED` or `SKIPPED` (recommended statuses, §15).

---

## 6. Proposed Taxonomy (Intent Labels) 🟡 RECOMMENDED

Eight mutually exclusive, exhaustive labels (closed vocabulary; unknown → rejected, never invented):

| Label | Meaning (V1 English-only classifier) | Typical signal |
|---|---|---|
| `RESPOND` | engaged/proceed/please send details | positive-interest clauses, "yes", "send", "looks good" |
| `QUESTION` | asks for clarification/fact | interrogative forms, "what/how/when/is it" |
| `OBJECTION` | raises condition/concern | price, timing, trust, already have, "but" + blocker |
| `NOT_INTERESTED` | explicit decline, no condition | "no thanks", "not interested", "stop asking" |
| `OPT_OUT` | unsubscribe / do-not-contact / legal stop | "unsubscribe", "remove me", "do not contact", GDPR-style asks |
| `UNDELIVERABLE` | mechanical non-human reply | bounce, out-of-office, autoreply, invalid address |
| `SPAM_OR_AUTOMATED` | newsletter, spam, mailing noise, bot | unrelated bulk content, empty-ish template text |
| `NO_INTENT` | text present but unclassifiable / insufficient | no clause hit, too short, ambiguous |

- `OPT_OUT` is a **hard, non-negotiable machine label**, not a tone label.
- `NO_INTENT` is the label of last resort (also the destination of any clause
  contradiction that fails resolution, §8).
- Future mental split of `RESPOND` into `LEAD_QUALIFYING / INTEREST / INFO_REQ`
  is possible (higher cardinality is cheap) — but V1 keeps 8 for test
  tractability. Collected as an OPEN decision (§24).

---

## 7. Label Cardinality 🟡 RECOMMENDED

**Exactly one label per response row** — the classifier is a total function over
eligible rows → `(label, confidence)`. Multi-intent responses resolve by
**precedence**:

1. `OPT_OUT` wins unconditionally (any opt-out clause hit → OPT_OUT, §10).
2. mechanical triage (`UNDELIVERABLE`, `SPAM_OR_AUTOMATED`) wins over
   conversational labels.
3. `OBJECTION` warrants resolution but does not override `RESPOND`/`QUESTION`;
   a contradictory text with both positive and negative + no decisive clause →
   `NO_INTENT` with a `conflict` note in evidence.
4. otherwise the highest-weighted single clause family wins.

Cardinality is **verified in tests**: every fixture asserts exactly one label on
each INTERPRETED card, and the default branch (no hits) → `NO_INTENT` (not
empty).

---

## 8. Confidence Model 🟡 RECOMMENDED

Deterministic, signal-based; **never probabilistic, never LLM-inferred in V1**.

- Each static phrase carries a signed weight: `{ phrase, weight, polarity }`
  (`positive/negative/opt_out/mech/question/objection`). Weights are integers on
  a fixed scale (recommended: ±1..±5, opt-out cap +10 to guarantee supremacy).
- Clause family score = sum of matched weights in that family.
- Confidence = normalized winner margin over total matched weight:
  `confidence = winnerScore / max(totalMatchedWeight, 1)` then clamped `[0,1]`,
  `0` when no match.
- Bands: `HIGH ≥ 0.70`, `MEDIUM ≥ 0.40`, `LOW < 0.40`. A `LOW` label forces the
  card to `MANUAL_REVIEW` (never auto-actionable).
- **Confidence is stable, not calibrated**: same phrase table + same text →
  same score. Correctness is defined by the table, not by a probability claim.
- Table lives in a dedicated static module (future `src/intent-phrases.js`),
  shipped frozen with the artifact, parity-tested. Tuning is a version bump,
  never silent.

---

## 9. Evidence / Explanation Model 🟡 RECOMMENDED

Per card, a deterministic, sorted evidence object (operator-auditable, feeds the
report and any future replay):

```
evidence: [
  { phrase: "please send details", weight: 3, polarity: "positive", clause: "RESPOND" },
  { phrase: "how much", weight: 2, polarity: "neutral", clause: "QUESTION" }
]
clause_hits: { RESPOND: 3, QUESTION: 2, ... }      // one key per hit family, 0s omitted
matched_terms_total: 5
deciding_clause: "RESPOND"
conflict_detected: false
```

- Sorting is by weight desc, then `phrase` asc — byte-stable across runs.
- **No PII in evidence**: phrases are static table terms, never free-text
  excerpts; no email/phone/address ever enters evidence (§12).
- `text_preview` (optional, **default OFF**, gate document-ed §12) is the only
  place a truncated excerpt may appear; when OFF the field is `""`.

---

## 10. Actionability Boundary 🟡 RECOMMENDED

Actionability is an **output field, not an executed action.**

Values (closed vocabulary):

| Actionability | Meaning | Suggested by |
|---|---|---|
| `HARD_STOP` | stop-contact; suppress all future outreach | `OPT_OUT` only |
| `AUTO_REPLY` | future stage may draft/send a template reply | HIGH-confidence `RESPOND` / `QUESTION` |
| `MANUAL_REVIEW` | human must decide | VIOLATION/NOT_VERIFIABLE cards, `OBJECTION`, LOW confidence, conflict |
| `NO_ACTION` | close/archive silently | HIGH-confidence `NOT_INTERESTED`, `UNDELIVERABLE`, `SPAM_OR_AUTOMATED` |
| `IGNORE` | mechanical noise, delete-from-focus | `SPAM_OR_AUTOMATED` (redundant with NO_ACTION — folded in) |

- Combine: I recommend dropping `IGNORE` and folding into `NO_ACTION`
  (4 values total). Final split is an OPEN decision (§24).
- Rules:
  - `OPT_OUT` → always `HARD_STOP`, regardless of other signals (§8 precedence).
  - `LOW`-confidence card → always `MANUAL_REVIEW`.
  - `VIOLATION`/`NOT_VERIFIABLE` reconciliation → `MANUAL_REVIEW` unless it is
    `HARD_STOP` (opt-out signals are honored even on suspect provenance, with a
    `provenance_suspect` note — see §24 OPEN).
  - `HIGH`-confidence `RESPOND`/`QUESTION` on a `VERIFIED` card → `AUTO_REPLY`
    (permission to draft, not to send).

**Boundary hard rule:** the classifier may **recommend** `AUTO_REPLY`; nothing
in this artifact ever transmits, stages, or sends a reply.

---

## 11. Stop-Contact Handling ✅ LOCKED (semantics) + 🟡 (content)

- `OPT_OUT` detection is the **only** label that is allowed to pierce every
  other rule (tone → precedence, provenance → HARD_STOP on suspect cards).
- The artifact **flags only**: `stop_contact: true`, `priority: HIGH`,
  `actionability: HARD_STOP`. It does **not** mutate Approved Outreach /
  Outreach Log / queue.
- A future artifact (Plan / a suppression enforcer) is responsible for
  *enforcing* the stop (marking `suppressed`, freezing that lead in the queue
  projection — the queue engine's canonical `BLOCKED` path `outreach_status =
  'suppressed'` already exists and is the enforcement seam).
- Content rule (🟡 RECOMMENDED): any hit on the opt-out phrase family →
  `OPT_OUT`, unconditional, even if an apparent later clause contradicts it
  (GDPR-style asks are treated as legal, not conversational).

---

## 12. PII / Privacy Boundary ✅ LOCKED (principles) + 🟡 (mechanics)

- `response_text` is read **only**. It never gets persisted into a new
  interpretation artifact by default.
- Evidence stores static phrase-table terms only — never raw fragments.
- `text_preview` (optional MAX 120-char first-120 excerpt) is **OFF by default**;
  operators enable it per-run via the runner flag. Forbidden content in any
  output: emails, phone numbers, addresses, auth tokens, provider message ids.
- No `sender`/`recipient` material exists in the Response Log (capture drops it)
  so it is structurally unavailable — keep it that way.
- Logs/common-metrics never include response text; exception objects follow
  capture's convention (no text, no content-leak in failure paths).
- Principle (LOCKED): report artifacts must be text-lean; any enrichment of
  operator-facing leaks is a regression, tested by a scan.

---

## 13. Determinism & Model Boundary ✅✅

**Determinism (LOCKED):**
- `interpretResponses({ responseRows, reconciliationResults, readErrors, now, runId })`
  is a **pure function**; identical inputs → byte-identical cards (modulo
  `run_id`/`run_at`/`detected_at`).
- All sorting is key-order-stable; evidence sorted §9; results sorted by
  `response_id` then reconciliation card order keys (matches reconcile style).
- `run_id` default `RESPINT-<14 digits>`, injectable; `now` injectable
  (`FIXED_NOW` pattern copied from the reconcile live runner).

**Model boundary (LOCKED-as-deferred):**
- V1 ships **no** AI/LLM/ML. Adding one later requires:
  1. a provider-style adapter contract (like `src/provider.js` — `NOT_CONFIGURED`
     default that refuses AI calls), and
  2. wrapping AI output with the same confidence/evidence model and schema
     validation (unknown labels rejected) so determinism is restored by post-hoc
     re-scoring and hash-stable review.
- That is **⏸️ DEFERRED** and is an explicit version bump, never a silent patch.

---

## 14. Proposed Output Contract 🟡 RECOMMENDED

Per response — **Interpretation card** (deterministic):
```
{
  interpretation_id: 'INTERP-<fnv1a32hex(response_id + "::" + intent_label)>',
  response_id, lead_id, outreach_id, channel,
  response_status,               // from log
  reconciliation_status,         // from card (VERIFIED/VIOLATION/NOT_VERIFIABLE)
  interpretation_status,         // INTERPRETED | SKIPPED
  intent_label,                  // closed vocab §6 ; '' when SKIPPED | 'NO_INTENT'
  intent_confidence,             // 0..1 number ; null when SKIPPED
  confidence_band,               // HIGH | MEDIUM | LOW | '' ;
  actionability,                 // §10 vocab ; '' when SKIPPED
  recommended_action,            // free, canonical string (future stage's hook)
  stop_contact,                  // boolean
  priority,                      // HIGH | MEDIUM | LOW
  actionable,                    // boolean (false for UNMATCHED/invalid identity)
  matched_terms_total,
  clause_hits,                   // object, sorted keys
  deciding_clause,               // '' when none
  conflict_detected,
  evidence,                      // §9 array
  text_preview,                  // "" default; gated
  reason,
  notes
}
```

Per run — **Report**:
```
{
  run_id, run_at, detected_at,
  status,                         // COMPLETED | INCOMPLETE
  sources: {
    response_log_ok, response_log_read_error,
    reconciliation_ok, reconciliation_read_error
  },
  summary: {
    response_records,
    interpreted_records, skipped_records,
    intent_label_counts,          // { label: n }, 0-keyed
    actionability_counts,         // { actionability: n }
    stop_contact_count,
    high_confidence_count, medium_confidence_count, low_confidence_count,
    conflict_count,
    manual_review_count,
    coverage_rate,                // interpreted / response_records (null when 0)
    exception_count
  },
  results: [],                    // cards
  exceptions: []                  // sorted, read-failure + non-canonical violations
}
```

Every key always present (capture/reconcile convention: all-keys deterministic).

---

## 15. Status Semantics 🟡 RECOMMENDED

- `interpretation_status ∈ { INTERPRETED, SKIPPED }` (per card).
- `report.status ∈ { COMPLETED, INCOMPLETE }`:
  - **COMPLETED** — both sources read OK (zero-row reads still COMPLETED, valid
    zero metrics; `alwaysOutputData` mirrors Reconcile).
  - **INCOMPLETE** — Response Log read error **or** reconciliation read error →
    null summary metrics, empty `results`, READ_FAILURE exceptions, explicit
    `sources.*_read_error`. Never a false-healthy run.
- SKIPPED reasons: `response_text` empty (defensive), reconciliation report
  missing the row (orphan — report, don't crash).

---

## 16. Failure Semantics 🟡 RECOMMENDED

- **Read failures** → INCOMPLETE + exceptions (never partial results).
- **Unknown/unexpected label** in the phrase table output → throw (contract
  violation), since the vocabulary is closed.
- **Row-level anomalies** (missing `response_id`, non-canonical
  `response_status`) → SKIPPED card + warning exception; never abort the run.
- **No match at all** → `NO_INTENT`, `confidence 0`, `LOW`, `MANUAL_REVIEW`
  recommendation — not an error.
- **Deterministic error propagation**: a throw inside interpretation is a bug
  (tests fail); runtime behavior is total (every durable row gets a card).
- Reconcile's own `INCOMPLETE` artifact passed in as "reconciliation results"
  → treated as a read-failure-equivalent input (this interpretation is refused).

---

## 17. Idempotency 🟡 RECOMMENDED

- Interpretation is read-only and pure → idempotent by construction: running it
  twice over identical sources yields byte-identical cards (modulo run identity).
- Live verification uses the reconcile harness pattern: seed → run →
  verify → run again (`INTERP-IDEM-A/B`) → confirm identical after stripping
  `run_id`/`run_at`/`detected_at`.
- `interpretation_id` is a deterministic function of
  `(response_id, intent_label)` so a re-run can never mint a second identity for
  the same response+label (stable correlation key for future Plan stage).

---

## 18. Fixture Plan ✅ IMPLEMENTED (Phase 2, 2026-09-12)

Namespace **`TEST-RESP-INT-\d+`** (regex `/^TEST-RESP-INT-\d+$/`, loader-guarded
like `RESP_REGEX`/`RESP_RECON_REGEX`). File: `fixtures/response-interpretation-fixtures.json`.

Each fixture: `{ id, name, note, reorder_of, initialResponseRows (full 12-col
incl. response_text), initialOutreachRows (full 22-col), optional
reconcileResponseRows / reconcileOutreachRows (default to initial rows; `[]`
for clean-evidence fixtures), optional responseReadError /
reconciliationReadError / upstreamIncomplete, expected { full golden report } }`.

Planned set (recommend ~24):
- Per-label happy paths: RESPOND, QUESTION, OBJECTION, NOT_INTERESTED, OPT_OUT,
  UNDELIVERABLE, SPAM_OR_AUTOMATED, NO_INTENT (8).
- Precedence/conflict: multi-intent, opt-out-supremacy, contradictory tone (3).
- Reconciliation interplay: VERIFIED+RESPOND echo, VIOLATION+OBJECTION
  (review-only), NOT_VERIFIABLE UNMATCHED (actionable=false), invalid record (SKIPPED),
  duplicate response (both cards interpreted, shared response_id? no — resp ids differ) (5).
- Shapes: empty text (SKIPPED), 2-char text "ok" (NO_INTENT manual), case/whitespace
  invariance, punctuation "???", undeliverable OOO, spam template (6).
- Determinism: input-order permutation of responseRows → identical output (2).
- Read-failure: response-log error, reconciliation error (2).

Fixture `expected` blocks are generated deterministically by running the **real**
`interpretResponses` over the fixture rows (reconciliation evidence from the **real**
`reconcileResponses`; no hand-latent reconcile data), with `run_id/run_at/detected_at`
stripped and `interpretation_id` retained.

**Implementation note (2026-09-12):** the corpus ships as 27 fixtures
(`TEST-RESP-INT-001..027`) with byte-for-byte golden `expected` blocks generated
from the real engine, loader `src/response-interpretation-fixtures.js`, and
suite `tests/response-interpretation-fixtures.test.js` (49 tests). Coverage: all
8 labels (unambiguous non-conflict example each), all 4 actionability values, all
3 confidence bands, all 3 exception categories, precedence proofs (009/010/011/
012/013), SKIPPED edges (022/023), duplicate keys never deduped (021),
order-independence (027 = reorder of 016), read-failure/upstream-incomplete
paths (024/025/026), PII quarantine. Full suite **474/474 PASS**.

---

## 19. Test Strategy 🟡 RECOMMENDED (implementation deferred)

Three files mirroring the response-stage convention (each added to `npm test`
glob automatically):

1. **`tests/response-interpret-engine.test.js`** — pure-function tests:
   normalization, closed vocabulary (unknown label rejected), precedence rules,
   confidence bands, evidence sort stability, sort-stable results, INCOMPLETE on
   read errors, zero-row COMPLETED, determinism (two identical calls →
   `JSON.stringify` equal).
2. **`tests/response-interpret-workflow.test.js`** — embedded-code parity:
   workflow JSON exists, 5-node shape, `alwaysOutputData` on Interpret node, and
   **embedded mirror executes byte-identically to the engine on every fixture**
   (same parity pattern as reconcile's workflow test).
3. **`tests/response-interpret-harness.test.js`** — live-runner contract:
   export surface, namespace refusal on non-`TEST-RESP-INT-*`, seed/verify/
   cleanup against `Response Log` + reconcile-report artifact via `MockSheets`,
   repeat determinism, idempotency, read-failure → INCOMPLETE and live
   `MANUAL` isolation lines.

**Implementation note (2026-09-12):** Phase 3 shipped the workflow-contract
portion of this strategy — `src/response-interpretation-workflow-contract.js`
(the single contract definition the Phase 4 workflow test must consume) and
`tests/response-interpretation-workflow.test.js` (66 tests). The embedded-
mirror parity test (item 2) and the harness test (item 3) remain Phase 4 / 5-7
gates.

Baseline guard: full suite must stay **386/386 + new**; no existing test is
altered.

---

## 20. Workflow Recommendation 🟡 RECOMMENDED

**Standalone 5-node read-only workflow** (`Response-Interpretation V1.json`),
modeled on `Response-Reconciliation V1.json`:

```
Manual Trigger → Read Response Log → Read Reconciliation Report → Interpret Responses → Response Interpretation Complete
```

- **Read Reconciliation Report** = a JSON-file read of the artifact persisted by
  the reconcile live runner (`writeReconArtifact`; runner flag provides path). If
  the artifact is missing → that read fails → the run is honest INCOMPLETE.
- **Interpret Responses** embeds the synchronous engine mirror (parity-tested);
  it joins `response_id` between the two reads and does NOT recompute
  reconciliation.
- **NO init node** (read-only, no REAL/DRY_RUN mode) — mirrors Reconcile.
- **`alwaysOutputData: true`** top-level on Interpret → zero-row reads still
  COMPLETED.
- Chained alternative (Reconcile-node output fed inline into Interpret) is
  **🔷 OPEN**: it removes the file dependency but couples the two runs and
  re-imports reconcile logic into the interpret workflow. Not recommended for V1.
- Manual Trigger carries optional `response_log_read_error` /
  `reconciliation_read_error` metadata (matches reconcile's read-error
  convention).

**Implementation note (2026-09-12):** this topology is now **LOCKED** in
`src/response-interpretation-workflow-contract.js` (reference layout +
`assertWorkflowContract` validator). Two refinements from the RECOMMENDED text
above: (1) **Read Reconciliation Report** is pinned as a read-only
`n8n-nodes-base.code` pure relay with `alwaysOutputData:true` — the repository
has NO file-read node precedent and n8n cannot read the runner-local artifact,
so the reconcile report is injected as workflow input rather than file-read;
(2) the trigger carries the two keyed read errors above (supersedes the single
`reconciliation_report_read_error` hint). Phase 4 validates the builder output
against the contract and reproduces `engineBehaviorFor` byte-for-byte per
fixture.

---

## 21. Storage Recommendation 🟡 RECOMMENDED

- **Default: zero writes.** Interpretation persists a **report artifact only**
  (the runner writes the JSON attachment, same pattern as reconcile's artifact).
- **Do not add columns** to Response Log or Outreach Log; do not touch Approved
  Outreach.
- A future durable home for interpretation results (so **Plan** can consume
  them without re-running) is a **new dedicated `Response Interpretation` tab**
  written only by a future gated writer — **⏸️ DEFERRED**, spec'd only if Plan
  demands it. V1 Plan reads the report artifact.
- Rationale: the repo's write-ownership rule is "the source-of-truth write
  happens at the owning stage only." Interpretation owns no sheet in V1.

---

## 22. Existing Field Collision Analysis ✅ (no collisions → none created)

| Field | Owner | Interpretation effect |
|---|---|---|
| Response Log `response_text`, `response_status`, `matched`, `notes` | Capture | **read-only**; `notes` never auto-written |
| Response Log `response_id` / `outreach_id` | Capture | join key onto reconcile cards |
| Outreach Log `reply_status / reply_date / pain_admitted / call_booked / call_date / paid_pilot_interest / objection / outcome` | **no current owner** (Execution writes them canonical-empty; Reconcile ignores) | **not written** now; future outbound-updater stage may derive them FROM interpretation output (e.g., `objection` ← OBJECTION label) — ⏸️ DEFERRED with explicit ownership when created |
| Outreach Log `follow_up_date / follow_up_number` | no current owner | future Plan stage input surface; not interpretation's |
| Approved Outreach `outreach_status` (`suppressed`, etc.) | queue/approval flow | enforcement seam for `HARD_STOP`; **interpretation never mutates** |
| Approved Outreach `outreach_channel / qualification_status` | handoff/approval | untouched |
| Queue projection `latest_outcome / latest_channel / last_outreach_at` | Queue V1 (derived) | derived FROM Outreach Log only; unchanged |
| `provider_message_id / source` (log) | Capture | read for traceability in interpret join only; never in evidence |

**Conclusion:** interpretation introduces **zero new sheet columns and zero
writes**, so there is no collision. The `reply_status…outcome` band is called
out so a future outbound-updater stage claims it explicitly rather than
silently.

---

## 23. Architectural Recommendation ✅ LOCKED

1. **Layered, ownership-clean pipeline:** Capture (writes Response Log) →
   Reconcile (read-only evidence) → **Interpret (read-only intent)** → Plan
   (reads interpretation) → Execute (writes Outreach Log). Each stage consumes
   the prior stage's contract; no stage re-derives a prior stage's work.
2. **Interpretation is a pure function of two reads** (Response Log text +
   Reconcile cards). It must NOT embed reconcile logic (parity-tested in the
   workflow test).
3. **Determinism is non-negotiable in V1**: rule-based phrase table; AI optional
   only behind a provider-style boundary (deferred).
4. **Drift protection**: embedded mirror parity test (workflow test) keeps the
   node code in sync; fixture namespace guard keeps live runs clean; INCOMPLETE
   read-failure semantics never produce false-healthy output.
5. **No silent schema change**: any future durable interpretation output is a
   new ledger with its own owner + gate, never a column added to a frozen tab.

---

## 24. Open Decisions (resolve before implementation)

| # | Decision | Recommendation | Status |
|---|---|---|---|
| 24.1 | Prefer 8-label taxonomy, or split `RESPOND` (`INTEREST / INFO_REQ / LEAD_QUALIFYING`) for higher cardinality? | 8 labels for V1 | 🔷 OPEN |
| 24.2 | Actionability vocabulary: 4 (`HARD_STOP / AUTO_REPLY / MANUAL_REVIEW / NO_ACTION`) vs 5 (add `IGNORE`)? | 4 (fold IGNORE into NO_ACTION) | 🔷 OPEN |
| 24.3 | Interpretation input source: standalone reconcile-artifact file (standalone workflow) vs chained inline reconcile output? | standalone artifact | 🔷 OPEN |
| 24.4 | Auto-action confidence threshold: `AUTO_REPLY` only when ≥ `HIGH` (0.70)? | HIGH (0.70) | 🔷 OPEN |
| 24.5 | Should suspect-provenance (`VIOLATION/NOT_VERIFIABLE`) plus capital interest still be `AUTO_REPLY`-eligible, or always `MANUAL_REVIEW`? | always MANUAL_REVIEW (except HARD_STOP) | 🔷 OPEN |
| 24.6 | English-only phrase table for V1? | yes; `{en}` only | 🟡 RECOMMENDED |
| 24.7 | `text_preview` gating default: OFF (flag to enable) vs ON-per-run? | default OFF | 🔷 OPEN |
| 24.8 | Unmatched-row intent reading: OK for operator visibility? | yes, `actionable=false` always | 🔷 OPEN |
| 24.9 | Report artifact location/name for reconcile output consumed by interpretation | reconciled artifact + runner flag | 🔷 OPEN |
| 24.10 | Durable `Response Interpretation` tab: build in V1 or defer to Plan demand? | defer | ⏸️ DEFERRED |

---

## 25. Implementation Plan (for a future session; spec complete, no code now)

**Phase 0 — gate (this doc).** ✅ done. No production code touched.

**Phase 1 — engine.** 🟢 **IMPLEMENTED 2026-09-12**
`src/response-interpretation.js` (approved file name; supersedes the working
name `src/response-interpret.js` suggested below) + `tests/response-interpretation-engine.test.js`
(39 tests). Pure deterministic engine per this chapter: rule table inline
(no separate phrases file), `interpretResponses(input, options)`, injectable
`now/runId`, sorted output, no input mutation, evidence controls. Full suite
now **425/425 PASS** (386 baseline preserved + 39 new). Everything below
(phases 2-7) explicitly DEFERRED — fixtures, tests/workflow/harness, embedded
mirror, workflow JSON, live runner, sheets all rest on the engine.

**Phase 2 — fixtures.** 🟢 **IMPLEMENTED 2026-09-12**
`fixtures/response-interpretation-fixtures.json`
(`TEST-RESP-INT-001..027`, 27 golden fixtures per §18) + loader
`src/response-interpretation-fixtures.js` (namespace guard + row defaults +
deep-cloned `expected`) + suite `tests/response-interpretation-fixtures.test.js`
(49 tests). Full suite now **474/474 PASS**.
Everything below (phases 3-7) explicitly DEFERRED.

**Phase 3 — workflow contract tests.** 🟢 **IMPLEMENTED 2026-09-12**
`src/response-interpretation-workflow-contract.js` — single source of truth for
the workflow boundary: locked 5-node topology + node types/ids/positions,
the only Google Sheets read (Response Log, unfiltered, `returnAllMatches`,
pinned spreadsheet), the read-only reconciliation-report code relay,
`alwaysOutputData`, trigger error-carrier keys, the three-feed → engine
projection joining exclusively by `response_id` (reconciliation consumed as
evidence, NEVER recomputed), banned-surface scan, and the fixture-parity gate
(`engineBehaviorFor` / `assertEngineEquivalence`). +
`tests/response-interpretation-workflow.test.js` (66 tests: contract surface,
topology, sheet/reconciliation read surfaces, validator negatives, engine
boundary incl. surplus-input inertness, empty-read COMPLETED + read-failure
INCOMPLETE semantics, 27-fixture parity, deterministic run identity, PII
quarantine). Full suite now **540/540 PASS** (474 baseline preserved + 66).
Contract only — NO embedded mirror, NO workflow JSON, NO builder yet
(Phase 4 gates).

**Phase 4 — workflow.** ✅ IMPLEMENTED (2026-09-12).
`src/embedded-response-interpret.js` + `scripts/build-response-interpretation-workflow.js`
→ `Response-Interpretation V1.json` (5 nodes, §20, shipped at repo root),
`alwaysOutputData` on both code nodes (see §26 deviation note), deterministic
byte-identical rebuild, and `tests/response-interpretation-workflow-build.test.js`
(29 tests). Builder output and shipped JSON both satisfy `assertWorkflowContract`
and reproduce `engineBehaviorFor` byte-for-byte on every fixture (Phase 3 parity
gate). Phase 4 intentionally ships **inactive** and performs no live execution.

**Phase 5 — live runner.** `scripts/run-response-interpretation-live.js`
(FIXED_NOW, reconcile-artifact read, `Response Log` read, seed/verify/cleanup,
idempotency) + `run-response-interpretation-live.ps1`; package.json
`response-interpret:test/build/live`; README pointer.

**Phase 6 — verification.** Full `npm test`; deterministic rebuild of workflow
(`npm run response-interpret:build` then `git diff` on JSON == no change);
security/PII scan (no response_text in evidence/logs); frozen-artifact check
(Response Capture V1 / Reconcile V1 unchanged).

**Phase 7 — report.** Final report (artifacts, suites, metrics, live boundary
status) — same reporting shape as Response Reconciliation V1.

---

## 26. Decision Lock Register (approved 2026-09-12)

The following decisions are **LOCKED**; later phases must implement them, not
relitigate them. Where a locked decision differs from the text above, the
locked decision wins and the difference is recorded here explicitly.

### Locked decisions

1. **Scope gate** — Phase 1 produces only `src/response-interpretation.js` +
   `tests/response-interpretation-engine.test.js`. No embedded mirror, workflow
   JSON, builder, live runner, PS1, fixtures, sheet, provider adapter, or AI
   integration in this phase.
2. **Interaction with other artifacts** — Response Capture V1 and Response
   Reconciliation V1 remain FROZEN; this engine never writes any sheet and
   never re-runs reconciliation.
3. **Response Log read authority** — Interpretation is the FIRST artifact
   allowed to read `response_text` (reconcile must never). Evidence/cards/
   exceptions never carry it.
4. **Join key** — `response_id` only. Never business_name/email/phone/text/
   position. Reconcile logic is never re-run inside interpretation.
5. **Taxonomy (8, one per response)** — RESPOND, QUESTION, OBJECTION,
   NOT_INTERESTED, OPT_OUT, UNDELIVERABLE, SPAM_OR_AUTOMATED, NO_INTENT.
6. **Precedence** — OPT_OUT > mechanical (UNDELIVERABLE, SPAM_OR_AUTOMATED) >
   conversational; conflict (RESPOND>0 ∧ NOT_INTERESTED>0) → NO_INTENT with
   `conflict_detected=true`; else no-match → NO_INTENT (never a failure).
7. **Actionability (4)** — HARD_STOP, AUTO_REPLY, MANUAL_REVIEW, NO_ACTION.
   OPT_OUT→HARD_STOP + `stop_contact=true`; LOW→MANUAL_REVIEW;
   VIOLATION→MANUAL_REVIEW (priority HIGH); NOT_VERIFIABLE→MANUAL_REVIEW;
   NO_INTENT→MANUAL_REVIEW; UNMATCHED→`actionable=false`;
   VERIFIED HIGH/MEDIUM label-driven AUTO_REPLY / NO_ACTION. Recommendation
   only — never executes.
8. **Confidence** — deterministic signed phrase weights, `topScore/totalWeight`
   clamped to [0,1]; HIGH ≥ 0.70, MEDIUM ≥ 0.40, LOW < 0.40. LOW forces
   MANUAL_REVIEW. Not calibrated statistics.
9. **Evidence** — safe metadata only `{ rule_id, phrase, weight, polarity,
   clause }`; static phrases only, sorted weight desc then clause/rule/phrase.
10. **Eligibility** — VERIFIED normal; VIOLATION and NOT_VERIFIABLE interpret
    + MANUAL_REVIEW; UNMATCHED interpret non-actionable; INVALID never
    force-classified (SKIPPED); DUPLICATE never independently reinterpreted
    (no engine dedup); empty `response_text` → SKIPPED.
11. **Statuses** — card `interpretation_status ∈ { INTERPRETED, SKIPPED }`
    (reconciliation statuses kept separate); report `status ∈ { COMPLETED,
    INCOMPLETE }`; INCOMPLETE → null summary metrics (except `exception_count`),
    empty `results`, READ_FAILURE exceptions.
12. **Identity & version** — `INTERPRETATION_VERSION='RESP-INT-V1'`,
    `RUN_LABEL='RESPINT'`,
    `interpretation_id = 'INTERP-' + fnv1a32hex(response_id + "::" + RESP-INT-V1)`.
    No random IDs.
13. **Determinism** — pure, total, input-order independent; injectable
    `now` (default `Date.now()`-like) and `runId` (default
    `RESPINT-<14-digit ms>`); identical inputs → byte-identical output.
14. **Language** — V1 English-only. `text_preview` OFF by default (max 120
    chars) and never defaulted into operational output.
15. **Storage** — V1 is report-only; no interpretation sheet, no Response Log /
    Outreach Log writes.
16. **Model boundary** — deterministic rule-based classification; no LLM, no
    AI, no provider, no API, no file/network/env reads, no input mutation.
17. **Workflow (future phases)** — standalone 5-node read-only artifact:
    Manual Trigger → Read Response Log → Read Reconciliation Report →
    Interpret Responses → Response Interpretation Complete; no init node;
    no writes/provider/AI.

### Recorded deviations of the lock from this document (supersession notes)

- **Card field names** — the card uses the field names established in §14
  (`intent_label`, `intent_confidence`, `confidence_band`, …). The task's
  `primary_intent` / `confidence` map to `intent_label` / `intent_confidence`
  per the explicit "use the exact field names established in the specification
  where they differ" instruction.
- **Summary bucket names** — the report summary uses the locked names
  `by_intent` (all 8 labels zero-keyed), `by_confidence_band`
  (HIGH/MEDIUM/LOW), `by_actionability` (all 4). §14's RECOMMENDED
  `intent_label_counts`, `high/medium/low_confidence_count`, and
  `actionability_counts` are superseded.
- **`interpretation_id` formula** — §14/§17 RECOMMENDED `(response_id,
  intent_label)` is superseded by LOCKED `(response_id, interpretation_version)`
  so identity stays stable when a later label set would otherwise be relabeled.
- **Missing reconciliation row** — §15 lists "reconciliation report missing the
  row" as a SKIPPED reason. LOCKED behavior: the row is INTERPRETED as
  `reconciliation_status=NOT_VERIFIABLE` → MANUAL_REVIEW, with a
  `MISSING_RECONCILIATION_EVIDENCE` (WARNING) exception — report, don't crash.
  An upstream report whose status is `INCOMPLETE` remains a
  read-failure-equivalent (§16, unchanged).
- **File name** — §25 suggested `src/response-interpret.js`;
  the approved task lock mandates `src/response-interpretation.js`.
- **Read Reconciliation Report role** — §20 RECOMMENDED a JSON-file read of the
  reconcile artifact. The Phase 3 contract LOCKED this node as a read-only
  `n8n-nodes-base.code` pure relay with `alwaysOutputData:true` (the repository
  has no file-read node precedent and n8n cannot read the runner-local
  artifact). It is never a sheet and never a write; failures surface on the
  Manual Trigger as `response_log_read_error` / `reconciliation_read_error`
  (two keys — supersede §20's single `reconciliation_report_read_error` hint).
- **Topology lock** — the 5-node graph, node names/ids/positions, sheet read
  spec, and `alwaysOutputData` set are now authoritative in
  `src/response-interpretation-workflow-contract.js`; Phase 4 must satisfy
  `assertWorkflowContract` and reproduce `engineBehaviorFor` per fixture.
- **Phase 4 implementation note — `alwaysOutputData` on both code nodes** —
  the §25 Phase 4 paragraph named only the Interpret node; the implementation
  sets `alwaysOutputData:true` on **Read Reconciliation Report and Interpret
  Responses** so the relay always executes and an empty successful read still
  reaches the interpret stage (empty reads → COMPLETED zero metrics, never a
  silent skip). Contract and tests enforce this two-node set.
- **Phase 4 implementation note — relay read source and error carriage** — the
  relay reads `$('Manual Trigger').all()` (repository convention, identical to
  embedded-response-reconcile) and attaches a non-empty
  `reconciliation_read_error` onto the outgoing payload; the error is inert in
  the engine but surfaced for observability. Defaults to a healthy empty
  `{ status:'COMPLETED', results:[] }` report when no report is injected.

### Phase 1 verification summary

- Full suite **425/425 PASS** (baseline 386/386 preserved; +39 interpretation
  engine tests).
- Security scan on the two new files: no secrets, keys, network, env,
  `Math.random`, UUIDs, crypto, or fs access; PII leak-tests green
  (email/provider ids/raw text excluded from cards, reports, exceptions).
- Frozen Capture/Reconcile artifacts untouched (repo untracked in git at
  `9d46d18`; this session made zero writes to them or their tests).

### Phase 2 verification summary

- Full suite **474/474 PASS** (Phase 1 425 preserved; +49 fixture tests).
- All 27 golden `expected` blocks match the real engine byte-for-byte; coverage
  assertions confirm all labels/actionabilities/bands/exception categories,
  precedence proofs, exact 0.40/0.70 confidence boundaries, dedup and
  order-independence guarantees, and PII quarantine.
- Security scan on the three new files: no secrets, keys, network, env, exec,
  eval, or dynamic-import patterns (the single `secret` lexeme is the suite's
  own negative leak assertion, matching the engine test convention).
- Frozen Capture/Reconcile artifacts untouched (zero writes; corpus/loader/tests
  only).

### Phase 3 verification summary

- Full suite **540/540 PASS** (Phase 2 474 preserved; +66 workflow-contract
  tests, incl. 27-fixture parity through the `engineBehaviorFor` projection).
- `assertWorkflowContract(referenceWorkflow())` passes; validator negatives
  (wrong node count/order/duplicates, active workflow, sheet writes,
  reconciliation read as a sheet, missing `alwaysOutputData`, banned node
  types, extra connections, missing meta, filtered / wrong-spreadsheet reads,
  `jsCode` banned sources) all throw.
- Engine boundary proven: `projectWorkflowInputs` projects the three reads onto
  the engine with no extra surface; surplus report / card fields and phantom
  reconcile inputs are inert (reconciliation is consumed, never recomputed);
  join is exclusively by `response_id`.
- Failure semantics: empty successful reads → COMPLETED with valid zero metrics
  (`alwaysOutputData` documented and enforced); single / both read failures and
  upstream INCOMPLETE report → INCOMPLETE with nulled summary and READ_FAILURE
  exceptions (fixtures 024/025/026).
- Security scan on the two new files: no secrets, keys, network, env, exec,
  eval, `Math.random`, UUID, fs, or dynamic-import patterns. All matches are the
  intentionally-exercised negative-case strings inside the banned-surface
  scanner and its tests.
- Frozen Capture/Reconcile artifacts untouched; Phase 3 wrote contract + tests
  + spec-doc update only.

### Phase 4 verification summary

- Full suite **569/569 PASS** (Phase 3 540 preserved; +29 workflow-build tests,
  incl. 27-fixture parity through the real embedded relay→interpret chain vs
  `engineBehaviorFor`).
- `Response-Interpretation V1.json` shipped at the repo root: 5 nodes, one
  read-only `googleSheets` read of `Response Log` (pinned spreadsheet), two
  `alwaysOutputData` code nodes, `active:false`; both `assertWorkflowContract`
  (shipped JSON + builder output) and `assertCleanSource` pass.
- Determinism proven: rebuilding `responseInterpretationWorkflow()` twice
  produces a SHA-256-identical artifact byte-for-byte with the shipped file.
- Embedded mirror stays in sync with `src/response-interpretation.js` on all 27
  fixtures (report + exception envelope, `RESPINT` run-id shape);
  read-failure semantics (024/025/026) and healthy-empty COMPLETED zero-metric
  runs verified through the real node chain; relay passthrough/fallback/error
  carriage covered.
- PII quarantine: no `response_text` / `provider_message_id` / sender /
  recipient keys or values, no raw fixture values, empty `text_preview` across
  every fixture output.
- Security scan on the three new files (embedded source, builder, tests) plus
  the shipped JSON: no secrets, keys, network, env, exec, eval, `Math.random`,
  UUID, or fs access in the embedded code; all lexeme hits are the test
  harness's own `require`s and its intentional negative-case assertions.
- Frozen Capture/Reconcile artifacts untouched; Phase 4 wrote the embedded
  mirror + builder + shipped JSON + tests + spec-doc update only. Live
  execution NOT performed (Phase 5-6 gate); full artifact still NOT frozen.

### Phase 5 verification summary

- Phase 5 delivered the live-runner + execution harness WITHOUT touching the
  frozen Capture/Reconcile/Phase 1-4 artifacts and WITHOUT executing live n8n:
  - `src/response-interpretation-live-runner.js` (library runner: readConfig,
    preflight A-I, checkShippedWorkflow/assertShippedWorkflow, seed/verifySeed,
    executeShipped, collectExecution, verifyInput w/ `failure_info`,
    cleanup/verifyCleanup, compareCollected, expectedReportFor,
    injectedTriggerInputFor, run report + redact, runSelectedPhases/fullRun/main).
  - `scripts/run-response-interpretation-live.js` (thin CLI; exit map 0/1/2/3/4,
    `RESULT: <status>` on stdout) and
    `scripts/run-response-interpretation-live.ps1` (PS 5.1, prompted secure
    secrets, dry-run default, honors all `-Skip*` switches at the PS1 layer). PS1
    parse-checked and smoke-run through `-PreflightOnly` (exit-code propagation
    verified; no prompts with env seeded; no files written).
  - package.json `response-interpret:*` scripts (7) and `.env.example` additions
    (`RESP_INT_LIVE_RUN_TOKEN`, pinned-engine-sheet note).
- Full suite **637/637 PASS** (569 preserved + 68 live-runner tests). The
  live-runner suite exercises: export surface; run-token/namespace composition;
  `readConfig` shapes (including partial n8n not-ready); 27-fixture acceptance;
  failure scenarios resolving to trigger-metadata only; seed row projection
  (12 columns, remapped `lead_id`/`response_id`, `text_preview` empty); injected
  reconciliation trigger input (INCOMPLETE on upstream incomplete, empty on
  read-error, joined COMPLETED report otherwise); canonical expected report
  (status/interpretation + run_* stripped); scoping/`compareCollected`;
  shipped-workflow precondition checks (clean, one read, zero writes, inactive,
  5 canonical nodes) incl. tamper → precondition FAIL / auto-detected code-node
  violation; preflight A-I; seed/verify-seed; mocked-transport execute/collect +
  full pass pipeline (put/execute/create/collect/interpret/compare); verify-input
  PASS/FAIL semantics incl. `failure_info` exact-mismatch descriptions and
  cross-namespace contamination failure; cleanup safety (regex guard refusing
  non-namespaced rows, `CLEANUP_NOT_PERFORMED`); run-report redaction (nested
  sensitive keys + secret-shaped values) and never-containing-env-secrets;
  CLI wiring (`--help` exit 0, bare invocation → full run → exit 1 never a fake
  PASS, execute/collect without n8n → exit 3 NOT_CONFIGURED, preflight without
  sheet config → exit 1); security-gate literal scan (no `Math.random(`,
  `randomUUID`, `process.env.`, secret-shaped values in the runner source).
- Security scan green on the Phase 5 additions: the PS1 has no `-AsPlainText`,
  no secret-shaped literals, no env references beyond the documented config
  contract; the only lexeme hits live in the test file's own positive
  assertions. Frozen-integrity re-checked: engine/contract/embedded mirror/
  shipped workflow JSON unchanged (suite + shipped-workflow precondition checks
  green; deterministic SHA-256-identical rebuild held for the shipped JSON).
- Live execution NOT performed; execute/collect report NOT_CONFIGURED + MANUAL
  steps whenever n8n config is absent, and the number "Live n8n executions of
  the shipped workflow" remains 0. Phase 6 (run-level verification) still
  pending; full artifact NOT frozen.
- Known limitation (honest trigger-metadata mechanism): scenario `response-log-
  failure` is driven by injecting `response_log_read_error` through the
  Manual-Trigger boundary — a real sheets-read failure cannot be forced
  non-destructively on the pinned engine spreadsheet.

### Phase 5 Report — Response Interpretation V1 Live Runner

**1. Scope & Boundary** — Phase 5 delivers the local execution harness for the
SHIPPED "Response-Interpretation V1" workflow: seed canonical fixture rows into
a `TEST-RESP-INT-LIVE-*` namespace, execute the workflow (via n8n when
configured), collect the Interpret Responses output, compare it against the
canonical engine projection, and clean up only the Phase 5 namespace rows.
Out of scope by design: changes to Capture/Reconcile, the interpretation
engine/contract, the embedded mirror, the shipped workflow JSON, or the Phase
1-4 test corpus; anything that touches non-`TEST-RESP-INT-LIVE-*` rows or any
tab other than `Response Log`; live n8n execution (Phase 5-6 gate).

**2. Deliverables** — `src/response-interpretation-live-runner.js` (library
runner, 50 named exports incl. `main`), `scripts/run-response-interpretation-
live.js` (thin CLI), `scripts/run-response-interpretation-live.ps1`
(PowerShell 5.1 launcher), `tests/response-interpretation-live-runner.test.js`
(68 tests), package.json `response-interpret:*` scripts (test/build/live/
live:preflight/live:seed/live:run/live:cleanup), `.env.example` additions,
spec update to v1.5.

**3. Files created / modified (Phase 5 only)** — Created: the four files in
§2. Modified: `package.json` (7 scripts, no new deps), `.env.example`
(`RESP_INT_LIVE_RUN_TOKEN` + pinned-sheet contract note),
`OUTREACH-RESPONSE-INTERPRETATION-v1.md` (this section + revision log).
Nothing else.

**4. Frozen artifacts & integrity** — Engine, workflow contract (incl. embedded
mirror), the 27-fixture corpus/loader, shipped `Response-Interpretation V1.json`
and all pre-Phase-5 tests were NOT modified. Integrity re-verified by the
shipped-workflow precondition checks (parses, `assertWorkflowContract`,
`assertCleanSource`, 2 code nodes, 5 canonical nodes, inactive, one read, zero
writes, no banned node types) and the 637-test suite; the deterministic
SHA-256-identical rebuild property of the shipped JSON is unchanged. The repo
is untracked in git, so Phase 5 kept a zero-write construction against frozen
paths, consistent with Phases 1-4.

**5. Test strategy & counts** — Local-only (no live n8n). New suite: 68 tests
in one file, run via `node --test`. Full suite **637/637 PASS**
(= 569 preserved + 68 new). Coverage highlighted in the v1.5 verification
summary: run-token/namespace composition, `readConfig` shapes, 27-fixture
acceptance, failure scenarios → trigger-metadata, seed projection (12 columns,
remapped ids, empty `text_preview`), injected reconciliation trigger input
(INCOMPLETE/empty/joined), canonical expected report (run_* stripped),
scoping/`compareCollected`, shipped-workflow precondition incl. tamper
detection, preflight A-I, mocked-transport execute/collect + full pass
pipeline, verify-input PASS/FAIL + `failure_info` + contamination failure,
cleanup safety (`CLEANUP_NOT_PERFORMED` on non-namespaced rows),
report redaction, CLI exit-code wiring, security-gate literal scan.

**6. Security & PII posture** — Runner never logs or persists raw
`response_text` / `provider_message_id` / sender / recipient; `redact()` walks
the run report recursively (sensitive-key names + secret-shaped values, incl.
nested). Secrets come from env or prompted-once (PS1 `Read-Secret`) and are
never written to files or the report. PS1 has no `-AsPlainText`, no stored
credentials. Literal scan green on the runner + PS1 (`Math.random(`, UUID,
`process.env.` and secret-shaped values absent); the only lexeme hits are the
test file's own intentional assertions.

**7. Determinism & reproducibility** — `runTokenFor` is deterministic when
`--run-token=` or `RESP_INT_LIVE_RUN_TOKEN` (hex 8..32) is supplied, else
`Date.now().toString(16)`; namespace `TEST-RESP-INT-LIVE-<token>`; row ids
`${ns}-${seq}` / `RESPI-${ns}-${seq}`. Expected output is fully deterministic:
`engineBehaviorFor(...)` at `FIXED_NOW` with `FIXED_RUN_ID` and run_* fields
stripped; no `Math.random`/UUID/current-time input anywhere in the runner.
A rerun with the same token and scenario re-seeds the same rows (idempotent by
construction — same remap, same ids).

**8. Verification evidence** — Probes (see v1.4 probe run, §27-harness) and the
68-test suite confirm: readConfig shape incl. `spreadsheetMatchesPinned`;
`seedRowsFor` 12-column shape; injected trigger input status COMPLETED;
expected-report shape + exit-map; preflight A-I incl. informational D2
network-free; `checkShippedWorkflow` order (contract before clean-source);
execution payload `{workflowData, data:{event, reconciliation_report, ...phase5}}`
POSTed under `X-N8N-API-KEY`; collect parse of `Interpret Responses` node;
`compareCollected` equal/actual/expected; `MockSheets.deleteRows(tab, [idx])`;
`runSelectedPhases` phase semantics (seed→verify-seed, verify against collected,
execute sets executionId); `overallStatusOf` PASS/FAIL/NOT_CONFIGURED rules;
run-report fields (`run_id`, `mode`, `test_namespace`, `stages`, counts,
`failure_info`, comparison_ready_output) with no env secrets.

**9. Failure semantics & exit codes** — Statuses `PASS|FAIL|NOT_CONFIGURED|
SKIPPED|CLEANUP_NOT_PERFORMED`; config failures never become PASS. Preflight
hard failures (contract, clean-source, D well-formed, sheet config/pinned
match/auth, tab, fixture count, contiguous ids) → exit 1; n8n execution
configured is informational-only. Exit map: 0 PASS, 1 FAIL, 2 usage/unknown,
3 NOT_CONFIGURED, 4 CLEANUP_NOT_PERFORMED; `RESULT: <status>` on stdout.
`cleanup` refuses non-namespaced rows (regex + prefix rule) with
`CLEANUP_NOT_PERFORMED` — zero risk to production rows.

**10. Cleanup & safety guarantees** — Seed writes ONLY to the `Response Log`
tab, ONLY rows matching `TEST-RESP-INT-LIVE-<hex 8..32>-<digits>`; no other tab
is ever touched. Cleanup deletes only those rows, verified by
`verify-cleanup`. Dry-run by default in the PS1 (`-Execute` required). No
workflow edits, no external posts, no writes outside the namespace. `clear`
n8n API can't self-trigger, so execute/collect without n8n config prints MANUAL
steps and reports NOT_CONFIGURED — never a fabricated PASS.

**11. Live-execution gate & status** — The local harness and tests are complete
and green, but **no live n8n execution was performed** (Phase 5-6 gate). Count
of live executions of the shipped workflow: 0. A real live PASS requires
`-Execute` with GOOGLE creds + n8n config (workflow id, API key), manual
confirmation of the in-app execution (Interpret Responses + Response
Interpretation Complete), then `--collect --execution-id`, then verify = PASS.
This is Phase 6 territory by design.

**12. Open items / handoff to Phase 6** — (a) Scenario `response-log-failure`
is driven honestly via `response_log_read_error` trigger metadata because a
real sheets read-failure cannot be forced non-destructively on the pinned
engine spreadsheet (recorded in v1.5). (b) Phase 6 owns run-level live
verification: real executions + collection + final comparison + completion
of the live-verification checklist. (c) Full artifact freeze + Phase 7 final
report.

**13. Closing statement** — The Phase 5 live runner is implemented, local tests
(637/637 including 68 new) pass, security/PII scan and frozen-integrity checks
are green, and no live n8n execution has been performed.

```
PASS — LIVE RUNNER READY FOR PHASE 6
```

### Revision log
- **2026-09-12 — v1.6** — Phase 6 attempted; **FAIL — PHASE 6 BLOCKED (environment
  gate)**. All required live config unset (n8n base URL/api key/workflow id, Sheets
  creds, spreadsheet id, run token); no n8n instance reachable (port 5678 closed);
  workspace root `.env` holds only `GITHUB_TOKEN`. Zero scenarios A–F executed; all
  six returned explicit NOT_CONFIGURED via the Phase 5 runner (exit 3) with
  persisted per-scenario reports — no evidence fabricated. Code-side gates all
  pass: baseline 637/637, frozen-integrity hashes recorded (§9 of the Phase 6
  report), precondition validators green, security scan green, reconciliation-
  injection mechanism present. Full consolidated report:
  `reports/PHASE-6-response-interpretation-v1.md`. Live n8n executions remain 0.
  Phase 7 (freeze) pending live validation; artifact NOT frozen.
- **2026-09-12 — v1.5** — Phase 5 live runner IMPLEMENTED (library runner,
  thin CLI + PS 1.5 launcher, npm scripts, `.env.example`, 68-test suite). Full
  suite 637/637 PASS; security scan + frozen-integrity green; live n8n NOT
  executed (Phase 5-6 gate); execute/collect correctly report NOT_CONFIGURED
  without n8n config. Capture/Reconcile/Phase 1-4 artifacts untouched. Phase 6
  (run-level verification) and Phase 7 (final report + freeze) still pending;
  full artifact NOT frozen.
- **2026-09-12 — v1** — Specification only. Read-only inspection pass; baseline
  386/386 PASS; frozen Capture/Reconcile artifacts untouched (untracked in git,
  verified by zero-write construction). No production code created.
- **2026-09-12 — v1.1** — Phase 1 LOCKED (17 decisions, §26) and engine
  implemented: `src/response-interpretation.js` + engine tests (39).
  Full suite 425/425 PASS. All deferred phases (fixtures, workflow, live
  runner, sheets) still pending; full artifact NOT frozen.
- **2026-09-12 — v1.2** — Phase 2 corpus LOCKED and implemented:
  `fixtures/response-interpretation-fixtures.json` (27 fixtures),
  `src/response-interpretation-fixtures.js` (loader),
  `tests/response-interpretation-fixtures.test.js` (49 tests). Full suite
  474/474 PASS; security/PII scan green; Capture/Reconcile untouched.
  Phases 3-7 (workflow, embedded mirror, live runner, sheets) still pending;
  full artifact NOT frozen.
- **2026-09-12 — v1.3** — Phase 3 workflow CONTRACT LOCKED and implemented
  (tests only, per the Phase 3 boundary): contract module + 66-test suite.
  Full suite 540/540 PASS; parity gate reproduces all 27 goldens through the
  `engineBehaviorFor` projection; security/PII scan green; Capture/Reconcile/
  Phase 1-2 artifacts untouched. Phase 4 (embedded mirror + workflow JSON +
  builder) and Phases 5-7 (harness, verification, report) still pending; full
  artifact NOT frozen.
- **2026-09-12 — v1.4** — Phase 4 workflow IMPLEMENTED: embedded mirror
  (`src/embedded-response-interpret.js`), builder
  (`scripts/build-response-interpretation-workflow.js`), shipped
  `Response-Interpretation V1.json` (5 nodes, repo root), and 29 workflow-build
  tests. Full suite 569/569 PASS; 27-fixture embedded parity vs the engine;
  deterministic SHA-256-identical rebuild; contract/clean-source validators
  pass; security/PII scan green; Capture/Reconcile/Phase 1-3 artifacts
  untouched. Phase 4 deviation notes recorded in §26. Phases 5-7 (live runner,
  verification, report) still pending; full artifact NOT frozen.