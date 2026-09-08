# Lead Recovery Engine — Discovery & Prospecting Layer + Outreach Operations Layer
## Implementation Plan (Pass 1: Discovery + Pass 2: Outreach Operations)

Date: 2026-08-31
Scope: Pass 1 (Discovery & Prospecting) + Pass 2 (Outreach Operations). NO automated outreach, NO sending, NO live business contact, NO LinkedIn automation.

---

## 1. Files to Create

All new, additive. Nothing existing is modified.

| Path | Purpose |
|------|---------|
| `discovery/docs/IMPLEMENTATION_PLAN.md` | This plan |
| `discovery/docs/ARCHITECTURE.md` | Discovery architecture diagram + narrative |
| `discovery/docs/DATA_MODEL.md` | Final prospect/research schema + field rationale |
| `discovery/docs/SCORING.md` | Opportunity scoring model + evidence model |
| `discovery/docs/SECURITY_REVIEW.md` | Security, auth, input handling, suppression, compliance |
| `discovery/docs/DISCOVERY_README.md` | Operator-facing operations guide + outreach brief template |
| `discovery/src/prospect-model.js` | Canonical prospect record factory + field constants |
| `discovery/src/lib/normalize.js` | Domain / phone / identity / name normalization |
| `discovery/src/lib/dedupe.js` | Deterministic matching hierarchy + review flagging |
| `discovery/src/lib/evidence.js` | Evidence classification (OBSERVED/INFERRED/CLIENT-PROVIDED/VERIFIED/UNKNOWN) |
| `discovery/src/lib/score.js` | Transparent opportunity scoring |
| `discovery/src/lib/suppress.js` | Suppression guard (cannot reach outreach-ready) |
| `discovery/src/lib/states.js` | Prospect state machine + transition guards |
| `discovery/src/lib/validate.js` | Boundary validation for external/untrusted input |
| `discovery/src/store.js` | CSV prospect store read/write (mirrors existing CSV convention) |
| `discovery/src/pipeline.js` | Orchestrates discover -> normalize -> dedupe -> enrich -> score -> review -> ready |
| `discovery/src/outreach-brief.js` | Generates outreach brief (never sent) |
| `discovery/src/queue.js` | Operator queue operations (review/approve/suppress/reject) |
| `discovery/src/cli/review.js` | Operator console: list/review/approve/reject/suppress (Node CLI) |
| `discovery/tests/*.test.js` | `node:test` suite covering every case in prompt §19 |
| `discovery/fixtures/*` | Mock/untrusted-input fixtures for tests |
| `discovery/seeds/prospects.example.csv` | Example seeded prospect store (safe, plausible data) |
| `discovery/data/prospects.csv` | Actual prospect store (git-ignored if secrets; otherwise seeded empty) |
| `discovery/n8n/discovery-Discovery-Prospecting.json` | n8n automation workflow, separate from `production/` |
| `discovery/scripts/review-queue.ps1` | PowerShell operator queue helper (matches existing PS style) |
| `discovery/package.json` | Local manifest: defines `test`/`review`/`import` scripts, zero runtime deps |

## 2. Files to Modify

None. No existing file is edited.

The only existing files touched are:
- `workflows/lead-recovery-engine/.gitignore` (if it exists) or the repo `.gitignore` — to keep `discovery/data/` out of version control only if needed. Otherwise no modification.

## 3. Files Explicitly Protected (DO NOT TOUCH)

Confirm untouched:
- `workflows/production/01 - Lead Intake.json`
- `workflows/production/02 - Booking Status.json`
- `workflows/production/03 - Manual Callback Log.json`
- `workflows/production/04 - Status Update.json`
- `workflows/production/05 - Follow-up Sweeper.json`
- `workflows/production/06 - Error Handler.json`
- `workflows/production/07 - Customer Response.json`

Also protected (existing schemas / sheets / dev data):
- `leads`, `business_config`, `bookings`, `errors`, `status_updates`
- Existing dev workflow copies (`01-lead-IntakeV4.3.json` … `07-customer-response.json`)
- `README.md`, `QA_REPORT.md`, `IMPLEMENTATION_REPORT.md`, `TEST_PAYLOADS.json`, all scripts, all seeds

## 4. Data Model (summary)

Separate `prospect` store (NOT the client `leads` table). Prospect record fields and per-field rationale in `docs/DATA_MODEL.md`. Core boundary:

```
PROSPECT  (potential client of LRE)   -- THIS LAYER
LEAD      (end-customer lead of a client) -- EXISTING 7-WORKFLOW ENGINE (untouched)
```

