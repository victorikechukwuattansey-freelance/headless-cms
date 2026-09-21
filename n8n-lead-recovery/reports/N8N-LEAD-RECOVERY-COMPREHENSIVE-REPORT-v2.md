# n8n-lead-recovery — Comprehensive Repository Report (v2)

**Repo:** `n8n-lead-recovery/` (Lead Recovery Engine — n8n pipeline)
**Report date:** 2026-09-21
**Basis:** full-verification session against the current working tree (commit `ebc5c3a` = H.9.4c, plus the uncommitted H.9.x test/live-runner changes below).
**Supersedes:** `reports/N8N-LEAD-RECOVERY-COMPREHENSIVE-REPORT.md` (2026-09-16, basis commit `92ae00d` / A.11-R7). Per repo convention the old report is **retained** as history.
**Verification executed this session:** full test suite (`npm test`), `npm run verify:frozen`, `node scripts/security-check.js`, artifact fingerprint recompute, manifest revision inventory, git log/status audit, and doc-level re-read of the enrichment contract surface.

---

## 1. What this repository is

A local-first pipeline of n8n workflows for the Lead Recovery Engine: prospect discovery and validation, approval gating, outreach queue planning, execution delivery, response capture / reconciliation / interpretation, and **(added 2026-09-17/18)** enrichment. Every stage ships as:

- a JSON export (n8n artifact),
- a deterministic offline engine under `src/`,
- an offline test suite under `tests/`,
- a live runner / harness script under `scripts/` where built,
- a frozen-artifact manifest for the hardened stages.

The whole pipeline runs against **one pinned Google spreadsheet**
(`1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`, "Lead Recovery Engine Prospecting System") whose tabs are the durable data surface. It is not a SaaS; it is a portable artifact + validation stack for n8n Community Edition in Docker (development container: `serene_swartz`, n8n **2.38.7**).

**Zero runtime-dependency ambition, two operative deps.** `package.json` declares `@absolutejs/enrich@0.1.4` (business enrichment) and `@duckdb/node-api@1.5.5` (Overture parquet loader, operator-run only). Node ≥ 18 (verified on v24.x). Test runner: `node --test "tests/*.test.js"`.

> **README staleness note.** The root `README.md` (§1.2, §1.5) still describes a **nine-workflow** pipeline and quotes **857 tests / 62 suites** (H-B era). The repo now ships **ten stage workflows** (Enrichment V1 added) and the suite measured this session is **1289 tests / 127 suites**. The README was not rebased during the enrichment workstreams; treat its numbers and §1.2 table as stale.

---

## 2. Repository map

| Path | Purpose |
|---|---|
| `Lead Recovery Engine — Prospect Finder & Validation V1.json` | Stage 1 artifact — 33 nodes, GPL/FSQ/OSM (**em-dash** `—` filename) |
| `Approved Outreach Handoff V1.json` … `Response Reconciliation V1.json` | Other 8 stage exports |
| `Enrichment V1.json` | Stage 10 artifact — 16 nodes, deterministic builder |
| `Response-Interpretation V1 — Test Harness.json` | Phase 6.5 webhook→trigger bridge (test-only auxiliary; not a stage) |
| `frozen-artifacts.manifest.json` | Freeze gate: **version 7, 25 artifacts** + SHA-256 (see §6) |
| `src/` | Engines, embedded mirrors, fixture loaders, live runners, contracts, `google-places.js`, `mock-sheets.js`, `google-sheets-client.js`, `schema.js`, `provider.js`, `eligibility.js`, `cleanup.js`, `verify.js` |
| `tests/` | Per-stage suites incl. GPL normalization, harness suites, enrichment suites |
| `scripts/` | Builders (`build-*.js`), live runners (`run-*-live.js`), `security-check.js`, `verify-frozen.js`, `overture-load-places.js`, `check-overture.js`, `execution-once.js`, `queue-once.js` |
| `fixtures/` | Per-stage fixture JSON + loaders (incl. `gpl-fixtures.json`, `overture-*.parquet`, enrichment fixtures) |
| `docs/` | `PHASES.md`, `CONTAINER-RUNBOOK.md`, `CREDENTIALS.md`, `ARTIFACT-IMPORT.md`, `QUALIFICATION-FORMULA.md`, `AGENTDATA-API.md`, `OPEN-SOURCE-ENRICHMENT.md`, `ENRICHMENT-LOG.md`, `OVERTURE-LOADER.md`, `PHASE-6-ENVIRONMENT-RUNBOOK.md`, `MANIFEST-SNAPSHOT.md` |
| `reports/` | All phase / isolation / hygiene / GPL / enrichment reports + indexed `README.md` |
| `.env.example` | Env placeholders only (no secrets) |

