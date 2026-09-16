# n8n-lead-recovery — Comprehensive Repository Report

**Repo:** `n8n-lead-recovery/` (Lead Recovery Engine — nine-workflow n8n pipeline)
**Report date:** 2026-09-16
**Basis:** full-verification session against the repo state at commit `92ae00d` (A.11/R7) plus working-tree changes (helper refactor, offline-harness fixtures, CA report — all green).
**Verification executed this session:** full test suite (`npm test`), `npm run verify:frozen`, `node scripts/security-check.js`, artifact fingerprint recompute, 16-node embedded-code byte-compare, connection-graph dump, and embedded-`Process GPL` vs offline-oracle run over all 5 live fixtures.

---

## 1. What this repository is

A local-first pipeline of **nine n8n workflows** for the Lead Recovery Engine: prospect discovery and validation, approval gating, outreach queue planning, execution delivery, response capture / reconciliation / interpretation. Every workflow ships as:

- a JSON export (n8n artifact) + a written spec doc,
- a deterministic offline engine under `src/`,
- an offline test suite under `tests/`,
- a live runner / harness script under `scripts/` where built,
- a frozen-artifact manifest for the hardened stages.

The whole pipeline runs against **one pinned Google spreadsheet**
(`1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`, "Lead Recovery Engine Prospecting System") whose tabs are the durable data surface. It is not a SaaS; it is a portable artifact + validation stack for n8n Community Edition in Docker (development container: `serene_swartz`, n8n **2.38.7**).

**Zero runtime dependencies** (`package.json`); Node ≥ 18 (verified on v24.19.0). Test runner: `node --test "tests/*.test.js"`.

---

## 2. Repository map

| Path | Purpose |
|---|---|
| `Lead Recovery Engine — Prospect Finder & Validation V1.json` | Stage 1 artifact — 33 nodes, GPL/FSQ/OSM (em-dash filename) |
| `Approved Outreach Handoff V1.json` … `Response Reconciliation V1.json` | Other 8 stage exports |
| `Response-Interpretation V1 — Test Harness.json` | Phase 6.5 webhook→trigger bridge (test-only auxiliary; not a stage) |
| `frozen-artifacts.manifest.json` | Freeze gate: 10 hardened artifacts + SHA-256 (Response Interpretation scope) |
| `*.md` (root) | One spec doc per stage + `REPORT.md` (RSI master close) |
| `src/` | Engines, embedded mirrors, fixture loaders, live runners, contracts, `google-places.js`, `mock-sheets.js`, `google-sheets-client.js`, `schema.js`, `provider.js`, `eligibility.js`, `cleanup.js`, `verify.js` |
| `tests/` | 33 suite files; `tests/helpers/prospect-finder-vm.js` (shared code-node sandbox, new) |
| `scripts/` | Builders (`build-*.js`), live runners (`run-*-live.js`), `security-check.js`, `verify-frozen.js` |
| `fixtures/` | Per-stage fixture JSON + loaders (incl. `gpl-fixtures.json`, `prospect-finder-gpl-live-fixtures.json`, `prospect-finder-fixtures.json`) |
| `docs/` | `PHASES.md`, `CONTAINER-RUNBOOK.md`, `CREDENTIALS.md`, `ARTIFACT-IMPORT.md`, `PHASE-6-ENVIRONMENT-RUNBOOK.md`, `MANIFEST-SNAPSHOT.md` |
| `reports/` | All phase / isolation / hygiene / GPL-workstream reports + indexed `README.md` |
| `.env.example` | Env placeholders only (no secrets) |
| `.github/workflows/` | Offline CI (H-C) |

---

## 3. The nine workflows and their status