The prospect store never writes to `leads`/`business_config`/`bookings`/`errors`/`status_updates`.

## 5. Workflow Architecture

```
SOURCE (google_maps | business_directory | company_website | manual_linkedin_research | operator_entered)
  -> PROSPECT RECORD (untrusted input, validated at boundary)
  -> NORMALIZE (domain/phone/identity)
  -> DEDUPE (deterministic match hierarchy; ambiguous -> needs_review)
  -> ENRICH (evidence-tagged fields only; no fabricated metrics)
  -> SCORE (transparent opportunity_score + reason)
  -> HUMAN REVIEW (operator: approve/reject/suppress)
  -> OUTREACH-READY (research sufficient for a human to contact; NOT auto-send)
```

Parallel functional map:
- **Code layer (Node, zero-dep):** model, normalize, dedupe, evidence, score, suppress, states, validate, store, pipeline, queue, brief. Runs deterministic tests.
- **Automation layer (n8n):** one additive workflow in `discovery/n8n/` that knows how to persist a discovered prospect into a Google Sheet mapped to the same columns (google_maps/directory import path). It does NOT modify production workflows.
- **Operator layer (PowerShell + Node CLI):** review queue, approve/reject/suppress, export outreach-ready list + outreach briefs.

## 6. Test Strategy

`node:test` (built into Node v24, zero external dependencies). Fixtures are mock/untrusted records. Test files cover (§19):
1. new prospect creation
2. source provenance
3. domain normalization
4. phone normalization
5. duplicate discovery from two sources
6. ambiguous duplicate -> human review
7. opportunity scoring
8. evidence classification
9. suppression
10. rejected prospect
11. outreach-ready prospect
12. malformed input
13. missing required data
14. duplicate prospect retry

Invariants proven by tests:
- two sources -> one business (no duplicate)
- unsupported claims not generated (score/evidence boundary)
- suppressed prospect cannot become outreach-ready
- prospect records never enter the customer `leads` table
- production workflows remain untouched (test asserts protected files unchanged / not referenced for writes)

## 7. Assumptions

- Node.js v24 available (built-in test runner). No external npm packages.
- Prospect data store is a CSV file mirroring the existing Google-Sheets/CSV convention; an n8n Google Sheets workflow maps the same columns for live use.
- "Outreach ready" = human may contact; automation is NOT authorized to send anything.
- LinkedIn is a MANUAL research step only; no LinkedIn automation/scraping.
- External/discovered data is untrusted; validated and sanitized at the boundary.
- Opportunity score is a prospecting heuristic backed by evidence classes, never a claim of actual abandoned-lead counts or revenue.

## 8. Compliance Boundaries

- No automated cold outreach in this pass.
- Suppression is enforced in the state machine: `suppressed` is a terminal guard; a suppressed prospect cannot transition to `outreach_ready`.
- Public availability of a contact address is NOT treated as proof that all outreach is permitted; suppression + documented contact policy.
- Compliance assumptions are documented separately from technical implementation (`docs/SECURITY_REVIEW.md`).

---

# Pass 2: Outreach Operations Layer

Date: 2026-08-31
Scope: Outreach activity model, outreach state machine, compliance gate, outreach queue, draft preparation, response tracking, qualification, demo/pilot/won progression, reporting. NO autonomous sending — all outreach requires operator action.

## P2-1. Files to Create (Pass 2)

| Path | Purpose |
|------|---------|
| `src/outreach-model.js` | Outreach activity record factory, channel constants, response types |
| `src/lib/outreach-states.js` | 12-state outreach state machine + transition guards |
| `src/lib/compliance.js` | Compliance gate: suppression check, opt-out, contact method validation, channel validation |
| `src/outreach-store.js` | CSV activity store (append-only audit trail) |
| `src/outreach-queue.js` | Queue prospect, prepare draft, send outreach, record response, query queue/activities |
| `src/qualification.js` | Qualification logic (score threshold or reply-based), mark demo/pilot/won/lost |
| `src/reporting.js` | Outreach report: status breakdown, channel performance, reply rates, conversion rates |
| `tests/outreach-states.test.js` | Unit tests for outreach state machine (OUT-01 through OUT-07) |
| `tests/outreach-queue.test.js` | Unit tests for queue, draft, send, response, qualification, compliance (OUT-08 through OUT-15) |
| `tests/e2e-outreach.test.js` | End-to-end outreach scenarios (E2E-OUT-01 through E2E-OUT-14) |