Root workflow exports (11 files incl. harness; sizes measured this session): Prospect Finder & Validation **88,855 B**; Approved Outreach Handoff **26,356 B**; Run-Reconciliation-and-Reporting **15,031 B**; Outreach-Queue-and-Planning **13,109 B**; Outreach-Execution-and-Delivery **23,242 B**; Execution-Reconciliation **21,114 B**; Response-Capture **20,372 B**; Response-Reconciliation **22,302 B**; Response-Interpretation V1 **28,296 B** (+ harness **29,014 B**); Enrichment V1 **58,504 B**.

---

## 3. The workflows and their status

| # | Workflow | Status | Evidence |
|---|---|---|---|
| 1 | Prospect Finder & Validation V1 | **HARDENED** — A.10→A.12.2 + GPL gate + lineage fix; live validation pending operator decisions + re-import | `reports/PROSPECT-FINDER-GPL-*`, `PROSPECT-FINDER-PAIRED-ITEM-LINEAGE-FIX-REPORT.md` |
| 2 | Approved Outreach Handoff V1 | Shipped; **enrolled in freeze (manifest v7, 25th entry)**; write map reconciled (H.8d) | `reports/H8D-HANDOFF-WRITE-NODE-RECONCILIATION-REPORT.md` |
| 3 | Run Reconciliation V1 | Shipped (artifact + spec + offline/live suites) | `RUN-RECONCILIATION-AND-REPORTING-v1.md` |
| 4 | Outreach Queue & Planning V1 | Shipped (artifact + spec + offline/live suites) | `OUTREACH-QUEUE-AND-PLANNING-v1.md` |
| 5 | Outreach Execution & Delivery V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-AND-DELIVERY-v1.md` |
| 6 | Execution Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-RECONCILIATION-v1.md` |
| 7 | Response Capture V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-CAPTURE-v1.md` |
| 8 | Response Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-RECONCILIATION-v1.md` |
| 9 | Response Interpretation V1 | **COMPLETE — live-validated A–F, workstream closed** (Phase 5.4 linear-chain, Phase 6.5 harness) | `REPORT.md`, `reports/PHASE-6-*`, `PHASE-5-4-REPORT.md` |
| 10 | Enrichment V1 | **Shipped, frozen (manifest v6/v7), live-runner tested (H.8b, H.9)** — email-scope only (AgentData/Hunter sourcing, OSS verification); no phone sourcing | `reports/ENRICHMENT-PREFLIGHT-V1.md`, `H9-BUSINESS-ENRICHMENT-LIVE-RUNNER-REPORT.md` |

No workflow is claimed live-validated unless a report on disk says so with evidence (container runs ARE on disk — the untracked `ENRICH-LIVE-*.json` / `BIZ-ENRICH-LIVE-*.json` under `reports/`).

---

## 4. Architecture principles (as enforced)

- **Single spreadsheet, single source of truth** — every Sheets node pins the production `documentId` (via `__rl` resource locators). Tabs: Search Inputs (gid=0), Raw Leads (gid=101), Verified Leads (gid=102), Approved Outreach, Outreach Log, Response Log, **Contact Enrichment Log** (enrichment, new).
- **Built-in engines, embedded code** — a deterministic engine under `src/` is byte-mirrored into the workflow's Code nodes; offline suites assert engine↔embedded parity per fixture (the Prospect Finder embeds 16 code-node bodies byte-identical to `CODE_BY_NODE` in `src/prospect-finder-embedded-code.js`).
- **Fail-closed honesty** — read-only stages never fabricate a healthy zero; failed reads yield `INCOMPLETE` / `NOT_VERIFIABLE`; live runners print `NOT_CONFIGURED` (exit 3) rather than a fake PASS.
- **No hard-coded secrets** — provider credentials by n8n credential id/name only; the sole env-backed key in shipped artifacts is `GOOGLE_PLACES_API_KEY` (`$env` expression).
- **Builder-deterministic artifacts** — hardened workflows regenerated by `scripts/build-*.js`, never hand-edited; artifact hashes pinned in builder tests and §5.
- **Manifest-guarded freeze** — any drift in the 25 frozen artifacts fails `npm run verify:frozen`.
- **Fail-closed verification** — every PASS traces to a phase/run report on disk.