| # | Workflow | Status | Evidence |
|---|---|---|---|
| 1 | Prospect Finder & Validation V1 | **HARDENED, prompt-ready** — preflight complete; all gates green (below §6); live validation pending operator decisions + re-import | `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` (R1→R7) |
| 2 | Approved Outreach Handoff V1 | Shipped (artifact + spec + harness); live credential attach pending | `APPROVED-OUTREACH-HANDOFF-v0.1.md` |
| 3 | Run Reconciliation V1 | Shipped (artifact + spec + offline/live suites) | `RUN-RECONCILIATION-AND-REPORTING-v1.md` |
| 4 | Outreach Queue & Planning V1 | Shipped (artifact + spec + offline/live suites) | `OUTREACH-QUEUE-AND-PLANNING-v1.md` |
| 5 | Outreach Execution & Delivery V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-AND-DELIVERY-v1.md` |
| 6 | Execution Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-RECONCILIATION-v1.md` |
| 7 | Response Capture V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-CAPTURE-v1.md` |
| 8 | Response Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-RECONCILIATION-v1.md` |
| 9 | Response Interpretation V1 | **COMPLETE — live-validated A–F, workstream closed** | `REPORT.md`, `docs/PHASES.md`, `reports/PHASE-6-COMPLETION-AMENDMENT.md` |

No workflow is claimed live-validated unless a report on disk says so with evidence.

---

## 4. Architecture principles (as enforced)

- **Single spreadsheet, single source of truth** — every Sheets node pins the production `documentId` (via `__rl` resource locators). Tabs: Search Inputs (gid=0), Raw Leads (gid=101), Verified Leads (gid=102), Approved Outreach, Outreach Log, Response Log.
- **Built-in engines, embedded code** — a deterministic engine under `src/` is byte-mirrored into the workflow's Code nodes; offline suites assert engine↔embedded parity per fixture.
- **Fail-closed honesty** — read-only stages never fabricate a healthy zero; failed reads yield `INCOMPLETE` / `NOT_VERIFIABLE`; live runners print `NOT_CONFIGURED` (exit 3) rather than a fake PASS.
- **No hard-coded secrets** — provider credentials by n8n credential id/name only; the sole env-backed key in shipped artifacts is `GOOGLE_PLACES_API_KEY` (`$env` expression).
- **Builder-deterministic artifacts** — hardened workflows regenerated by `scripts/build-*.js`, never hand-edited; artifact hashes pinned in builder tests and this report.
- **Manifest-guarded freeze** — any drift in the 10 frozen artifacts fails `npm run verify:frozen`.
- **Fail-closed verification** — every PASS traces to a phase/run report on disk.

---

## 5. Gates (measured this session)

| Gate | Command | Result |
|---|---|---|
| Full offline suite | `npm test` | **948/948 pass, 83 suites, exit 0** |
| GPL suites (normalization + workflow) | `node --test tests/gpl-normalization.test.js tests/gpl-workflow.test.js` | 56 pass / 18 suites |
| Prospect Finder suites + GPL (5 files) | `node --test` (gpl ×2, pf-engine, pf-error-paths, pf-builder) | **180 pass / 45 suites** |
| Freeze gate | `npm run verify:frozen` | **10/10 PASS** |
| Secret scan | `node scripts/security-check.js` | **exit 0 — GREEN** (see §8) |

No live execution, no API calls, no sheet writes were performed this session.

---

## 6. Prospect Finder — GPL live-validation preflight (workstream driver)

### Prospect Finder GPL Preflight Report

**Completion state:** ✅ **PASS — PREFLIGHT COMPLETE, PROMPT B READY** (conditioned on the operator decisions in §6.8 and artifact re-import into `serene_swartz`).

### 6.1 Artifact location + fact table

**File:** `Lead Recovery Engine — Prospect Finder & Validation V1.json` (repo root; **em-dash** `—` in name).
**Workflow id:** `WcUgtTPiKXPL0BLH`. **Active:** `false`. **Bytes:** 83,708.
**SHA-256:** `B065A3F6B1E1C3F33E1CE2B969FC7158D0DD2413E3F579B32904C95B2B2582FB` (matches the R7 freeze fingerprint; recomputed this session).
**Trigger:** `Manual Trigger` (single node, no payload).

**Node inventory — 33 nodes, position-ordered:**