## P2-2. Files Modified (Pass 2)

None. All Pass 2 modules are additive.

## P2-3. Protected Files (unchanged)

All production workflows (01–07) and all Pass 1 discovery modules remain untouched.

## P2-4. Outreach State Machine

12 statuses with typed transitions:

```
not_ready → queued → prepared → contacted → replied → qualified → demo → pilot → won
                                  ↓                       ↓
                            follow_up_due               lost
                                  ↓
                            contacted (retry)
```

All states can transition to `suppressed` (terminal) or `lost` (terminal). `won` and `lost` are terminal for non-suppressed transitions.

## P2-5. Compliance Gate

Every outreach action passes through `complianceGate(record)`:
- Blocked if `suppressed === true`
- Blocked if `opt_out === true`
- Blocked if no contact method (phone, email, or contact_name)
- Channel validated against allowed list: `email`, `phone`, `linkedin_manual`, `website_contact`, `other`

## P2-6. Data Model

**Prospect** (existing, unchanged): `outreach_status`, `outreach_attempts`, `last_outreach_at`, `next_outreach_at`, `response_status`, `qualified_for_demo`, `client_status`

**Outreach Activity** (new audit trail): `outreach_id`, `prospect_id`, `channel`, `contact_method`, `prepared_at`, `sent_at`, `operator`, `message_reference`, `status` (draft/sent), `response_at`, `response_type`, `response_notes`, `created_at`, `updated_at`

Activity store is append-only CSV — never deletes, never modifies sent records.

## P2-7. Qualification

- Score >= 70 OR prospect has replied → qualifies for demo
- `qualified_for_demo` flag set on prospect
- `client_status` set to `client` when `markWon` is called
- No path from outreach layer to production lead table

## P2-8. Test Coverage (Pass 2)

- 80 new tests across 3 test files
- 190 total tests (110 Pass 1 + 80 Pass 2), all passing
- Production regression assertions verified in E2E-OUT-11
- Prospect/lead separation verified in E2E-OUT-10, E2E-OUT-12, E2E-OUT-13

---

# Pass 3: Controlled Prospect Batch — Operational Readiness

Date: 2026-08-31
Scope: Small operator workflow to move a real 10–25 U.S. small-business batch through import → validate → normalize → dedupe → research → score → review → outreach-ready → outreach queue. No real outreach is sent. No large subsystem is built.

## P3-1. Files to Create (Pass 3)

| Path | Purpose |
|------|---------|
| `src/batch-import.js` | CSV batch parsing + per-record validation (reject/flag, never silently discard) + normalization |
| `src/batch-pipeline.js` | Orchestrates import → dedupe → research → score → review → outreach_ready → queue |
| `src/batch-run.js` | Operator CLI: `node src/batch-run.js batch.csv [research.json]` |
| `scripts/batch-import.ps1` | PowerShell operator helper (matches existing PS style) |
| `seeds/batch-import.example.csv` | Synthetic operator import template (8 rows, safe data) |
| `tests/outreach-batch.test.js` | 23 batch tests (B01–B09) + production regression |

## P3-2. Files Modified (Pass 3)

- `package.json` — added `"batch": "node src/batch-run.js"` script (additive).

No validated Pass 1 / Pass 2 logic was rewritten. `outreach-brief.js`, scoring, dedupe, states, and compliance are all reused as-is.

## P3-3. Import Validation

`batchImport` parses CSV, then per-row `validateImportRecord` rejects/flags:
- missing business name
- malformed website (`javascript:` / `data:` / `file:` schemes)
- malformed phone (digits not 10 or 11)
- malformed state (not exactly 2 chars)
- invalid source (not in approved source list)

Every rejected record carries an explainable reason; nothing is silently dropped.

## P3-4. Batch Orchestration

`processBatch(importResult, existingRecords, researchMap)`:
1. **Dedupe** against existing + in-batch records (validated dedupe). Cross-source duplicates resolve to one prospect; same-name/same-state/different-city → ambiguous → `needs_review` (no auto-merge).
2. **Research/score** each non-ambiguous record via validated `assessOpportunity` using operator-supplied flags + evidence (research map). No fabricated signals.
3. **Route**: suppressed → terminal; UNKNOWN evidence / no score → `needs_review` (insufficient); score ≥ 70 → approved; else → rejected with reason.
4. **Approve → outreach_ready → queue** (set `outreach_status = queued`). Activity (draft) is only created by the operator afterwards.

Returns reconciled counts; E2E batch test asserts `invalid + duplicates + records === imported` (no record disappears).