---

## 5. Gates (measured this session)

| Gate | Command | Result |
|---|---|---|
| Full offline suite | `npm test` | **1289 pass / 127 suites / 0 fail, exit 0** |
| Freeze gate | `npm run verify:frozen` | **25/25 PASS** (manifest **v7**) |
| Secret scan | `node scripts/security-check.js` | **exit 0 — GREEN** |

Progress across the suite (honest trajectory): 857/62 (H-B) → 948/83 (2026-09-16) → 987/92 (A.12.2) → 1261 (R9 lineage fix) → **1289/127** (this session).

No live execution, no external API calls, and no spreadsheet writes were performed this session.

### Artifact fingerprints

| Artifact | SHA-256 | Bytes | Note |
|---|---|---|---|
| `Lead Recovery Engine — Prospect Finder & Validation V1.json` | `30A5020506850B079EEA48F3932C41BF4FC20C32E224F81C059EE6A9162F2308` | 88,855 | Current — R9 lineage-fix rebuild (commit `ffd7d52`). The `7E335F38…407511` / 88,253 B value in the GPL-gate report and A.12.2 preflight is the **pre-lineage-fix** state, superseded on disk on 2026-09-18 (confirmed byte-identical diff: only `Dedup & Prepare Verified`'s `parameters` changed; node count 33 unchanged). |
| `Enrichment V1.json` | manifest-pinned (v6/v7 entry) | 58,504 | Deterministic via `npm run enrichment:build` |

Workflow id: Prospect Finder `WcUgtTPiKXPL0BLH` (from the retained v1 report; unchanged by R9). `active: false` throughout — shipping state, never auto-active.

---

## 6. Frozen manifest — version 7, 25 artifacts

`frozen-artifacts.manifest.json` → `{"version": 7, ...}` with **25 artifacts** and a 21-entry revision log. A SHA-256 mismatch blocks commit without an approved revision entry. Composition:

- **Response Interpretation scope (10):** `src/response-interpretation.js`, `response-interpretation-workflow-contract.js` (hash `8bb58c9b…`, 5.4 chain), `embedded-response-interpret.js`, `response-interpretation-live-runner.js`, `Response-Interpretation V1.json` (`ae365cd3…adb4bac`), `src/response-capture.js`, `src/response-reconcile.js`, `Response-Interpretation V1 — Test Harness.json`, `response-interpretation-scenario-payloads.js`, `response-interpretation-test-harness-contract.js`.
- **Enrichment/H.8 scope (15):** `enrichment-schema.js`, `enrichment-cache.js`, `enrichment-business.js`, `enrichment-contact.js`, `enrichment-contact-client.js`, `enrichment-contact-oss.js`, `embedded-enrichment-business.js`, `embedded-enrichment-contact.js`, `embedded-enrichment-contact-oss.js`, `fixtures/enrichment-fixtures.js`, `fixtures/enrichment-fixtures.json`, `fixtures/enrichment-contact-fixtures.json`, `fixtures/enrichment-contact-agentdata.json` (R-ENRICH-2, 2026-09-17), `Enrichment V1.json`, `Approved Outreach Handoff V1.json`.

**Revision history highlights:** v2 (Phase 5 CLI backend re-baseline) → Phase 5.2 (Manual Trigger output-slot defect) → Phase 5.4 (diamond→linear chain, `pairedItem` defect class) → v3 (Phase 6.5 harness additives) → v4 (Enrichment freeze R-ENRICH-1) → v5 (AgentData default provider, R-ENRICH-2) → v6 (H.8c D-C8 country-policy seam, 2026-09-18) → **v7** (Handoff enrollment).

**Note:** the `about`/revision-log prose documents versions up to v6 in detail; v7 = the 25th entry (Handoff) per `H8D` (which reports 25/25). `scripts/verify-frozen.js` drives the gate; baseline hashes recorded in `reports/PHASE-6-response-interpretation-v1.md` §9; `docs/MANIFEST-SNAPSHOT.md` mirrors current state.

---

## 7. Spreadsheet / schema contract

- **Verified Leads (gid=102):** 28 columns. Last four are enrichment-owned: `enrichment_business_status`, `enrichment_confidence`, `enrichment_gers_id`, `enrichment_last_run`.
- **Approved Outreach:** 24 columns. Handoff owns the first 21 (contract-frozen, asserted by `verify.js` / `src/schema.js`); Enrichment owns the last 3 (live orientation V/W/X = `contact_source_provider`, `contact_blocked`, `country` — H.8b.2 V/W orientation fix).
- **Outreach Log:** 20 columns (queue/execution/reconcile readers updated for the H.8c renames `cab1430`/`6e11439`).
- **Contact Enrichment Log** (new tab): columns A–N per `docs/ENRICHMENT-LOG.md` + `src/enrichment-schema.js`: `enrichment_id` = `ENRICH-<fnv1a32-8hex>`, `enrichment_key` = `domain::provider`, `lead_id`, `provider` (`hunter`|`oss`|`manual`), `query_input`, `result_email`, `result_contact_name`, `result_contact_title`, `result_verified` TRUE/FALSE, `credits_consumed`, `enriched_at`, `cache_hit_count`; one row per `(enrichment_key, provider)`, TTL policy + generic-email patterns; dependency-free shared by cache/contact/embedded mirrors.
- **Qualification formula (frozen, `docs/QUALIFICATION-FORMULA.md`):** Q:U ARRAYFORMULA, 90-point scoring, `score >= 70 → QUALIFIED`, VLOOKUP `target_niche` from `'Search Inputs'!A:B`; D1 = CLOSED; change protocol §7. No enrichment write re-scores (enriched columns live downstream of Q:U).
- **Enrichment write surface (locked, H.9/H.9.1):** Contact Enrichment Log append + exactly `contact_blocked` / `contact_source_provider` on Approved Outreach (`lead_id` match). Business enrichment touches money columns only via OSS fallback unless production creds are bound.

---

## 8. Enrichment stack (2026-09-17/18)

- **Providers:** AgentData (default since R-ENRICH-2; `domainSearch()` contract at `GET https://agentdata.run/api/v1/lookup?domain=&min_confidence=90&verification_status=valid,catch-all`, Bearer `AGENTDATA_API_KEY`, 200 ms pacing, retries [500,1500,4500], 401/403 fatal) + Hunter (retained, selectable) + OSS fallback (business via Overture doubling/…, contact via generic-email patterns). `provider` travels in the envelope; logs to `provider_runs.<provider>.credits_consumed`.
- **Country policy (H.8c/D-C8):** `isCountryInScope` (default = frozen `isUsCountry`) inserted as an optional predicate on `enrichment-contact` / `enrichment-contact-oss`; live runner passes `ENRICHMENT_COUNTRIES_ALLOW/DENY`.

**Enrichment scope (resolved 2026-09-21):** The enrichment stack is scoped to email only. AgentData is the default sourcing provider (SMTP-verified emails, confidence-scored, outreach-safe filter `min_confidence=90&verification_status=valid,catch-all`). Hunter is the secondary sourcing provider. Open-source tooling (MX checks, SMTP handshake, disposable/syntax filtering) provides verification, not sourcing — it confirms an address, it does not discover one.

Call-channel leads are out of enrichment scope. Their phone number is expected to arrive already populated in the Approved Outreach row; enrichment neither sources nor verifies it. There is no open-source B2B direct-dial database, and no paid phone provider will be integrated until the execution logic is proven end-to-end in DRY_RUN. This keeps the stack internally consistent: every enrichment provider is email-side, and the call channel depends only on upstream data quality.

Open operational question: AgentData's marketing pages state "1,000 lookups per day" for the Starter tier; the Terms of Service state "1,000 per month." The 30× discrepancy should be resolved by a live `GET /api/v1/me` call before any budget or rate-limit assumption depends on it.

- **Live runs on disk (untracked):** ~24 `reports/ENRICH-LIVE-*.json` + 6 `reports/BIZ-ENRICH-LIVE-*.json` — evidence the runner executed in-container; `H9` reports verified 25/25 frozen + 49-test suite green.
- **AgentData probe:** `H7-AGENTDATA-PROBE-REPORT.md` — probe status **CLOSED (2026-09-21)**: AgentData is email/tech-stack only (core API exposes no phone field); the open operational question that remains is the rate-limit discrepancy (see Enrichment scope above).
- **Overture:** operator-only (`scripts/overture-load-places.js`, `@duckdb/node-api`); not part of `npm test`.

---

## 9. Docs + reports inventories

**Docs (11, `docs/`):** `AGENTDATA-API.md`, `ARTIFACT-IMPORT.md`, `CONTAINER-RUNBOOK.md` (canonical container command: named volume `serene_swartz_data:/home/node/.n8n`, port `5678:5678`, no `--rm`, no `N8N_RUNNERS_BROKER_PORT` on server), `CREDENTIALS.md` (env names/types only, never values; credential ids are DB-local, re-selected after import), `ENRICHMENT-LOG.md`, `MANIFEST-SNAPSHOT.md`, `OPEN-SOURCE-ENRICHMENT.md`, `OVERTURE-LOADER.md`, `PHASE-6-ENVIRONMENT-RUNBOOK.md`, `PHASES.md`, `QUALIFICATION-FORMULA.md`.

**Reports (indexed by `reports/README.md`):** all PHASE-5.x/6.x, PROSPECT-FINDER (A10 merge, A11 empty-success, A12 phone normalization, CA offline harness, GPL preflight/isolation/gate/closure, MERGE-LOOP, PAIRED-ITEM-LINEAGE-FIX), HYGIENE-H-A/B/C, enrichment series (PREFLIGHT-V1, CONTACT-ENRICHMENT-PREFLIGHT, H4-REV, H7 probe, H8A/B/B1/B2/C/D, H9, H9.1/9.2/9.3), D2-FORMULA, plus this v1/v2 comprehensive pair. **41 report files** on disk, plus the 30 untracked live-run JSONs.

---

## 10. Git state (audited this session)

**Branch:** `pre-cleanup-2026-09-08` (part of the wider `jarvis-demo` repo).

**Top commits (newest first):** `ebc5c3a` (H.9.4c scope-aware write filter) · `67408a2` (H.9.3 transport/per-lead) · `8a31f16` (H.9.2 country aliases) · `6e11439` (schema test renames) · `cab1430` (H.8c column renames) · `f16514f` (ENRICHMENT-LOG docs) · `8742d1d` (H.9 business runner) · `ffd7d52` (Prospect Finder lineage fix) · `614f47c` (H.8d handoff) · `519f973` (H.8c report) · `6421f9f` (H.8c schema) · `2b7cb34` (H.8a container).

**Uncommitted in `n8n-lead-recovery/` (working-tree, all H.9.x-era):**
- Modified: `package.json` (+1 line), `scripts/run-live-harness.js`, `scripts/run-outreach-queue-live.js`, `scripts/run-reconciliation-live.js`, `tests/handoff-engine.test.js`, `tests/handoff-workflow.test.js`, `tests/harness-offline.test.js` (H.9 transport/per-lead test surface — matches `67408a2`'s stated "NOT frozen, byte-changeable" files).
- Untracked: `enrich-fail.txt` (see §11), `h94-partial.diff`, `test-output.txt`, `scripts/check-overture.js`, `scripts/execution-once.js`, `scripts/queue-once.js`, and the 30 live-run JSONs under `reports/`.

(Unrelated dirty files exist in sibling projects — `_open-canva/`, `reconcilekit/`, `kaya-renovations/`, `saas-boilerplate/` thumbnails, `AGENTS-BACKUP.md` — outside this repo's scope.)

---

## 11. Open signals / cleanup candidates

1. **`enrich-fail.txt` (repo root, untracked) — stale residue.** Captures a mid-workstream state where 3 `tests/enrichment-live-runner.test.js` dependencies failed (82/85 total, bare CLI-invocation exit-code expectations during env plumbing). **No longer reproducible** — current full suite is 1289/1289. Safe to delete once confirmed unneeded.
2. **README.md stale** — nine-workflow / 857-test framing predates Enrichment V1 and the current suite (§1). Rebase candidate (H-B did the last one).
3. **AgentData phone coverage — resolved, not a gap.** AgentData is email/tech-stack only; the core API exposes no phone field. The earlier "probe PENDING" item is closed: this is a scope boundary, not an open question. Phone sourcing for call-channel leads is upstream of enrichment by design (see Enrichment scope above).
4. **Live-run JSONs untracked** — intentional (run evidence kept on disk, not committed), but they bloat `git status`; consider a convention (e.g. commit or ignore) next hygiene pass.
5. **`gpl-fixtures` / `prospect-finder-gpl-live-fixtures`** remain the fixture proof for the GPL gate; no live Google Places call has ever been made.

---

## 12. Revision log for this report

| Rev | Date | Change |
|---|---|---|
| v1 | 2026-09-16 | Original comprehensive report (superseded). |
| v2 | 2026-09-21 | Refresh: 10th workflow (Enrichment V1), manifest v7/25 artifacts, 1289/127 suite, Handoff freeze, H.8/H.9 enrichment stack, current artifact fingerprints, git log A.11-R7→H.9.4c, README/enrich-fail staleness flags. |