| Node | Type | Position | Role |
|---|---|---|---|
| Manual Trigger | manualTrigger | [0,0] | start |
| Initialize Configuration | code | [224,0] | staticData knobs (LOW_COST_MODE, MAX_RESULTS_PER_SEARCH=20, counters) |
| Read Verified Leads | googleSheets | [448,0] | read Verified Leads (gid=102) for dedupe |
| Cache Dedup Keys | code | [672,0] | staticData.verifiedDedupKeys |
| Read Search Inputs | googleSheets | [880,0] | read Search Inputs (gid=0) |
| Filter Pending Searches | code | [1056,0] | keep status Pending/empty; `_noPending` sentinel |
| Has Pending Searches? | if | [1248,0] | spine gate / End |
| Loop Through Searches | splitInBatches | [1440,-16] | 1 search per iteration, loop-back |
| Set Status Running | googleSheets | [1632,0] | update Search Inputs row (match input_id) |
| Build FSQ API Query | code | [1872,-80] | fsq query params + discovery_source |
| Build GPL API Query | code | [1808,-260] | gpl_query/gpl_max_results + discovery_source GOOGLE_PLACES |
| Build OSM API Query | code | [1808,112] | Overpass QL + candidate pool |
| Foursquare Places API | httpRequest | [2048,-80] | places/search (credential ref) |
| Google Places API | httpRequest | [1984,-260] | places:searchText ($env key) |
| OpenStreetMap Overpass API | httpRequest | [1984,112] | overpass interpreter |
| API Success? | if | [2160,96] | OSM 200 gate / error fan-out |
| FSQ Error Envelope | code | [2112,96] | FSQ failure → Merge input 0 |
| GPL Error Envelope | code | [2112,-180] | GPL failure → Merge input 2 |
| OSM Error Envelope | code | [2160,176] | OSM failure → Merge input 1 |
| Process FSQ | code | [2208,-80] | FSQ normalization (HVAC relevance) |
| Process GPL | code | [2160,-260] | GPL normalization |
| Process OSM | code | [2352,80] | OSM normalization |
| Handle API Error | code | [2368,256] | OSM failure path → Update Status Failed |
| **Merge** | merge | [2512,0] | **append, numberOfInputs 3** |
| Filter Empty Envelopes | code | [2624,0] | drop `_noResults`/empty, keep error envelopes + leads |
| Update Status Failed | googleSheets | [2608,256] | update Search Inputs (match input_id) |
| Write Raw Leads | googleSheets | [2736,0] | append Raw Leads (gid=101) |
| Dedup & Prepare Verified | code | [2992,0] | dedupe → verified rows (alwaysOutputData) |
| Has New Verified? | if | [3264,0] | branch to write / completed |
| Prepare Verified Sheet Row | code | [3440,-112] | 18-col row shape |
| Write Verified Leads | googleSheets | [3600,-112] | append Verified Leads (gid=102) |
| Update Status Completed | googleSheets | [3792,80] | set status=Completed (match input_id) |
| End | noOp | [1536,304] | terminal |

**Type counts:** 1 manualTrigger · 16 code · 7 googleSheets · 3 httpRequest · 3 if · 1 splitInBatches · 1 merge · 1 noOp. **Connection sources:** 32.

**Merge wiring (verified edge dump, this session):**
- `Process FSQ` main → Merge **input 0**; `FSQ Error Envelope` → Merge **input 0**
- `Process OSM` main → Merge **input 1**; `OSM Error Envelope` → Merge **input 1**
- `Process GPL` main → Merge **input 2**; `GPL Error Envelope` → Merge **input 2**
- Merge → `Filter Empty Envelopes` → `Write Raw Leads` → `Dedup & Prepare Verified` → `Has New Verified?` → (true) `Prepare Verified Sheet Row` → `Write Verified Leads` → `Update Status Completed` → `Loop Through Searches`; (false) `Update Status Completed` → loop. `Handle API Error` → `Update Status Failed` → loop.
- **Exactly one Merge output edge; zero feedback edges.** Params `{ mode: "append", numberOfInputs: 3 }` (append was chosen over combine/combineAll in A.9/R5 after a live run showed the Cartesian product collapses when any input is empty).

### 6.2 Google Places implementation (verified against node JSON + offline oracle)

| Property | Shipped value |
|---|---|
| Node | `Google Places API` — httpRequest (n8n 2.x v4.5 shape, post-A.8) |
| Method / URL | `POST https://places.googleapis.com/v1/places:searchText` |
| Auth header | `X-Goog-Api-Key: ={{ $env.GOOGLE_PLACES_API_KEY }}` (env-sourced; **no literal key**) |
| Field mask | `X-Goog-FieldMask: places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.types` |
| Body | `={{ JSON.stringify({ textQuery: $json.gpl_query, maxResultCount: $json.gpl_max_results, languageCode: 'en' }) }}` (`sendHeaders`, `contentType: json`, `specifyBody: json`) |
| Success / error | `onError: continueErrorOutput`; main[0] → `Process GPL`, main[1] → `GPL Error Envelope` |
| Query builder | `gpl_query = search_query || \`${niche} in ${city}, ${state}\``; `gpl_max_results = min(target_count*3, 20)` |