## P3-5. Reachability Rule

A prospect reaches `outreach_ready` only when: required info exists, sufficient research/evidence exists, passed review, not suppressed, contact method exists, and no blocking compliance condition exists. It never auto-sends; it only means an operator may prepare/review outreach.

## P3-6. Batch Fixture (synthetic, 25 rows)

- multiple discovery sources (google_maps, business_directory, manual_linkedin_research)
- 4 cross-source duplicates
- 1 ambiguous same-name/same-state/different-city pair
- insufficient-data + suppressed + high/medium/low-fit prospects
- 1 malformed input (missing business name)

## P3-7. Test Coverage & Results (Pass 3)

- 23 new tests (B01–B09 + production regression), all passing
- **213 total tests** (110 Pass 1 + 80 Pass 2 + 23 Pass 3)
- Production hashes / node counts unchanged; batch modules have no path to production workflows or lead tables.

---

# Pass 4: Persistent Prospect Store + Reviewable Outreach Queue

Date: 2026-08-31
Scope: Turn the validated prospect pipeline into persistent operator state. A batch import persists into the canonical prospect CSV store so the operator can import today, close the terminal, and return tomorrow to review the same prospects and continue from the outreach queue. Persistence only — no outreach, no external database.

## P4-1. Files Created (Pass 4)

| Path | Purpose |
|------|---------|
| `tests/persistence.test.js` | 21 tests (P-SNAP, P01–P19, E2E persistence) + production regression |

## P4-2. Files Modified (Pass 4)

| Path | Change | Rationale |
|------|--------|-----------|
| `src/store.js` | Added atomic `saveCsv` (write-temp + rename); fixed `loadCsv`/added `parseCsvText` to honor quoted newlines; added `identityKey`, `loadProspects`, `listProspects`, `getProspect`, `findByIdentity`, `createProspect`, `updateProspect`, `persistBatch`, `genProspectId` | Persistent-store contract (§5), CSV safety (§15), idempotency (§9). `saveCsv` behavior otherwise unchanged. |
| `src/prospect-model.js` | Added `ambiguous`, `dedup_reason`, `dedup_matched_id` to `PROSPECT_FIELDS` | Persist operator-review/dedup provenance for ambiguous records (§8, §10). Prospect-layer fields only — no customer-lead fields. |
| `src/batch-run.js` | Added persistence step (`persistBatch`) + PERSISTED report section | Wire import → persist → report (§7). |

## P4-3. Protected files

Seven production workflows (01–07) unchanged. Pass 1/Pass 2 validated logic reused as-is.

## P4-4. Persistent-Store Contract

Minimal, deterministic, CSV-backed (no database). Lives in `store.js`:

- `createProspect(file, record)` — create + persist
- `getProspect(file, id)` — read by `prospect_id`
- `listProspects(file)` — list all
- `updateProspect(file, record)` — atomic update by `prospect_id`
- `findByIdentity(file, record)` — find by normalized identity
- `persistBatch(file, records)` — idempotent batch persistence + reconciliation
- `identityKey(record)` — deterministic idempotency key: `name|state|city|domain|phone`

PERSISTED fields: provenance, research evidence, score, review state, suppression state, outreach readiness. No derived fields are silently reset on reload.

## P4-5. Idempotency

Idempotency is detected by the **persisted-identity key** `name|state|city|domain|phone`. Re-running the same batch re-resolves every record against the already-persisted store and skips it (counted in `duplicates`), so the second import creates **zero** new rows. The fuzzy `lib/dedupe.js` still decides whether two differently-sourced records describe the same business (cross-source → one canonical; same-name/different-city → separate + `needs_review`).

## P4-6. Data Integrity

- **CSV round-trip**: object → CSV → object preserves required fields (tested).
- **Special characters**: commas, quotes, apostrophes, unicode, URLs, and **embedded newlines** round-trip via the new `parseCsvText` tokenizer.
- **Failed writes**: `saveCsv` writes to a temp file then atomically renames; a failed write leaves the target byte-for-byte intact and no stray temp file (tested by mocking a disk-full write).
- **State preservation**: review status, suppression, score, outreach readiness, research status are all persisted (not derived-on-reload).
- **Provenance**: `source`, `source_url`, `discovery_date`, evidence classification, score reason survive.

## P4-7. Test Coverage & Results (Pass 4)

- 21 new tests: P-SNAP + P01–P19 + E2E persistence
- **234 total tests** (110 + 80 + 23 + 21), all passing
- Production workflows unchanged (P19 + regression snap).

