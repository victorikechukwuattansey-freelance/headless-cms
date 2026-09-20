# H.9 Report — Business Enrichment V1 engine-direct live runner

**Date:** 2026-09-18
**Status:** PASS — RUNNER + OFFLINE SUITE GREEN; LIVE DRY-RUN NOT_CONFIGURED (no credentials in this environment)
**Artifacts:** `scripts/run-business-enrichment-live.js`, `tests/business-enrichment-live-runner.test.js`

---

## 1. Engine interface audit

The runner is engine-direct against the SHIPPED business-half engine
(`src/enrichment-business.js`, H.2). Verified contract:

- `enrichBusinessLeads({ leads = [], index = [], now, runId = '' })` — single
  options object.
- **`index` is a LIST (plain array)**, not a Map. Each entry:
  `gers_id, primary_name, website, phone, city, state_code, country,
  operating_status, confidence`. The engine normalizes and sorts it by
  `gersId` ascending internally.
- `now` is injected; **`runId` is accepted but ignored** by the engine.
- Returns `{ enriched, unmatched, stats }`, arrays sorted by `lead_id`
  ascending (tie by `gers_id`).
- Match priority: **phone** (11-digit leading-1 collapse) → **website**
  (scheme/www/path stripped) → **name+city+state** (exact `0.7` / Levenshtein
  ≤ 2 → `0.4`). Confidence `1.0` / `1.0` / `0.7` / `0.4`.
- Fill-empty-only enrichment; the four `enrichment_business_*` fields are
  stamped on every processed lead (matched + unmatched).
- The engine is never modified and is never given wall-clock or `process.env`.

## 2. Index shape (Overture parquet)

- Source: local Overture Places parquet (`fixtures/overture-austin.parquet`,
  84,445 places, release 2026-08-19.0). Overridable with `--overture=<path>` or
  `OVERTURE_PARQUET_PATH`.
- One DuckDB pass over the projection
  `id, names.primary, confidence, phones, websites,
  addresses[1].region, addresses[1].locality, addresses[1].country,
  operating_status` — **no `categories`**, matching the shipped loader.
- `toIndexRow` maps `id → gers_id` (BigInt → Number), `names.primary →
  primary_name`, `websites[0] → website`, `phones[0] → phone`,
  `addresses[1].locality/region/country → city/state_code/country`.
- The built index is sorted by `gers_id` ascending so identical inputs produce
  identical outcomes (determinism).

## 3. Runner design

- **Default mode is DRY_RUN** (read-only). **There is no
  `--allow-production-writes`.**
- Pipeline: preflight → read → filter → build index → enrich → write →
  report. Stages are recorded individually; overall status is
  `FAIL` if any hard stage fails, else `NOT_CONFIGURED`, else `PASS`.
- Eligibility: `enrichment_business_status` (Y) empty **and** at least one
  match key (phone | website | name+city+state). Exclusions
  `already_enriched` | `no_match_key` | `out_of_scope`; `--limit` (default 5)
  slices the deterministic `lead_id`-ordered scope.
- `now` is resolved once and injected; `matchKeyFor` is a **report-only mirror**
  of the engine's priority (phone → website → name+city+state) used solely to
  classify matched leads for the report.
- Report: `reports/BIZ-ENRICH-LIVE-<run_id>.json`, fully redacted (no tokens,
  keys, or raw business PII beyond `lead_id` + match metadata; sheet id masked
  `6…4`). Exit codes: **0 PASS, 1 FAIL, 3 NOT_CONFIGURED**.

## 4. Write path + positional checks

- Preflight C checks the Verified Leads header **positionally** against all 28
  `VERIFIED_COLUMNS` (A1:AB1). A missing/renamed/swapped column (e.g. AA/AB)
  FAILs and names the exact letter and expected header. The operator fixes the
  sheet; the code never bends.
- The only write primitive is a **single bounded** `values.update` PUT of
  `'Verified Leads'!Y2:AB<lastRow>` with `valueInputOption=USER_ENTERED`.
- Write surface is exactly indices 24–27 = **Y status, Z confidence, AA
  gers_id, AB last_run**. **Never A–X, never Q–U** (formula-owned). Rows in
  scope that matched get stamped; unmatched and non-scope rows — including a
  pre-enriched production row between scoped rows — are preserved **verbatim**.
- EXECUTE is namespace-guarded: only `TEST-ENRICH-LIVE-<tag>-` `lead_id`s are
  ever changed; everything else is reported as would-write and left untouched.
  A non-namespaced namespace refuses to execute (FAIL) with zero transport
  calls.
- `would_write` / `wrote` / `cells_changed` are all **cell counts** (3 matched
  leads → 12 would-write; 2 namespaced → 8 wrote).

## 5. Dry-run preflight

**Live dry-run against the production sheet could not be executed in this
environment: no Google credentials are present, so the runner exits
`NOT_CONFIGURED` (code 3).** This is the honest result and is reported as a
blocker for the live gate, not a pass.

Command run (read-only, no `--execute`):

```
node scripts/run-business-enrichment-live.js --limit=5
```

Result:

```
[report] ...\reports\BIZ-ENRICH-LIVE-1a0b6ae7152-6aadbe11.json
RESULT: NOT_CONFIGURED
stages: preflight=NOT_CONFIGURED
EXIT=3
```