**Embedded vs offline oracle (this session, fresh):**
- `src/prospect-finder-embedded-code.js` `Process GPL` executed against every live fixture envelope and compared field-by-field with `src/google-places.js` `normalizeGooglePlacesResponse`: **5/5 fixtures, 0 field diffs, dedupe-key sets identical**, lead counts match (3 / 2 / 0-empty→`_noResults` / 0-error→envelope / 1).
- 16/16 code-node jsCode bodies are **byte-identical** to `CODE_BY_NODE` in `src/prospect-finder-embedded-code.js` (0 mismatches; artifact↔builder parity intact; R7 fingerprint holds).
- Normalized output shape: 17-col lead rows; `lead_id` = deterministic `GP-` + hash(placeId + index); dedupe cascade `website: → phone: → ncs:name|city|state`; runtime fields `raw_captured_at`/`verified_at` excluded from oracle comparison; `gp_place_id` carried in `notes`.

### 6.3 Merge + downstream wiring (verified)

- Merge is **append mode with 3 inputs** — one input per provider, success and error envelopes share the provider's input (post-A.10 semantics). D7 stall and empty-success parity are fixed (R6/R7: `_noResults` sentinels mirror Process GPL in Response FSQ/OSM; `Filter Empty Envelopes` drops them before Write Raw Leads).
- `Dedup & Prepare Verified` reads `Cache Dedup Keys` output, skips existing keys + seen-this-run keys; `alwaysOutputData: true` prevents the all-empty loop stall.
- **Write surfaces:** `Write Raw Leads` appends 18 mapped columns (incl. `raw_captured_at`, `notes`); `Write Verified Leads` appends **16 auto-mapped columns** (`autoMapInputData`) — it omits the formula-owned Q:U columns and does **not** write `dedupe_key`/`notes`/`manual_review_notes` to the sheet (by design: formulas own those).
- Source attribution: Process nodes set `source` (`google_places`/`FOURSQUARE`/`OSM`); builders set `discovery_source` (`GOOGLE_PLACES`/…).
- **Residual functional WARNING (pre-existing, documented A.8, not fixed):** `Update Status Failed` maps **only `input_id`** — it never writes `status = "Failed"`, so a failed OSM search does not actually leave `Pending`/`Running`. Deferred.

### 6.4 Secret scan (whole artifact, string-level — re-run this session)

| Pattern | Hits |
|---|---|
| Google API key (`AIza…`) | 0 |
| Hardcoded bearer token | 0 |
| `GOOGLE_PLACES_API_KEY` literal value | 0 (env expression only) |
| `OAuth ya29…` | 0 |
| Foursquare private key | 0 |
| `Authorization` header | 1 — Foursquare node: `=Bearer {{$credentials.value}}` (**credential reference**, not a literal) |
| `key=…` inline | 0 |

**Verdict: NO hardcoded secrets in the shipped artifact.** No literal challenge-run token, no inlined provider key. The Foursquare credential is referenced by id/name and the GPL key is `$env`-sourced — **no hard STOP triggered.** `scripts/security-check.js` confirms: exit 0.

### 6.5 Env-var surface (names only, `.env.example`)