---

# Pass 5: Persistent Review Operations + Operator Continuity

Date: 2026-08-31
Scope: Route review decisions (approve / reject / suppress / ready) through the canonical persistent prospect store so they survive process termination. Closes the loop: IMPORT → PERSIST → REVIEW → MUTATE → PERSIST DECISION → RELOAD → CONTINUE. Review persistence only — no outreach, no redesign of validated discovery/outreach logic.

## P5-1. Files Created (Pass 5)

| Path | Purpose |
|------|---------|
| `src/review-ops.js` | Persistence-aware review operations using the canonical store API |
| `tests/review-persistence.test.js` | 18 tests (R0-SNAP, R01–R15, E2E-REVIEW) + production regression |

## P5-2. Files Modified (Pass 5)

| Path | Change |
|------|--------|
| `src/cli/review.js` | Mutations now call `reviewAndPersist` (canonical `getProspect`+`updateProspect`) instead of a bulk whole-array `saveStore`; added `--store=` flag. Command syntax unchanged. |

Validated `queue.js` mutators, `store.js` contract, state machine, and compliance rules are all reused as-is (not rewritten).

## P5-3. Review → Store Flow

```
LOAD canonical prospect (getProspect by id — fresh from disk)
→ VALIDATE transition (existing queue.js state/compliance rules)
→ MUTATE (queue.js mutator: reviewApproval / reviewRejected / reviewSuppressed / reachOutreachReady)
→ ATOMIC PERSIST single record (updateProspect → saveCsv temp+rename)
→ CONFIRM or explicit failure (invalid_transition / persist_failed)
```

## P5-4. Review Commands

| Command | Effect (persisted) |
|---------|--------------------|
| `approve <id>` | `research_status → approved`; audit `updated_at` |
| `reject <id> <reason>` | `research_notes += 'REJECTED:<reason>'`; stays reviewable (`needs_review`); never auto-advanced |
| `suppress <id> <reason>` | `suppressed`, `suppression_reason`, `suppressed_at`; terminal; blocked from outreach |
| `ready <id>` | `research_status → outreach_ready` (validated `reachOutreachReady`); blocked for suppressed records |
| `list` / `show <id>` / `brief <id>` | read-only |

## P5-5. State Persistence (persisted vs derived)

- **PERSISTED**: `research_status`, `research_notes`, `suppressed`, `suppression_reason`, `suppressed_at`, `opportunity_score`, `evidence_class`, `recovery_signal_evidence`, `source`, `source_url`, `discovery_date`, `updated_at`.
- **DERIVED / in-memory only**: the transient `rejected` flag set by `reviewRejected` (the rejected decision is persisted via `research_status` + `REJECTED:` note, not a separate column). Outreach readiness is an explicit persisted `research_status`, gated by the validated pipeline.

## P5-6. Atomicity

Each review mutation persists the single canonical record via `updateProspect` (temp+rename). On write failure the store stays byte-for-byte intact, the mutation is reported as `persist_failed` (never success), and no temp file remains.

## P5-7. Test Coverage & Results (Pass 5)

- 18 new tests: R0-SNAP + R01–R15 + E2E operator continuity
- **252 total tests** (110 + 80 + 23 + 21 + 18), all passing
- Production workflows unchanged (R15 + regression snap).
- Known limitation: single-operator CSV persistence; concurrent sessions remain unsupported (documented, no multi-user locking added).

---

# Pass 6: Operator-Assisted Research Entry + Re-Scoring

Date: 2026-08-31
Scope: Route operator-entered research through the canonical persistent prospect store so research can raise a score without automatically approving or making outreach-ready. Closes the operator research loop using the existing validated architecture (reuse `assessOpportunity` scorer, `updateProspect` atomic persistence, `reviewAndPersist` path). No new subsystem, no automated research, no LinkedIn scraping, no outreach send.

## P6-1. Files Created (Pass 6)

| Path | Purpose |
|------|---------|
| `tests/research-persistence.test.js` | 26 tests (RS01–RS20, E2E-RESEARCH-01–05) |
| `src/prospect-model.js` | Extended `PROSPECT_FIELDS` with `research_evidence` JSON column |
| `src/review-ops.js` | New `researchAndPersist` + `researchBrief` helpers (canonical-store API) |
| `src/cli/review.js` | New `research <id> [--flag=]... [--evidence=] [--class=] [--source=] [--note=]` command |

## P6-2. Files Modified (Pass 6)