Consequently the expected live figures (preflight PASS, eligible ~57, index
84,445 places, 5 matched with concrete Y/Z/AA samples) **could not be verified
here** and are NOT claimed. To complete the live gate, the operator must export
`GOOGLE_SHEET_ID` plus `GOOGLE_ACCESS_TOKEN` (or `GOOGLE_SERVICE_ACCOUNT_JSON`)
and re-run the command above; it remains read-only until `--execute` is added.

**Offline equivalent (suite-proven, no network/DuckDB):** the mixed fixture
enriches 3 of 5 eligible leads — `${NS}-001` → `phone` → `z=1`,
`aa=gers-1`; `${NS}-002` → `website` → `z=1`, `aa=gers-2`; `${NS}-003` →
`name_exact` → `z=0.7`, `aa=gers-3` — with `would_write=12`, `wrote=0`,
`cells_changed=12`, and **zero transport calls**. This is the same code path
the live run uses, exercised end to end.

## 6. Test delta

- New suite: `tests/business-enrichment-live-runner.test.js` — **49 tests, 14
  suites, all green**.
- Coverage: export surface + canonical constants; `parseArgs`; `readConfig`
  (NOT_CONFIGURED / token / service-account / `OVERTURE_PARQUET_PATH`);
  namespace helpers + `runIdFor`; `toIndexRow`/`buildIndex` (BigInt ids,
  `addresses[1]`, sorted `gers_id`); `classifyLead`/`leadHasMatchKey`;
  `matchKeyFor` (incl. phone-non-match → website fall-through); preflight
  PASS + FAIL cases (missing AB1, AA/AB swap, empty grid, no client, empty
  parquet probe, informational adversarial namespace); dry-run pipeline
  (exclusions, per-lead Y/Z/AA, writes nothing, no transport, `--lead-ids`,
  `--limit`, determinism, redaction); `buildWriteBlock` preserve semantics;
  execute pipeline (single `Y2:AB5` PUT, only Y/Z/AA/AB, production rows
  preserved verbatim, 12 would-write / 8 wrote, production-only → DRY_RUN with
  no PUT, non-`TEST-ENRICH-LIVE` namespace refusal); report redaction +
  `failure_info`; `overallStatusOf`/`exitCodeForStatus`; CLI `--help`, bare
  invocation → exit 3, `main()` delegation; and a source literal scan.
- Runner changes made **during H.9** (all inside the runner, none to the
  engine/schema/workflow):
  1. `runIdFor` now handles both a numeric `Date.now()` and a Date-returning
     clock (previously crashed on the no-clock path).
  2. The PASS path returned `{ redacted, raw }` instead of the redacted report;
     now returns `report.redacted` directly.
  3. `matchKeyFor` mirrors the engine priority exactly (phone-non-match falls
     through to website).
  4. `would_write`/`wrote`/`cells_changed` made consistently cell-counted.

## 7. Gates

| Gate | Command | Result |
| --- | --- | --- |
| Full suite | `npm test` | **1257/1257 pass** (baseline 1208 + 49 new), 0 fail |
| Frozen artifacts | `npm run verify:frozen` | **PASS** — 25/25 SHA-256 match |
| Security | `npm run enrichment:security` | **exit 0**, no credential/violation findings |
| New suite | `node --test tests/business-enrichment-live-runner.test.js` | **49/49 pass** |
| Live dry-run | `node scripts/run-business-enrichment-live.js --limit=5` | **NOT_CONFIGURED (exit 3)** — no credentials in this environment |

## 8. Explicit guardrails (no side effects)

- **No `--execute` was run.** The live Verified Leads sheet was never written.
- **No D2 formula change.** Q–U (and A–X) are never written; the
  formula-owned columns are untouched.
- **No workflow / schema / engine change.** `src/enrichment-business.js`,
  `src/schema.js`, `Approved Outreach Handoff V1.json`, and every frozen
  artifact are unchanged (`verify:frozen` 25/25).
- **No commit** (uncommitted working tree per workspace convention).
- Files changed in H.9: `scripts/run-business-enrichment-live.js` (new),
  `tests/business-enrichment-live-runner.test.js` (new), `package.json`
  (scripts), `.env.example` (documented `OVERTURE_PARQUET_PATH`),
  `docs/ENRICHMENT-LOG.md` (H.9 section), plus the dry-run report.

## 9. H.9.1 readiness checklist

- [x] Engine interface matches the shipped `enrichBusinessLeads` contract.
- [x] Index built as a sorted LIST from the Overture projection.
- [x] Default DRY_RUN; no production-write escape hatch.
- [x] Positional 28-column preflight; write surface pinned to Y/Z/AA/AB.
- [x] Namespace-guarded execute; production rows preserved verbatim.
- [x] 49-test offline suite green; full `npm test` green; frozen + security
  gates green.
- [ ] **Operator:** export `GOOGLE_SHEET_ID` + `GOOGLE_ACCESS_TOKEN` (or
  `GOOGLE_SERVICE_ACCOUNT_JSON`) and run the read-only dry-run to confirm live
  preflight PASS + eligible/matched counts.
- [ ] **Operator:** confirm the live Verified Leads header orientation matches
  `VERIFIED_COLUMNS` before any `--execute`.
- [ ] H.9.1 not started (per scope).

---

*Generated as the H.9 deliverable. No live writes performed.*