`GOOGLE_SHEET_ID`, `FIXTURE_SHEET_ID`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON` (one auth path), `RESP_INT_EXEC_BACKEND` (`cli` default | `http` | `harness`), `RESP_INT_EXEC_CONTAINER` (`serene_swartz`), `RESP_INT_EXEC_BROKER_PORT` (≠5679; default 5677), `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WORKFLOW_ID`, `RESP_INT_HARNESS_*` (`_BASE_URL/_WORKFLOW_ID/_WEBHOOK_PATH/_WEBHOOK_MODE`), **`GOOGLE_PLACES_API_KEY`** (present, empty placeholder), `RESP_INT_LIVE_RUN_TOKEN`.

**Constraint:** the workflow does **not** consult `FIXTURE_SHEET_ID` — every Sheets node pins the production spreadsheet. A live run writes production Raw Leads / Verified Leads / Search Inputs (see Q1).

### 6.6 Test fixture requirements — already satisfied (Prompt A deliverables exist on disk)

Deliverables produced in the preflight and verified again this session (no recreation needed):

- **`fixtures/prospect-finder-gpl-live-fixtures.json`** — namespace `TEST-GPL-LIVE`, regex `^TEST-GPL-LIVE-(001|ISO-00[1-4])$`. Contains:
  - `TEST-GPL-LIVE-001` — healthy end-to-end (GPL 200 → 3 leads: `GP-0c58ad3c`, `GP-0c29b7fd`, `GP-10a6495b`)
  - `TEST-GPL-LIVE-ISO-001` — all providers succeed (GPL → 2 leads)
  - `TEST-GPL-LIVE-ISO-002` — GPL empty (200 `{places:[]}` → `_noResults` sentinel)
  - `TEST-GPL-LIVE-ISO-003` — GPL 403 error (missing/revoked key → error envelope, `error_expected`)
  - `TEST-GPL-LIVE-ISO-004` — GPL succeeds, Foursquare fails (GPL → 1 lead)
- **`src/prospect-finder-gpl-live-fixtures.js`** — loader: `loadLiveFixtures`, `validateLiveFixtureId`, `isLiveSearchInput`, `fixtureById`, `searchInputRowFor`, `gplEnvelopeFor`, `gplBodyFor`, `expectedRawLeadsFor` (offline oracle), `getFixturesByOutcome`; `RUNTIME_FIELDS = ['raw_captured_at','verified_at']`.
- **Search Inputs schema (11 cols, pinned by sheets node + row builder):** `input_id, niche, city, state, country, search_query, target_count, status, priority, created_at, notes`.
- **Valid Pending row:** `status: "Pending"` (matches `Filter Pending Searches`), unique `input_id` (used as `matchingColumns` for the three status updaters).
- **Status transition model:** `Pending` → (Set Status Running rewrites the row; it does **not** set a literal "Running") → `Completed` (`Update Status Completed`) **or** `Failed` (`Update Status Failed`, which currently writes no status value — §6.3 warning).
- **Historical dedup inputs:** `Cache Dedup Keys` reads the full `Verified Leads` tab at workflow start into `staticData.verifiedDedupKeys`; `Dedup & Prepare Verified` consumes it — no separate historical-input fixture needed.
- **No seeding performed this session** (Prompt B owns live seeding; Prompt C owns cleanup of the 3 rows left from the earlier isolation attempt).

### 6.7 Execution primitive decision (prompt A.7 → delivered, document-only)

The workflow is **Manual Trigger only and sheet-driven** (it reads Search Inputs itself). The n8n Community-edition public API cannot trigger manual-trigger workflows, so the run primitive is the **CLI backend** (same as Response Interpretation):

```
docker exec serene_swartz n8n execute --id WcUgtTPiKXPL0BLH
```

with `RESP_INT_EXEC_BROKER_PORT` ≠ 5679 (default 5677). Because the workflow reads its own input rows, **no trigger-payload bridge is required** — a Phase 6.5-style harness is only needed to force provider error/empty scenarios (ISO-002/003/004); the healthy path (001 / ISO-001) runs directly. **No `n8n execute` was run this session** (preflight constraint).

### 6.8 Open questions / operator decisions before Prompt B

1. **Q1 — Production-sheet coupling.** All Sheets nodes pin the production spreadsheet; `FIXTURE_SHEET_ID` is ignored. Choice: (a) build a fixture mirror workflow against an isolated sheet, or (b) run on production with `TEST-GPL-LIVE-*` namespaced rows + a post-run cleanup pass (Prompt C).
2. **Q3 — Real vs simulated keys.** Confirm a live `GOOGLE_PLACES_API_KEY` for the true success path and whether ISO-003 uses a revoked key or synthetic envelope injection.
3. **Credentials on container.** Re-import the rebuilt artifact into `serene_swartz` and re-attach the Foursquare `httpHeaderAuth` credential (`912eb72c-…`, name "Foursquare API") and the Google Sheets account credential. (The container still carries the pre-R4/R5 params.)
4. **`Update Status Failed` no-op** — pre-existing WARNING (writes no status value). Decide whether to fold into this workstream or defer.
5. **Sheet residue** — 3 seeded Pending rows remain from the earlier isolation run; Prompt C owns cleanup.

---

## 7. Frozen artifacts & regeneration policy

- `frozen-artifacts.manifest.json` (v3) covers the **Response Interpretation** scope: `src/response-interpretation.js`, workflow contract, embedded mirror, live runner, `Response-Interpretation V1.json`, `response-capture.js`, `response-reconcile.js`, the Test Harness artifact, scenario payloads, harness contract — **10/10 verified.**
- The **Prospect Finder** artifact is **frozen-by-convention** (not in the manifest): regenerated deterministically by `scripts/build-prospect-finder-workflow.js` from `src/prospect-finder-workflow-contract.js` + `src/prospect-finder-embedded-code.js`; edits are spec-first per §12.1b of the preflight report; revision log R1–R7 documented there.
- Do **not** hand-edit artifact JSON; do **not** re-run `scripts/add-gpl-to-workflow.js` (superseded, audit-trail only).

---

## 8. Security posture

- No secrets committed anywhere; `.env.example` is placeholder-only; `docs/CREDENTIALS.md` maps node→credential→env.
- Only env-backed key in shipped artifacts: `GOOGLE_PLACES_API_KEY` (GPL node, `$env` expression).
- Foursquare: n8n credential reference (`httpHeaderAuth`, id `912eb72c-…`), never inlined.
- Security scan (`node scripts/security-check.js`) exits 0; forensics baseline in `reports/HYGIENE-H-A-SECURITY-GIT-BASELINE-REPORT.md`.

---

## 9. Test-suite scope (33 files)

Suites cover every stage: queue, execution (engine/workflow/harness/reconcile), response capture / interpretation / reconciliation (incl. live-runner, phase-6.5, topology, output-slots, error-extraction, fixtures, workflow-build), handoff, reconcile, prospect-finder (engine / error-paths / builder), GPL (normalization / workflow), google-sheets-url, execution-engine harnesses. Current total: **948 tests / 83 suites, 0 failures.**

---

## 10. Git state & working-tree deltas (repo-scoped)

Commits behind the freeze: `18ffb7c` fixtures → `92ae00d` A.11/R7 (build/verify scripts, exports+manifest, docs, hygiene H-A→H-C, A.10/A.11 revisions). Uncommitted in working tree (all green under `npm test`):

- `tests/prospect-finder-error-paths.test.js` — **modified** (refactor: sandbox `runNode`/`artifactNodeCode` extracted to `tests/helpers/prospect-finder-vm.js`).
- `tests/helpers/prospect-finder-vm.js` — untracked (shared code-node VM).
- `fixtures/prospect-finder-fixtures.js` + `fixtures/prospect-finder-fixtures.json` — untracked (Prospect Finder offline-harness fixtures).
- `reports/PROSPECT-FINDER-CA-OFFLINE-HARNESS-REPORT.md` — untracked (CA workstream report, in progress).

Nothing was committed this session (no commit requested). No live executions, no sheet writes, no artifact or manifest modifications.

---

## 11. Session notes for memory

- **Read:** artifact (full JSON, node params + connections), `src/prospect-finder-embedded-code.js`, `src/prospect-finder-gpl-live-fixtures.js`, `src/google-places.js`, `tests/*` listing, `package.json`, `.env.example`, `REPORT.md`, `README.md`, `reports/README.md`, `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` (R1–R7), git status/log/diff.
- **Verified:** artifact SHA-256 `B065A3F6…B2582FB` (83,708 B) matches R7; 16/16 code nodes byte-identical; embedded `Process GPL` ≡ offline oracle on all 5 live fixtures (0 diffs); Merge = append/3-input with per-provider success+error wiring; secret scan clean; 948/948; `verify:frozen` 10/10; security exit 0; test-file refactor is a pure helper extraction.
- **Wrote:** nothing to the repo. This comprehensive report was authored; scratch scripts kept in `%TEMP%\opencode\`.
- **Open:** see §6.8. **Next step:** operator answers Q1/Q3 + re-import + credential attach → Prompt B (controlled live run of 001/ISO-001 healthy path; ISO-002/003/004 require a harness mirror per §6.7).