| Path | Change |
|------|--------|
| `src/prospect-model.js` | Added `research_evidence` (JSON array of `{text, class, source, flags, at}`) to `PROSPECT_FIELDS` + `newProspect()` default `[]` |
| `src/review-ops.js` | Added `researchAndPersist(file, id, opts, now)` — loads canonical prospect via `getProspect`, appends classified evidence item to `research_evidence`, unions all accumulated flags, re-runs validated scorer `assessOpportunity`, stamps `updated_at`, persists atomically via `updateProspect`. Added `researchBrief(file, id)` — read-side enrichment of validated brief output with updated score/explanation + distinct-classified evidence items; validated builder output untouched. |
| `src/cli/review.js` | Added `research <id>` CLI command parsing flags `--flag=<key> [--evidence=<text>] [--class=<OBSERVED|INFERRED|CLIENT_PROVIDED|VERIFIED|UNKNOWN>] [--source=<src>] [--note=<text>]` with `--store=<path>` option. Mutates via `reviewAndPersist` path. `brief` now delegates to `researchBrief` (read-side enrichment). |

## P6-3. Research Command Flow

```
research <id> [--flag=<key> [--evidence=<text>] [--class=<cls>] [--source=<src>] [--note=<note>]]
```

1. `getProspect(file, id)` — fresh from disk (never stale in-memory).
2. Validate flags against the exact 8 factor keys from `lib/score.FACTORS`; reject unknown keys.
3. Validate evidence classification against `EVIDENCE_CLASSES` (OBSERVED/INFERRED/CLIENT_PROVIDED/VERIFIED/UNKNOWN); never silently upgrade.
4. Append new evidence item `{text, class, source, flags, at}` to canonical `research_evidence` JSON column.
5. Union all accumulated item flags → `allFlags` = union across every research entry for this prospect.
6. Re-run the existing validated scorer: `assessOpportunity(rec, allFlags, { cls: representativeClass, text: combinedText })`. Sets score, reason, strength, evidence_class, recovery_signal_evidence. Does NOT change research_status (research ≠ approval).
7. Stamp `updated_at`.
8. `updateProspect(file, rec)` — atomic temp+rename. On failure: store unchanged, report `persist_failed` (never false success).
9. Return `{ok:true, value: rec}` or `{ok:false, error}`.

Research entry is allowed on a suppressed prospect as metadata-only (suppression fields never touched). Suppression survives.

## P6-4. Evidence Model

- **Canonical column**: `research_evidence` — JSON array; each entry `{text, class, source, flags, at}`. Classes preserved exactly as entered; INFERRED never upgraded.
- **Scorer input**: `assessOpportunity(rec, allFlags, { cls: repClass, text: combinedText })` where `repClass` = most recent non-UNKNOWN classification; `combinedText` = items' texts joined by " | ".
- **Per-evidence-text**: Operator can enter multiple items (e.g., OBSERVED + INFERRED + UNKNOWN) — each retains its own classification; the single `evidence_class` field reflects the most specific/latest available (not a merge/collapse).

## P6-5. State Persistence (persisted vs derived)

- **PERSISTED**: `research_evidence` (JSON), `research_notes`, `evidence_class`, `research_status`, `opportunity_score`, `opportunity_score_reason`, `recovery_signal_strength`, `recovery_signal_evidence`, `updated_at`.
- **DERIVED / in-memory only**: no separate `rejected` column (rejected decision is `REJECTED:` note + status `needs_review` — persisted).
- **research ≠ approval**: `research_status` stays `needs_review` even when score improves to 90; operator must separately `approve`.

## P6-6. Review Commands (updated)

| Command | Persisted effect |
|---|---|
| `approve <id>` | `research_status → approved`; audit `updated_at` |
| `reject <id> <reason>` | `research_notes += 'REJECTED:<reason>'`; stays reviewable |
| `suppress <id> <reason>` | `suppressed`, `suppression_reason`, `suppressed_at`; terminal |
| `ready <id>` | `research_status → outreach_ready` (validated); blocked for suppressed |
| `research <id> ...` | Appends classified evidence → re-scores → persists; status unchanged |
| `list` / `show <id>` / `brief <id>` | read-only |

## P6-7. Test Coverage & Results (Pass 6)

- **26 new tests**: RS01–RS20 + E2E-RESEARCH-01–05
- **278 total tests** (110 + 80 + 23 + 21 + 18 + 26), all passing
- Production workflows unchanged (R15 + regression snap).
- Known limitation: single-operator CSV persistence; concurrent sessions unsupported (documented, no multi-user locking added).

## P6-8. E2E Scenarios

- **E2E-RESEARCH-01**: needs_review → research (observed + inferred evidence) → re-score → persist → reload → verify research and score survive; status stays needs_review.
- **E2E-RESEARCH-02**: research → operator approves → outreach_ready → reload → verify score 90 persists; status outreach_ready.
- **E2E-RESEARCH-03**: research improves score but operator does NOT approve → stays needs_review.
- **E2E-RESEARCH-04**: suppressed → research → persists → reload → stays suppressed; outreach blocked.
- **E2E-RESEARCH-05**: research → process exits → process restarts → research and score remain available in store.

## P6-9. Outreach Safety

No outreach is sent. Research changes only prospect metadata (evidence, score). Suppressed prospects remain permanently blocked. LinkedIn: manual only; no automated access.

## P6-10. Production Protection

**7/7 untouched.** Node counts: 31 / 22 / 24 / 29 / 10 / 4 / 13. Verified by R15 + full-suite regression snap.

## P6-11. Data Boundary

PROSPECT ≠ CLIENT ≠ END-CUSTOMER LEAD. `review-ops.js`/`cli/review.js` have no path into `leads`, `business_config`, `bookings`, `status_updates`, or `errors` (RS18); prospect schema (`PROSPECT_FIELDS`) never contains customer-lead fields (RS18). `research_evidence` is a prospect-only field.

## P6-12. Defects

All defects discovered and fixed in this pass are documented in the test file and the final report.

## P6-13. Remaining Gaps

- A per-prospect **contact-policy + explicit opt-out** workflow tied to the compliance gate (still inferred).
- **Operator research-entry UX** (interactive prompts vs flag-based CLI; flag-based chosen for testability and fit with existing CLI conventions).
- CSV is **single-writer**; concurrent operators remain unsupported (documented limitation).

## P6-14. Recommended Next Action

**Do not implement.** Pass 6 is complete. The operator can now run `research <id>`, enter classified evidence, and have the validated scorer re-compute the score in-place and persist it — without automatically approving or making the prospect outreach-ready. Research evidence survives process restart. The research_evidence column preserves distinct classifications. No new subsystem was built; the existing validated architecture (pipeline.js → assessOpportunity → store.js → updateProspect) was reused.

---

# Pass 7: Contact Policy + Explicit Opt-Out Hardening

Date: 2026-09-01
Scope: Add a `contact_policy` gate to the outreach-eligibility path so `UNKNOWN ≠ PERMITTED`; add `policy <id>` and `optout <id> <reason>` CLI commands; ensure opt-out activates suppression and is durable (never reversible by ordinary `policy permitted`). Surgically fixed the outreach-eligibility fixtures that failed under the new production contract. No outreach, no new subsystem, no production n8n changes.

## P7-1. Invariant (user-mandated)

- `contact_policy`: `''` (legacy empty default) → BLOCK, `'unknown'` → BLOCK, `'blocked'` → BLOCK, `'opted_out'` → BLOCK, `'permitted'` → MAY PROCEED.
- `complianceGate()` returning `ok=true` does **not** equal "authorized for outreach". The actual outreach-eligibility path (`queueProspect`/`prepareDraft`/`sendOutreach`) enforces the stricter check: `contact_policy === 'permitted'`, treating anything else as `'unknown'` (blocked). `complianceGate()` itself remains unchanged.

## P7-2. Files Changed (Pass 7)

| Path | Change |
|------|--------|
| `src/outreach-queue.js` | Production: added `contact_policy` gate to `queueProspect()`, `prepareDraft()`, `sendOutreach()` — `policy = record.contact_policy === 'permitted' ? 'permitted' : 'unknown'; if (policy !== 'permitted') return { ok:false, error:'contact_policy_not_permitted', reason:... }`. Placed after the `complianceGate()` call. `complianceGate` itself NOT modified. |
| `src/review-ops.js` | Added `policyAndPersist(file, id, policy, now)` and `optoutAndPersist(file, id, reason, now)` (canonical `getProspect` → validate/mutate → `updateProspect`), plus `normalizeContactPolicy`, `isOptedOut`, `CONTACT_POLICIES`. Opt-out activates suppression via `lib/suppress.suppress` and is durable; `policyAndPersist` refuses `permitted` on an opted-out prospect (`opted_out`). |
| `src/cli/review.js` | Added `policy <id> <permitted|blocked|unknown>` and `optout <id> <reason>` commands. |
| `src/prospect-model.js` | Added `opt_out_reason` + `opt_out_at` to `PROSPECT_FIELDS` and `newProspect()` so opt-out reason/timestamp are durable across persistence. |
| `tests/outreach-queue.test.js` | Fixture corrections: OUT-08/09/09b/10/10b/10c add `contact_policy: 'permitted'` (contactable prospects); `outreachReadyRec` helper re-applies contact_policy (operator-set field, dropped by the sanitizer on ingest). |
| `tests/e2e-outreach.test.js` | Fixture corrections: E2E-OUT-01/02/09 add `contact_policy: 'permitted'`; `makeRec` helper re-applies contact_policy. |
| `tests/outreach-batch.test.js` | B04/B06 rewritten to reflect the new contract: raw batch import auto-queues nothing (UNKNOWN ≠ PERMITTED); approved+scored+non-suppressed prospects are outreach_ready but only queue once `contact_policy=permitted` is granted. Briefs built only after policy granted. |
| `tests/persistence.test.js` | P14/E2E-PERSIST updated to grant `contact_policy=permitted` and queue approved prospects before persisting (operator step), then verify they survive reload and remain queueable. |
| `tests/contact-policy.test.js` | NEW: 29 tests (CP01–CP20 + E2E-CP-01..08). |

## P7-3. `policy` + `optout` Command Flow

```
policy <id> <permitted|blocked|unknown>   # operator grants/clears contact policy
optout <id> <reason>                      # durable explicit opt-out + suppression
```

1. `getProspect(file, id)` — fresh from disk.
2. `policy`: normalize policy (`''`→unknown, else permitted|blocked|unknown); reject anything else (`invalid_policy`). If the prospect is opted out, `permitted` is refused (`opted_out`). Set `contact_policy`, stamp `updated_at`, persist atomically.
3. `optout`: set `opt_out=true`, `opt_out_reason`, `opt_out_at`, activate `suppress(rec, 'opted_out:<reason>', ts)` (sets `suppressed`, `suppression_reason`, `suppressed_at`, status `suppressed`), persist atomically. Opt-out is terminal/durable; NEVER reversible by `policy permitted`.
4. `updateProspect(file, rec)` — atomic temp+rename; on failure the store is untouched and `persist_failed` is returned (never false success).

## P7-4. Test Coverage & Results (Pass 7)

- **29 new tests**: CP01–CP20 + E2E-CP-01..08.
- **307 total tests** (110 + 80 + 23 + 21 + 18 + 26 + 29), all passing, 0 failures.
- **13 original fixture failures** (from adding the production gate) all resolved via surgical fixture corrections reflecting the new contract (OUT-08/09/09b/10/10b/10c, E2E-OUT-01/02/09, B04/B06, P14/E2E-PERSIST). No production logic was changed to satisfy fixtures; each corrected prospect that is meant to be contactable now carries `contact_policy: 'permitted'`.
- Production workflows unchanged: node counts 31 / 22 / 24 / 29 / 10 / 4 / 13 (verified by CP20 + full-suite regression snap).
- Opt-out durability verified across process exit/restart (E2E-CP-08).

## P7-5. Outreach Safety

No outreach is sent. The `contact_policy` gate is an eligibility gate on `queueProspect`/`prepareDraft`/`sendOutreach` — it only permits an operator to prepare/review. LinkedIn remains manual only. Opt-out activates suppression (the strongest block) and is durable.

## P7-6. Production Protection

**7/7 untouched.** Node counts: 31 / 22 / 24 / 29 / 10 / 4 / 13. Verified by CP20 + full-suite regression snap.

## P7-7. Data Boundary

PROSPECT ≠ CLIENT ≠ END-CUSTOMER LEAD. `contact_policy`/`opt_out`/`opt_out_reason`/`opt_out_at` are prospect-only fields; `PROSPECT_FIELDS` never contains customer-lead fields (CP19).

## P7-8. Remaining Gaps

- CSV is **single-writer**; concurrent operators remain unsupported (documented limitation).
- `contact_policy` is grant-only via operator CLI; no automated/programmatic grant path (by design — no autonomous authorization).

## P7-9. Recommended Next Action

**Stop after Pass 7 validation.** The production 7-workflow foundation is protected and unchanged; `UNKNOWN ≠ PERMITTED` is enforced at the outreach-eligibility boundary; operators can explicitly grant/clear contact policy and record durable opt-outs that activate suppression and can never be reversed by `policy permitted`. No outreach was sent. Do not proceed to another feature.



