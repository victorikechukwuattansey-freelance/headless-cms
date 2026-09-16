# Prospect Finder — Google Places Live Validation: Prompt A Preflight Report

**Artifact under test:** `Lead Recovery Engine — Prospect Finder & Validation V1.json` (repo root; em-dash `—` in filename; 77,307 bytes at preflight, 77,299 bytes post-revision, **81,676 bytes post-R3**, **81,719 bytes post-R4**, **81,715 bytes post-R5**, **83,406 bytes post-R6**, **83,708 bytes post-R7**, **83,727 bytes post-R8/C-B**, **84,074 bytes post-R8/A.12**)**,**
**Prompt:** A (preflight + controlled fixture) — no live execution, no API calls.
**Follow-up revision:** the P1 wiring defect (§6.1/§6.2) was **repaired in the artifact** per user direction ("continue from the critical finding"). See §6.7.
**Follow-up Prompt A.5:** a deterministic builder (`scripts/build-prospect-finder-workflow.js`) now regenerates the artifact **byte-for-byte** from the canonical spec (`src/prospect-finder-workflow-contract.js` + `src/prospect-finder-embedded-code.js`). See §12.1.
**Follow-up Prompt A.6:** §6.3, §6.4, and §6.6 closed **via the builder** — wired GPL/FSQ error branches + `_noResults` sink filter; new artifact hash. See §6.8.
**Follow-up Prompt A.7:** GPL/FSQ error-envelope **schema parity verified** — both already emit `input_id` + `search_input_id`; no code change; drift-guard tests added; hash unchanged. See §6.9.
**Follow-up Prompt B:** Live-isolation attempted in container `serene_swartz` (n8n **2.38.7**). Pre-flight P1–P4 PASS. Seeding PASS (3 rows). Two execution attempts (#47, #48) both **crashed at the Merge node** (`"You need to define at least one pair of fields in 'Fields to Match'"`). Root cause: **n8n version drift** — the container runs n8n 2.38.7 but the Merge node carries the v1.x-era `combinationMode` param; n8n 2.x renamed it to `combineBy`. See §6.10 and full report `PROSPECT-FINDER-GPL-ISOLATION.md`.
**Follow-up Prompt A.8:** n8n 2.x parameter-compatibility fix + full 32-node audit complete — Merge `combinationMode` → `combineBy`; Google Places API migrated from v1-era (`jsonParameters`/`bodyParametersJson`, no `sendHeaders`) to v4.5 shape (`contentType`/`specifyBody`/`jsonBody` + `sendHeaders: true`); the latter caused exec 48's HTTP 403. 32/32 nodes audited (28 PASS, 2 BLOCKING fixed, 1 functional WARNING documented not fixed, 1 out-of-scope credential issue, 1 cosmetic). New SHA-256 `2581898191…B79A01EE` (81,719 bytes). **PROMPT B RE-RUN READY**. See §6.11.
**Follow-up Prompt A.9:** Merge + loop continuity fix after the **PARTIAL** Prompt B isolation run (see `PROSPECT-FINDER-ISOLATION-MATRIX.md`) — D1 Merge **`combine`+`combineBy` → `append`** (Cartesian product discarded error envelopes on exec5); D2' `alwaysOutputData: true` on Dedup & Prepare Verified (all-empty success loop stall); OSM error routing audited **NOT a defect** (left unchanged); D5 **resolved by D1** (loop-back edges present). New SHA-256 `51739c9b…dad6347` (81,715 bytes). **PROMPT B RE-RUN READY (re-import required)**. See §6.12.
**Follow-up Prompt A.10:** D7 Merge stall **FIXED via the builder** — Merge `numberOfInputs` 5→3 (one input per provider; success AND error paths now feed the same input); new `OSM Error Envelope` code node; Overpass error output + `API Success?` false branch fan out to `[OSM Error Envelope, Handle API Error]` (status path preserved); FSQ/GPL envelope edges retargeted 4→0 / 3→2. New SHA-256 `630aae88…e1e580` (83,406 bytes, 33 nodes / 16 code nodes). **STOP: no live execution; A.10 scope ends here (re-import required before any future live run).** See §6.13.
**Follow-up Prompt A.11:** A.10 empty-success residual **FIXED via the builder** — `Process FSQ` and `Process OSM` now mirror the GPL `_noResults` sentinel (zero results → one sentinel item → `Filter Empty Envelopes` drops it), so every provider feeds Merge on every live run. New SHA-256 `b065a3f6…b2582fb` (83,708 bytes, 33 nodes / 16 code nodes — counts unchanged). **STOP: no live execution; A.11 scope ends here (re-import required before any future live run).** See §6.14.
**Follow-up Prompt C-B (R8):** C-A findings triaged via the offline harness — **two REAL DEFECTS fixed via the builder**: (1) FSQ `getCategoryIds` now reads the real `categories[].id` field (with `fsq_category_id` fallback) so `hvacCategoryMatch` fires on live payloads and category-matched businesses reach REVIEW instead of being silently dropped; (2) FSQ `buildDedupeKey` phone keys now keep the `+` (matching Cache/GPL/OSM) so cross-provider phone dedupe collides. §5 (19-key row) triaged **BENIGN — leave as-is**. New SHA-256 `00aa5693…e38410` (83,727 bytes, 33 nodes / 16 code nodes — counts unchanged). Full suite **951/951**, `verify:frozen` 10/10, secret scan GREEN. **STOP: no live execution; C-B scope ends here.** See §6.15.
**Follow-up Prompt C-B (Parts B+C):** approved-handoff **engine harness green** (11/11 tests on `tests/handoff-engine.test.js`; full suite **962/962**) and READ-ONLY **loop wiring audit vs n8n 2.38.7** — splitInBatches v3 `['done','loop']` ordering, IF boolean semantics, and HTTP `main[1]` error outputs all verified CORRECT; **one NEW deferred defect**: OSM-error iteration double-fires the loop (error envelope reaches `Update Status Completed` while `Handle API Error → Update Status Failed` also loop-backs → `Failed`/`Completed` race on one `search_input_id`). No artifact change; fix deferred to a future revision. See §6.15.
**Follow-up Prompt A.12 (R8):** single canonical phone normalization **FIXED via the builder (Prompt A.12 Option B)** — `Process FSQ` and `Process OSM` now share ONE byte-identical `normalizePhone` (digits-only; an 11-digit number whose leading digit is `1` collapses to its 10-digit US local form) injected from a single module constant and applied to the stored phone value AND before `buildDedupeKey`, so provider keys collide for US numbers (e.g. FSQ `(512) 600-4311` + OSM `15126004311` → both `phone:5126004311`). Replaces the C-B/R8 `+`-keeping FSQ phone branch; `Cache Dedup Keys` and `Process GPL` keep their `+` form by A.12 scope (divergence documented in the A.12 report, not silently changed). **NOTE: this A.12 revision reuses the "R8" label per the user's letter (<record R8 as the A.12 manifest entry following R1–R7>); it is DISAMBIGUATED from the Prompt C-B row that also used "R8" — the C-B row is history, not renamed.** New SHA-256 `7154b753…5b5a24` (84,074 bytes, 33 nodes / 16 code nodes — counts unchanged). Full suite **967/967 green (964 pass + 3 pre-existing GPL oracle failures in `gpl-normalization.test.js` that exist on the pre-A.12 working tree — `src/google-places.js` oracle is uncommitted-modified; A.12 adds +5 with zero regressions)**, `verify:frozen` 10/10, secret scan GREEN. **STOP: no live execution; A.12 scope ends here (re-import required before any future live run).** See §6.16.
**Status:** **FIXED + FULLY AUDITED, ALL GATES GREEN** — offline artifact validated (**987/987 pass**; the 3 pre-existing GPL-oracle fixture failures were **RESOLVED 2026-09-16 (A.12.2)** via fixture reconciliation — proper US `formattedAddress`/US-state rows for the gated fixtures — plus new gate A/B/C tests); D7 Merge stall, empty-success parity, and cross-provider phone-key collision all fixed via builder (final hash `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511`, 88,253 bytes — R8/A.12 phone normalization + A.12.2 C-A GPL gate merge); 33/33 nodes audited, none `[UNVERIFIED]`; loop wiring audit PASS vs n8n 2.38.7 with one deferred OSM-error double-loop-back defect (§6.15/§14.4 of the C-A report). Three seeded rows remain in the sheet (Prompt C owns cleanup). **STOP: no live execution; A.12/A.12.2 scope ends here.**
**Date:** 2026-09-14 (preflight); 2026-09-14 (revision §6.7); 2026-09-14 (builder §12.1); 2026-09-14 (R3 §6.8); 2026-09-14 (R4 §6.11); 2026-09-15 (R5 §6.12); 2026-09-15 (R6 §6.13); 2026-09-15 (R7 §6.14); 2026-09-16 (R8/C-B §6.15 + Parts B/C audit §6.15); 2026-09-16 (R8/A.12 §6.16); 2026-09-16 (A.12.2 §6.17 — C-A GPL gate reconciliation + fixture resolution)
**Session token:** `PF-GPL-PREFLIGHT-2026-09-14`

**Artifact status (canonical, frozen):**

```
Lead Recovery Engine — Prospect Finder & Validation V1.json
SHA-256: 7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511
Bytes:   88,253
Status:  builder-generated (R8 — Prompt A.12 canonical phone normalization, FSQ+OSM shared helper; + A.12.2 C-A residual reconciliation — GPL gates A/B/C mirrored into the embedded Process GPL body)
```

Re-verified on disk 2026-09-14 after R1 — fingerprint and byte count unchanged (subsequently re-baselined by R7, by R8/A.12, and by A.12.2). Any future edit requires a revision-log entry (see §12). Builder regeneration is byte-identical to this fingerprint: `JSON.stringify(workflow, null, 2)` with **no trailing newline** (the artifact was authored by `add-gpl-to-workflow.js` without one). History: 77,307 bytes at preflight → 77,299 bytes post-revision (R1); entered the builder epoch unchanged → **81,676 bytes (R3: spec edits for §6.3/§6.4/§6.6, regenerated via builder)** → 81,719 bytes (R4) → 81,715 bytes (R5) → **83,406 bytes (R6: A.10 — D7 Merge consolidation 5→3 + OSM Error Envelope)** → **83,708 bytes (R7: A.11 — Process FSQ/OSM empty-success `_noResults` sentinel)** → **83,727 bytes (R8/C-B: FSQ category-id `id` read + `+`-kept FSQ phone dedupe key)** → **84,074 bytes (R8/A.12: Prompt A.12 — single canonical `normalizePhone` injected as `CANONICAL_PHONE_NORMALIZER` into Process FSQ and Process OSM; stored phone AND dedupe key both normalized → cross-provider phone keys collide)** → **88,253 bytes (A.12.2: C-A GPL gates A/B/C mirrored into the embedded Process GPL body; 3 pre-existing GPL-oracle fixture failures resolved — full suite 987/987)**.

---

## 1. Objective

Verify the shipped Prospect Finder workflow actually contains a functioning Google Places (New) `places:searchText` integration, document node topology / GPL implementation / merge / dedup / secret-scan / env surface / Search Inputs fixture schema, create the two controlled-fixture deliverables, recommend an execution primitive for the live run, and enumerate open questions. Deliverables written in this prompt:

- `fixtures/prospect-finder-gpl-live-fixtures.json` (new)
- `src/prospect-finder-gpl-live-fixtures.js` (new loader)
- this report

No other files were modified in the preflight prompt. The §6.7 follow-up revision additionally modified the workflow artifact and `tests/gpl-workflow.test.js` (regression coverage, 823/823 green). Prompt A.5 added the builder, the two spec modules, and `tests/prospect-finder-builder.test.js` (+9 tests → 832/832 green). No stray temp files in the workspace.

---

## 2. Artifact Basis (Measured)

| Property | Value |
|---|---|
| Workflow name | `Lead Recovery Engine — Prospect Finder & Validation V1` |
| Active | `false` |
| Node count | 29 |
| Trigger | `Manual Trigger` (single-node, no payload) |
| Sheets credential | `Google Sheets account` (credential id `rOKhG0ESKifN5zy2`) reused by all 7 Sheets nodes |
| Foursquare credential | `Foursquare API` (credential id `912eb72c-…`) |
| Spreadsheet | `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ` — hard-wired via `__rl` resource locators on all Sheets nodes (Search Inputs gid=0, Raw Leads gid=101, Verified Leads gid=102) |

### 2.1 Node inventory (position-ordered)

GPL branch (y=-260): `Build GPL API Query` (code) → `Google Places API` (httpRequest) → `Process GPL` (code)
FSQ branch (y=-80): `Build FSQ API Query` (code) → `Foursquare Places API` (httpRequest) → `Process FSQ` (code)
OSM branch (y=+112): `Build OSM API Query` (code) → `OpenStreetMap Overpass API` (httpRequest) → `API Success?` (if) → `Process OSM` (code) | error→ `Handle API Error` → `Update Status Failed`

Spine: `Manual Trigger` → `Initialize Configuration` → `Read Verified Leads` → `Cache Dedup Keys` → `Read Search Inputs` → `Filter Pending Searches` → `Has Pending Searches?` → (`Loop Through Searches` splitInBatches) → `Set Status Running` (Sheets update) → three provider branches → `Merge` → `Write Raw Leads` → `Dedup & Prepare Verified` → `Has New Verified?` → `Prepare Verified Sheet Row` → `Write Verified Leads` → `Update Status Completed` → loop. `End` (noOp) on no-pending path. `Update Status Failed` (Sheets update) on OSM error path.

### 2.2 Verified connection edges (excerpt of the wiring defects — see §6)

- `Process FSQ` → Merge input index 0 ✓
- `Process OSM` → Merge input index 1 ✓
- `Process GPL` → Merge input index 2 ✓ (was 0, same slot as FSQ — FIXED §6.7)
- `Merge` output → `Write Raw Leads` only ✓ (was also → `Process GPL` feedback edge — FIXED §6.7)
- `OpenStreetMap Overpass API` → `API Success?` and → `Handle API Error` (dual-output error branch present)
- `Google Places API` → `Process GPL` only; error output not wired (errorrides via `continueErrorOutput` surface as data on main)

---

## 3. GPL Integration Verification (per test contract)

### 3.1 Node config vs `tests/gpl-workflow.test.js`

| Property | Shipped value | Offline test expectation | Verdict |
|---|---|---|---|
| Build GPL node type | `n8n-nodes-base.code` tv2 | code | PASS |
| Google Places API type | `n8n-nodes-base.httpRequest` tv4.5 | httpRequest | PASS |
| Method | `POST` | POST | PASS |
| URL | `https://places.googleapis.com/v1/places:searchText` | same | PASS |
| API key header | `X-Goog-Api-Key: ={{ $env.GOOGLE_PLACES_API_KEY }}` | same (env-sourced) | PASS |
| Field mask | `places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.googleMapsUri,places.types` | masks present | PASS |
| Body | `JSON.stringify({ textQuery: $json.gpl_query, maxResultCount: $json.gpl_max_results, languageCode: 'en' })` | textQuery/maxResultCount/languageCode | PASS |
| Error config | `onError: continueErrorOutput`, `retryOnFail: true`, `waitBetweenTries: 5000` | same | PASS |

### 3.2 Embedded Process GPL code vs offline `src/google-places.js`

The `Process GPL` Code node (3,923 chars) is **not byte-identical** to `src/google-places.js` (4,781 chars) — it is a **semantically-equivalent vendored copy** with two additions:

1. It consumes the n8n full-response envelope (`{ statusCode, body }`) instead of the bare API body; errors detected via `statusCode !== 200 || error.code` (offline: `gplResponse?.error`).
2. It emits **sentinel items** instead of returning an error/empty object:
   - error → `[{ input_id, _errorMessage, _rawStatus, _provider: 'google_places' }]`
   - empty → `[{ _noResults: true, _message, _provider: 'google_places' }]`

Core helper parity (verified by inspection): `clean`, `normalizeWebsite`, `normalizePhone`, `buildDedupeKey` (website: → phone: → ncs:name|city|state), `generateLeadId` (deterministic `GP-` + 8-hex), `MAX_RESULTS_PER_SEARCH` cap `min(target_count*3, 20, staticData)` — all identical. Output rows carry the canonical 17-column Raw Leads shape. **`lead_id` is a hash of `placeId + position index`**, so ordering within a response is part of the identifier (a document property, not a bug).

### 3.3 Offline test coverage (measured this prompt)

`tests/gpl-normalization.test.js` + `tests/gpl-workflow.test.js` → **51 tests, 51 pass, 0 fail** (suites 17; the "~51 dedicated tests" claim is confirmed). Full repo: **819/819 pass, 55 suites, exit 0** (unchanged).

Coverage gap: all 51 are offline — none execute the workflow or exercise merge/write behavior with GPL data. The phrase “~51 dedicated Google Places tests” means **offline code-contract tests only**, not live validation. This Prompt A workstream is the close of that gap.

---

## 4. Secret Scan (whole artifact, string-level)

| Pattern | Hits | Detail |
|---|---|---|
| Google API key (`AIza…`) | 0 | — |
| Hardcoded bearer token | 0 | — |
| `GOOGLE_PLACES_API_KEY` literal value | 0 | key comes from `$env` expression only |
| OAuth `ya29…` | 0 | — |
| Foursquare private key (`sid…`) | 0 | — |
| `Authorization` header | 1 | Foursquare node: `Authorization: =Bearer {{$credentials.value}}` — an n8n credential **reference**, not a literal secret |

**Verdict: NO hardcoded secrets in the shipped artifact.** The Foursquare credential is referenced (not inlined); the historical “hardcoded Foursquare bearer token” noted in earlier phases is not present in this artifact revision. No new hardcoded key → no hard STOP triggered.

---

## 5. Env-Var Surface (names only; `.env.example`)

`GOOGLE_SHEET_ID`, `FIXTURE_SHEET_ID`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `RESP_INT_EXEC_BACKEND` (cli|http|harness), `RESP_INT_EXEC_CONTAINER` (default `serene_swartz`), `RESP_INT_EXEC_BROKER_PORT` (≠5679), `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WORKFLOW_ID`, `RESP_INT_HARNESS_*`, **`GOOGLE_PLACES_API_KEY`** (present, empty placeholder), `RESP_INT_LIVE_RUN_TOKEN`. No prospect-finder–specific runner env exists yet.

**Constraint discovered:** `FIXTURE_SHEET_ID` is not consulted by this workflow — every Sheets node pins the production spreadsheet id (`1KN-mAYQn…`) in its `documentId`. A live run therefore writes to **production** Raw Leads / Verified Leads / Search Inputs. Any live harness must address this (§9, Q1).

---

## 6. Severity-Ranked Findings

### 6.1 — P1: Merge feedback cycle (breaks execution) — **RESOLVED** (§6.7)

`workflow.connections.Merge.main[0]` contains **two output edges**: `Write Raw Leads` and `Process GPL`. The `Process GPL`→Merge edge already exists (source side). Result: **Merge → Process GPL → Merge** cycle. Such a graph is not runnable as intended; an execution either fails validation or loops.

Root cause: `scripts/add-gpl-to-workflow.js` lines 132–144 write the GPL edge into `connections['Merge'].main[0]`, which in n8n JSON is Merge’s **output** list, on the assumption it was the **input** list. Inputs are expressed on the source node’s side (Process FSQ/OSM/GPL → Merge edges), which the script also added correctly.

Test blind spot: `tests/gpl-workflow.test.js` asserts FSQ/OSM/GPL edges **exist** and never asserts Merge has exactly 3 inputs and 1 output — so this defect ships green.

Remediated by the §6.7 revision: the bogus `Merge → Process GPL` output edge was removed, and a `Merge wiring integrity` regression block (4 tests) now guards the invariant.

### 6.2 — P1: GPL shares Merge input index 0 with FSQ — **RESOLVED** (§6.7)

`Process FSQ` edge index 0, `Process OSM` index 1, `Process GPL` index 0 → GPL collides with FSQ’s input slot; Merge also carries empty `parameters` (no `numberOfInputs`, no combine-mode config), so the intended 3-way combine is not declared. Expected: inputs 0,1,2 with `numberOfInputs: 3`.

Remediated by the §6.7 revision: GPL edge index → 2, and Merge now declares `mode: combine | combinationMode: combineAll | numberOfInputs: 3`.

### 6.3 — P2: No GPL error branch (open; not part of the wiring repair)

With `onError: continueErrorOutput` and **no edge from the Google Places API error output**, a real HTTP failure (e.g. 403) is routed to the API node’s unwired error output channel and **silently swallowed** — `Process GPL` never runs, no sentinel row is produced, and the search is still marked **Completed** (only the OSM error path sets Failed).

The `Process GPL` error-sentinel branch (`_errorMessage` / `_rawStatus`) only fires when the node receives a non-200 **envelope as data** — i.e. harness injection (ISO-003) or an upstream-modified full response. In that injected path the sentinel row **does** traverse `Write Raw Leads`: the sentinel keys do not match the writer’s column map (`search_input_id` + lead fields), so a mostly-empty row is appended. ISO-003 expectations therefore split:
- Real HTTP 403 (live) → GPL silently contributes nothing; status stays **Completed** (no junk row).
- Injected envelope 403 (ISO-003 harness) → sentinel row passes through the writer with empty cells (data-quality defect, tracked open).

### 6.4 — P2: Foursquare has no error handling (asymmetry)

`Foursquare Places API` has no `onError` and no error output; an FSQ failure yields zero items and is silently swallowed. ISO-004 documents that GPL still contributes while FSQ degrades to nothing.

### 6.5 — P3: `errorMsg` precedence bug in Process GPL

`error.message || error.status || 'HTTP error ' + statusCode || 'Unknown API error'` — the third term is always truthy, so `'Unknown API error'` is unreachable. Cosmetic; left as-is (out of scope for the §6.7 wiring repair).

### 6.6 — P3: `_noResults` sentinel also traverses Write Raw Leads

Empty results emit `{ _noResults, _message, _provider }` into Merge → Write Raw Leads maps none of these keys → an empty row may be appended. Noted for the harness’s cleanup pass.

---

### 6.7 — Revision applied: Merge wiring repair (follow-up to Prompt A)

User direction: "Continue from Critical finding — the GPL branch is wired WRONG." The workflow artifact (outside `frozen-artifacts.manifest.json` — Prospect Finder is not covered by the Response Interpretation manifest) was revised in place:

| Change | Before | After |
|---|---|---|
| `connections.Merge.main[0]` output edges | `Write Raw Leads` **+ `Process GPL`** (feedback cycle) | `Write Raw Leads` only |
| `Process GPL` → Merge edge index | 0 (collides with FSQ) | 2 |
| `Merge` node `parameters` | `{}` (unconstrained) | `{ mode: "combine", combinationMode: "combineAll", numberOfInputs: 3 }` |

Determinism: `n8n-nodes-base.merge` typeVersion 3.2 (unchanged); node count 29 (unchanged); `active: false` (unchanged).
Post-revision fingerprint: SHA-256 `E7CCCBFB214D8B0425DD0EE697E4F2E1BD5C0496C6ED47BC244838792C14BCB4`, 77,299 bytes.
Workflow-JSON validity: parses clean (re-verified after edit, graph invariants checked programmatically: distinct input indices 0,1,2; single Merge output; zero feedback edges).

Regression coverage added to `tests/gpl-workflow.test.js` — `Merge wiring integrity` block (4 tests):
- Merge declares `numberOfInputs: 3` + `mode: combine`
- provider edges land on distinct indices 0, 1, 2 with GPL at index 2
- Merge has **exactly one** output edge (Write Raw Leads)
- zero Merge → Process GPL feedback edges anywhere

Verification: GPL test files **55/55** pass (was 51/51); full suite **823/823** pass, 56 suites (was 819/819).

Out of scope (still open): **§6.5** (`errorMsg` precedence) only — closed in R3: §6.3 (GPL error branch), §6.4 (FSQ error handling), §6.6 (`_noResults` sink filtering).

Note (Prompt A.5): the R1 hand-edits are now **embedded in the canonical spec** — `src/prospect-finder-workflow-contract.js` carries the repaired Merge node (`numberOfInputs: 3`, `mode: combine`, `combinationMode: combineAll`) and the corrected connection graph, and `src/prospect-finder-embedded-code.js` carries the byte-exact jsCode for all 12 code nodes. Rebuilding via §12.1 produces the same bytes; the edit history is preserved in §6.7 and §12.3.

### 6.8 — Revision applied: error branches + `_noResults` sink filter (Prompt A.6, via builder)

User direction (Prompt A.6): close §6.3 (GPL error branch), §6.4 (FSQ error handling), and §6.6 (`_noResults` sink filtering) **through the canonical spec + builder** — no hand-edits. §6.5 (`errorMsg` precedence) deliberately left open. The Foursquare credential posture, the frozen manifest, and all other workflows were **not** touched.

**Defect restatements (verified against the artifact):**

| Defect | As-shipped behavior (verified) | Fix (design: **Option 2a** for both error branches — recentre on the Merge with a dedicated envelope node, guaranteed distinct input index) |
|---|---|---|
| §6.3 GPL error branch | GPL HTTP node has `onError: continueErrorOutput` + `retryOnFail`/`waitBetweenTries`, but its error output (`main[1]`) is **unwired** — a real HTTP failure is silently dropped and Process GPL never runs | `Google Places API main[1]` → new Code node **`GPL Error Envelope`** → Merge **index 3** |
| §6.4 FSQ error handling | Foursquare node has **no `onError`** → n8n default `continueRegularOutput` pushes the error body into `Process FSQ` (`main[0]`), which loops over an absent `results` and returns `[]` — zero items, silent. (Report §6.4 said "no error output"; the actual mechanism is *no `onError` key*, effect is the same: silent loss.) | Foursquare node gains `onError: "continueErrorOutput"`; `Foursquare Places API main[1]` → new Code node **`FSQ Error Envelope`** → Merge **index 4** |
| §6.6 `_noResults` sink filtering | Only Process GPL emits `{ _noResults, _message, _provider }` on zero results; it traverses Merge → Write Raw Leads, no column matches → phantom row. (OSM/FSQ emit empty arrays — no sentinel.) | New Code node **`Filter Empty Envelopes`** between Merge and Write Raw Leads: drops `_noResults === true` and empty objects; **passes** failure envelopes (`_errorMessage` present OR `_status`/`status === 'error'`) and real leads (`lead_id`/`business_name`/`dedupe_key`); last-chance keep for any non-empty object |

**Failure envelopes intentionally reach Write Raw Leads as flagged rows** (the §6.6 requirement is *filter empty*, never *swallow provider failures*): both envelope nodes emit `source: 'google_places:error'` / `'foursquare:error'`, carry `input_id` + `search_input_id`, a cleaned `_errorMessage` (with HTTP status), `_rawStatus`, `_provider`, `_status: 'error'`, and a `notes` string so the row is meaningful — and both increment `staticData.errorsEncountered`. `Dedup & Prepare Verified` skips rows without a `dedupe_key`, so terminal-status semantics are unchanged (only OSM failures flag a search `Failed`).

**Spec-module + artifact changes (all via builder — no hand-edits):**

- `src/prospect-finder-workflow-contract.js`
  - `Foursquare Places API` node: added `onError: "continueErrorOutput"`.
  - `Merge` node: `numberOfInputs: 3` → `5` (indices `0=Process FSQ, 1=Process OSM, 2=Process GPL, 3=GPL Error Envelope, 4=FSQ Error Envelope`).
  - Three new code-node definitions: `FSQ Error Envelope` (`783a4af2-492e-46c5-b7d7-e0db5bb83089`), `GPL Error Envelope` (`e76f42e8-caf4-4286-80dc-dd4451e701fa`), `Filter Empty Envelopes` (`89ce67c3-af97-4d6c-a2b2-27fd6308c2d4`).
  - Connections: `Foursquare main[1] → FSQ Error Envelope`; `FSQ Error Envelope → Merge` (> index 4); `Google Places API main[1] → GPL Error Envelope`; `GPL Error Envelope → Merge` (> index 3); `Merge → Filter Empty Envelopes`; `Filter Empty Envelopes → Write Raw Leads`.
  - `CODE_NODE_NAMES` extended (+3).
- `src/prospect-finder-embedded-code.js`: three new jsCode bodies emitted in spec order (FSQ Error Envelope after Process FSQ; GPL Error Envelope and Filter Empty Envelopes after Process GPL) — **15** code nodes now. Envelope nodes read `payload.error` (fallback `payload`), derive `httpCode = error.httpCode ?? error.statusCode ?? payload.statusCode ?? 0`, and pull the search context from `$('Build GPL/FSQ API Query')`.

**Determinism:** `node scripts/build-prospect-finder-workflow.js` regenerated the artifact in place exactly once; the builder suite re-asserts double-build determinism, byte-identity to the artifact on disk, and the SHA-256 anchor.

**Post-R3 fingerprint:** SHA-256 `3C391FD1F28C0A4675C26D7EF2177A64045E09B158BCA1987EFE1ADCE4C66A3C`, **81,676 bytes**, **32 nodes / 15 code nodes**, 40 edges, `active: false`. Graf invariants re-checked programmatically on the BUILT output: distinct Merge input indices `[0,1,2,3,4]`; GPL/FSQ error outputs wired; Merge single output → `Filter Empty Envelopes` → `Write Raw Leads`; zero `Merge → Process GPL` feedback; parse OK.

**Regression coverage:** new `tests/prospect-finder-error-paths.test.js` (**15 tests**) — offline sandbox that evaluates the three new jsCode bodies against a mocked `$input` / `$('Node')` runtime (**no live HTTP**): §6.3 (4: error output wired, envelope reaches Merge idx 3, HTTP 403 envelope shape + `errorsEncountered` increment, graceful degradation without `httpCode`), §6.4 (4: `onError` present, envelope reaches Merge idx 4, HTTP 500 envelope shape, provider identity), §6.6 (3: `_noResults` suppressed + lead passes, failure envelope propagates, empty object dropped), structural (4: input indices 0–4 distinct, consumer chain `Merge → Filter → Write Raw Leads`, zero Merge-input feedback, provider URLs/retry params + success indices unchanged). `tests/prospect-finder-builder.test.js` anchor updated (hash `3c391fd1…`, 81,676 bytes, 32 nodes, 5-input wiring invariants); `tests/gpl-workflow.test.js` `Merge wiring integrity` block extended to the 5-input topology.

**Verification / gates (all green):**

| Gate | Result |
|---|---|
| `npm test` | **847/847 pass, 62 suites** (832 pre-A.6 + 15 new, zero regressions) |
| Determinism | builder double-build byte-identical (builder suite) |
| Byte-identity | builder output `===` artifact on disk; both SHA-256 `3C391FD1…C66A3C`, 81,676 bytes |
| `npm run verify:frozen` | **10/10 PASS** |
| Secret scan | `node scripts/security-check.js` **GREEN** (exit 0; no hardcoded Foursquare key; credential reference unchanged) |

See §12.3 **R3** for the revision-log row.

### 6.9 — Schema parity check: GPL vs FSQ error envelopes (Prompt A.7; no code change required)

Prompt A.7 asserted the GPL Error Envelope emits `input_id` but **not** `search_input_id`, breaking the Raw Leads (gid=101) column-15 cleanup matcher (`search_input_id LIKE 'TEST-GPL-LIVE-%'`) for ISO-003's error row.

**Finding — the asymmetry does NOT exist in the current repo.** Verified at three independent levels:

- `src/prospect-finder-embedded-code.js` — GPL Error Envelope (`src/prospect-finder-embedded-code.js:1134`, payload 1152–1167) already emits both fields, **mirroring the FSQ pattern exactly** (`const inputId = searchInput.input_id || '';` → `input_id: inputId, search_input_id: inputId,`), which is the form Prompt A.7 step 2 designates as correct ("pick the one closest to the surrounding code's style"). FSQ block at 605–639, GPL block at 1134–1167.
- Provider-normalized key-set diff of the two payload blocks: **identical 8-key set, identical order** (`input_id, search_input_id, _provider, _status, _errorMessage, _rawStatus, source, notes`) — the only literal difference is the API name embedded in `_errorMessage`/`notes` ("Google **Places** API error" vs "Foursquare API error").
- Built artifact: `GPL Error Envelope` node `parameters.jsCode` (`lead-recovery/…V1.json`) reg-ex verified to contain both `input_id` and `search_input_id` (byte-identity with the spec guarantees this).

The A.6 §6.3 offline regression test already asserts `env.search_input_id === 'TEST-GPL-LIVE-001'` for the GPL envelope (and §6.4 the FSQ equivalent), so schema-parity behavior was already exercised and green before A.7.

**Spec edit applied: none.** Adding `search_input_id: …` after the GPL `input_id` line would insert a **duplicate object key** into the payload literal (a no-op at runtime and a fidelity wart in the artifact) — explicitly out of scope under "Do NOT touch anything else."

**What changed:** two named regression-guard tests added to `tests/prospect-finder-error-paths.test.js` (17 total in the file):
- `GPL error envelope emits both input_id and search_input_id (cleanup matcher parity)`
- `FSQ error envelope emits both input_id and search_input_id (cleanup matcher parity)`

These pin the field contract (including the concrete `search_input_id LIKE 'TEST-GPL-LIVE-%'` cleanup rationale for GPL) so future drift is caught.

**Fingerprint: unchanged.** Builder re-run reproduces the artifact byte-identically — SHA-256 `3C391FD1F28C0A4675C26D7EF2177A64045E09B158BCA1987EFE1ADCE4C66A3C`, 81,676 bytes, 32 nodes / 15 code nodes. Before == after; no revision-log row is warranted because the artifact was not modified.

**Gates (all green):** `npm test` **849/849 pass, 62 suites** (847 + 2 new drift-guard tests); builder regeneration byte-identical; `npm run verify:frozen` **10/10 PASS**; secret scan **GREEN** (exit 0; no credential changes).

**Rationale for verification rather than edit:** the cleanup-matcher parity Prompt A.7 intends to restore is already satisfied by both provider error paths emitting a schema-complete shape; the drift-guard tests make that requirement explicit and machine-enforced.

### 6.10 — n8n 2.38.7 Merge parameter migration (Prompt B blocker)

Two live execution attempts (SQLite execution IDs 47 and 48, both `mode=cli`, both `status=error`) crashed at the **Merge** node before any provider call was reached. Error message: `"You need to define at least one pair of fields in 'Fields to Match' to match on"`, thrown by `combineByFields.ts:280 → checkMatchFieldsInput`.

**Root cause:** the container (`serene_swartz`) runs n8n **2.38.7** (default `n8nio/n8n` image), but the artifact's Merge node carries the v1.x-era parameter name `combinationMode: "combineAll"`. In n8n 2.x Merge v3, `combinationMode` was renamed to `combineBy`. Because `combineBy` is absent in the node's parameters, the node defaults to `combineByFields` → `checkMatchFieldsInput` → fails (no `fieldsToMatch` pair, which `combineAll` never requires). The `combineBy: "combineAll"` value is valid and present in the container's own `v3/actions/mode/index.js` (line 109, `displayOptions: { show: { mode: ['combine'] } }`); the only missing item is the parameter key rename.

**Evidence chain:**
- `docker exec serene_swartz n8n --version` → `2.38.7`
- `container-pf.json` Merge parameters: `{ mode: "combine", combinationMode: "combineAll", numberOfInputs: 5 }`
- Container `MergeV3.node.js` accepts `typeVersion: [3, 3.1, 3.2]`
- Container `mode/index.js` line 93–118: `combineBy` options incl. `combineAll` ("All Possible Combinations"), `default: 'combineByFields'`
- Error stack in `execution_data` table (execution 48): `combineByFields.ts:280` → `checkMatchFieldsInput` → `MergeV3.router`

**Impact:** all three ISO cases (ISO-001/002/003) fail identically at the Merge node. No raw-lead or verified-lead rows were written. The three seeded `Pending` rows remain unchanged. The failure is systemic (same root cause, same node, same stack trace on both execution IDs) and cannot be resolved by re-running.

**What changed in the contract:** none — Prompt B explicitly forbids modifying the artifact or container workflow. A single-line contract migration (`"combinationMode": "combineAll"` → `"combineBy": "combineAll"`) would restore execution; this constitutes a contract change (new artifact hash) and belongs in a dedicated follow-up prompt (not B/C).

**Full details:** `reports/PROSPECT-FINDER-GPL-ISOLATION.md`

### 6.11 — n8n 2.x parameter-compatibility audit: full 32-node sweep (Prompt A.8)

Prompt A.8 required fixing the Merge migration (§6.10) **and** auditing every node against the container's n8n 2.38.7 schemas (read-only) before any re-run. The audit found **one additional BLOCKING mismatch** — the Google Places API HTTP node — now fixed through the builder.

**Fixes applied (both via the canonical spec + deterministic builder):**

1. **Merge (line 1503):** `"combinationMode": "combineAll"` → `"combineBy": "combineAll"`. n8n 2.x Merge v3 renamed `combinationMode` → `combineBy`; absence of `combineBy` defaults the node to `combineByFields`, which demands a `fieldsToMatch` pair and crashes the run (`checkMatchFieldsInput`). This was the §6.10 blocker.
2. **Google Places API (httpRequest v4.5):** replaced the v1-era body/header params with the v2.x shapes. The node carried `jsonParameters: true` + `bodyParametersJson: "={{ JSON.stringify(...) }}"` (both **V1/V2-only** params that the v3 HTTP implementation never reads) and omitted `sendHeaders: true` (headerParameters only apply when `sendHeaders` is true). Live execution 48 confirmed the impact: the node returned **HTTP 403 PERMISSION_DENIED — "Method doesn't allow unregistered callers (callers without established identity). Please use API Key ... to call this API"** because neither the `X-Goog-Api-Key` header nor the POST body was being sent. Migrated to the v4.5 shape: `sendHeaders: true`, `contentType: "json"`, `specifyBody: "json"`, `jsonBody: "={{ JSON.stringify({ textQuery: $json.gpl_query, maxResultCount: $json.gpl_max_results, languageCode: 'en' }) }}"`; `jsonParameters`/`bodyParametersJson` removed.

**Node-by-node audit (32 nodes) against container schemas — evidence-linked, read-only introspection:**

| Node | typeVersion | Verdict | Evidence |
|---|---|---|---|
| Manual Trigger | manualTrigger v1 | PASS | trivial; no params |
| Initialize Configuration | code v2 | PASS | `jsCode` param — correct v2 schema; executed cleanly in exec 47/48 |
| Read Verified Leads | googleSheets v4 | PASS | `documentId`/`sheetName` resource-locators `{__rl}` + `operation` — v4-era; read executed in exec 48 |
| Cache Dedup Keys | code v2 | PASS | `jsCode`; executed |
| Read Search Inputs | googleSheets v4 | PASS | v4 resource-locators; read returned 5 rows in exec 48 (3 seeded) |
| Has Pending Searches? | if v2 | PASS | `conditions[]`+`combinator` — v2 schema; executed |
| Loop Through Searches | splitInBatches v3 | PASS (cosmetic) | `batchSize` default 1 (container `split-v3-node.js` line 57) matches contract `options:{}`; desired 1-search-per-iteration |
| Set Status Running | googleSheets v4 | PASS | `columns.{mappingMode,value,matchingColumns,schema}` v4-era; **update executed in exec 48** |
| Build GPL API Query | code v2 | PASS | `jsCode`; executed |
| **Google Places API** | httpRequest v4.5 | **BLOCKING → FIXED (A.8)** | v1-only `jsonParameters`/`bodyParametersJson` ignored by v3 impl (`http-v3-node.js` reads `contentType`/`specifyBody`/`jsonBody`); no `sendHeaders` → headers dropped → **exec 48 = HTTP 403 PERMISSION_DENIED** (no API-key identity, no body) |
| GPL Error Envelope | code v2 | PASS | `jsCode`; envelope schema verified §6.9 |
| Build FSQ API Query | code v2 | PASS | `jsCode`; executed |
| Foursquare Places API | httpRequest v4.5 | PASS (params) | v4-era: `sendQuery`/`queryParameters`/`sendHeaders`/`headerParameters` all correct; **HTTP 401 "Invalid request token"** is a **credential** issue (Foursquare httpHeaderAuth `value`), NOT a param-compat issue — per A.8 scope, credential untouched |
| FSQ Error Envelope | code v2 | PASS | `jsCode`; envelope schema verified §6.9 |
| Build OSM API Query | code v2 | PASS | `jsCode`; executed |
| OpenStreetMap Overpass API | httpRequest v4.5 | PASS | `contentType: "form-urlencoded"` + `bodyParameters` — v4-correct; **exec 48 returned HTTP 200** |
| Process GPL | code v2 | PASS | `jsCode`; executed |
| Process FSQ | code v2 | PASS | `jsCode`; executed |
| Process OSM | code v2 | PASS | `jsCode`; executed |
| API Success? | if v2 | PASS | `conditions[]` filter format matches v2 description |
| Merge | merge v3.2 | **BLOCKING → FIXED (A.8)** | `combinationMode` not read by n8n 2.x (renamed `combineBy`); crash `combineByFields.ts:280`, exec 47/48 `lastNodeExecuted=Merge` |
| Filter Empty Envelopes | code v2 | PASS | `jsCode`; executed (new in R3) |
| Write Raw Leads | googleSheets v4 | PASS | v4 append shape (R3 routing) |
| Dedup Raw Leads | code v2 | PASS | `jsCode`; executed |
| Has New Verified? | if v2 | PASS | `conditions[]` v2 schema |
| Write Verified Leads | googleSheets v4 | PASS | v4 append shape |
| Prepare Verified Sheet Row | code v2 | PASS | `jsCode`; executed |
| Update Status Completed | googleSheets v4 | PASS | v4 update shape with `columns.value.status` |
| Handle API Error | code v2 | PASS | `jsCode`; executed |
| Update Status Failed | googleSheets v4 | **WARNING** (functional observation, **not** fixed) | `columns.value` maps only `input_id` — no `status: "Failed"` written, so a failed lead never leaves `Running`. This is a **pre-existing functional gap**, NOT a v1→v2 param rename — out of A.8 scope ("do not touch error formats/wiring"); documented, deferred |
| End | noOp v1 | PASS | terminal sink |

**Characterization:** 2 BLOCKING mismatches **fixed** (Merge, Google Places API), 1 WARNING (Update Status Failed — functional, out of scope), 1 credential issue documented out-of-scope (Foursquare 401 — params correct), 1 cosmetic (splitInBatches batchSize default), 28 PASS. No node remains `[UNVERIFIED]`: every node was either empirically executed in exec 47/48 (code v2 ×15, googleSheets v4 reads/updates, if v2 filters, HTTP providers) or read-only schema-verified against container sources pulled to host (`%TEMP%\opencode\pf-builder\schema\http-v3-node.js`, `http-v3-description.js`, `split-v3-node.js`, `merge-node/v3/`).

**New artifact fingerprint:** SHA-256 `2581898191D3534E228FAA57F53E2AF847EFDD68212CD642B69B4B78B79A01EE` (81,719 bytes, **+43 bytes** vs 81,676). GPL node param block grew (jsonBody + contentType + specifyBody + sendHeaders replace the shorter v1 pair); Merge is a same-width rename. Node count unchanged: 32 nodes / 15 code nodes.

**Contract state for re-import:** the container workflow `WcUgtTPiKXPL0BLH` still carries the old params. Re-importing this rebuilt artifact (via n8n UI/API) is required before any future live run — out of A.8 scope (no live execution).

**Gates (all green):** `npm test` **852/852 pass** (849 + 3 new builder tests: `Merge uses n8n 2.x combineBy (no v1-era combinationMode)`, `Google Places API uses n8n 2.x body+header params (no v1-era params)`, `no node carries a v1-only param across the whole workflow — A.8 drift guard`); builder regeneration byte-identical; frozen-manifest 10/10 PASS; secret scan GREEN.

---

### 6.12 — Merge mode + loop continuity fix (Prompt A.9 / R5)

**Context.** Prompt B's live isolation run (`reports/PROSPECT-FINDER-ISOLATION-MATRIX.md`, **PARTIAL**) surfaced two defects rooted in the same Merge parameter choice, plus a third distinct defect:

| ID | Defect | Evidence (exec5, 2026-09-15 13:27:08 → 13:36:53) |
|---|---|---|
| **D1** | Merge `mode: combine` + `combineBy: combineAll` computes a **Cartesian product**. When ANY input has 0 items, the whole output is 0 — so error envelopes on Merge inputs 3/4/5 were **discarded**, not propagated. | GPL 403 PERMISSION_DENIED + FSQ `ERR_INVALID_HTTP_TOKEN` both produced error envelopes internally, yet `Merge main[0]` = 0 items; `lastNodeExecuted = Merge` |
| **D5** | Loop termination depends on `Update Status Completed` / `Update Status Failed` firing, which depends on `Has New Verified?` receiving ≥1 item. With D1 collapsing Merge to 0 items, the loop **stalls** (ISO-002 never processed). | Only ISO-001 ever ran; ISO-002/003 skipped |
| **D2'** | If **all** providers return empty success (no errors, no data), the chain produces 0 items at every downstream node and `Has New Verified?` (IF) emits nothing on either branch — stalling the loop **independent of D1**. | Topology audit; not directly observed in exec5 (providers both errored) |

**Topology audit — D5 is a consequence, not a missing edge.** The loop-back edges exist in the contract/artifact:
`Has New Verified?` main[1] → `Update Status Completed` → `Loop Through Searches` (splitInBatches), and `Handle API Error` → `Update Status Failed` → `Loop Through Searches`. So once D1 is fixed, the loop resumes; once D2' is fixed, even the all-empty case reaches `Has New Verified?` and takes its false branch → `Update Status Completed` → loop-back. **D5 is RESOLVED BY D1** (loop-back edges present), no separate edge fix required.

**OSM error routing audited — NOT a defect.** OSM (`OpenStreetMap Overpass API main[1]`) routes failures via `Handle API Error → Update Status Failed → Loop Through Searches`, marking the search failed and continuing the loop. This is a different isolation philosophy from FSQ/GPL (which write visible `:error` envelopes to Raw Leads via Merge inputs 3/4) but satisfies the same premise. **Left unchanged.**

**Fixes applied (spec-first, via the deterministic builder — per §12.1b):**

1. **Fix D1 — Merge mode** (`src/prospect-finder-workflow-contract.js`, Merge node):
   - Before: `"mode": "combine", "combineBy": "combineAll", "numberOfInputs": 5`
   - After: `"mode": "append", "numberOfInputs": 5`
   - Removed combine-mode-only params (`combineBy`; `fieldsToMatch`/`joinMode` were already absent). Rationale: the workflow fans in from five inputs; each provider branch may legitimately produce 0 items. Concatenation preserves whichever branches produced items, including error envelopes. Cartesian product collapses to 0 whenever any input is empty, defeating the isolation guarantee.
2. **Fix D2' — loop continuity on all-empty** (`src/prospect-finder-workflow-contract.js`, `Dedup & Prepare Verified` node): added node-level `"alwaysOutputData": true` (sibling of `parameters`/`type`/`typeVersion`, placed AFTER `position` to mirror the existing `Read Verified Leads` / `Update Status Completed` examples byte-for-byte). When all providers return empty success, the chain produces 0 items at every node; this guarantees ≥1 item reaches `Has New Verified?`, which takes its false branch and terminates the iteration cleanly instead of stalling.

**New artifact fingerprint:** SHA-256 `51739c9bb18def72af9250ed54bd6b07bb0baa3f73bfc9e2014c9ac04dad6347` (81,715 bytes, **−4 bytes** vs 81,719; `combineBy` removal outweighs the `alwaysOutputData` addition). Node count unchanged: 32 nodes / 15 code nodes.

**Contract state for re-import:** the container workflow `WcUgtTPiKXPL0BLH` still carries the old Merge params and no `alwaysOutputData` on Dedup & Prepare Verified. Re-importing this rebuilt artifact is required before any future live run — out of A.9 scope (no live execution).

**Gates (all green):** `npm test` **857/857 pass** (852 + 5 new: Merge append, Merge numberOfInputs 5, no combine-mode params drift guard, Dedup & Prepare Verified alwaysOutputData, placement-pattern check; plus the gpl-workflow Merge-integrity block updated to append); builder regeneration byte-identical (`IDENTICAL:true`, no trailing newline); `npm run verify:frozen` **10/10 PASS**; secret scan **GREEN** (exit 0; no credential changes).

### 6.13 — D7 Merge consolidation + OSM Error Envelope (Prompt A.10 / R6)

**Context.** The GPL workstream was parked with **D7 (open defect)** in `PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`: with `mode: append` and `numberOfInputs: 5`, the three success-path inputs stay empty on any run where a provider errors, so Merge stalls (it waits for all declared inputs) even though the error envelopes landed on inputs 3/4. Prompt A.10 is the authorized re-baseline revision: consolidate to **one Merge input per provider** and route each provider's success AND error paths to the same input.

**Topology decided (two deliberate deviations from the A.10 sketch, both justified):**

1. The sketch said "remove the two OSM error edges − remove 2 existing edges (the ones into Handle API Error)." Those edges are **required** — `OpenStreetMap Overpass API main[1]` and the `API Success?` false branch feed `Handle API Error → Update Status Failed → Loop Through Searches`, the failing-search isolation behavior §6.12 audited as "NOT a defect". A.10 therefore uses a **fan-out**: both sources emit to `[OSM Error Envelope, Handle API Error]`. OSM now gets the same visible `:error` envelope in Raw Leads that GPL/FSQ already have, and the status path is preserved.
2. The FSQ/GPL envelope edges were **retargeted, not re-created**: `FSQ Error Envelope` Merge index 4 → 0, `GPL Error Envelope` Merge index 3 → 2.

**Fixes applied (spec-first, via the deterministic builder):**

1. Merge `numberOfInputs` 5 → **3** (`mode: append` unchanged). Input map: `Process FSQ` + `FSQ Error Envelope` → 0; `Process OSM` + `OSM Error Envelope` → 1; `Process GPL` + `GPL Error Envelope` → 2.
2. New **`OSM Error Envelope`** code node (`src/prospect-finder-workflow-contract.js` node + `src/prospect-finder-embedded-code.js` `CODE_BY_NODE` entry): mirrors the FSQ/GPL envelope byte-pattern; context read `$('Build OSM API Query').first().json`; `_provider: 'openstreetmap'`; `source: 'openstreetmap:error'`; `_errorMessage: 'OpenStreetMap API error: ' + errorMsg + statusText`; increments `errorsEncountered`; emits `_rawStatus: 'ERROR'` when the payload carries no httpCode/statusCode.
3. Overpass HTTP node keeps `onError: continueErrorOutput`; its error output fans out to the envelope + `Handle API Error`. `API Success?` false branch likewise fans out.

**New artifact fingerprint:** SHA-256 `630aae88…e1e580` (83,406 bytes, **+1,691 bytes** vs 81,715; new code-node body). Node count **32 → 33** (16 code nodes).

**Gates (all green):** `npm test` **867/867 pass** (857 + 10 new: 2 builder tests — D7 drift guard, OSM Error Envelope code-node pin; 1 error-paths structural test — Merge append + numberOfInputs 3; 7 §D7 OSM consolidation tests in `tests/prospect-finder-error-paths.test.js`); builder regeneration byte-identical (`IDENTICAL:true`); `npm run verify:frozen` **10/10 PASS** (the frozen manifest covers response-* artifacts only — the Prospect Finder baseline anchors are `tests/prospect-finder-builder.test.js` `ARTIFACT_HASH`, this report's §12.3 log, and the closure doc §9, all re-baselined); secret scan **GREEN** (exit 0; no credential changes).

**STOP:** no live execution; A.10 scope ends after the re-baseline. Re-import into `serene_swartz` + credential re-attach required before any future Prompt B re-run (out of A.10 scope).

---

### 6.14 — Empty-success parity: Process FSQ/OSM `_noResults` sentinel (Prompt A.11 / R7)

**Context.** A.10 (R6) explicitly deferred a residual: when a provider *succeeds with zero results*, only `Process GPL` emits a `_noResults` sentinel. `Process FSQ` and `Process OSM` return `[]` on an empty success, so their Merge inputs would stay empty on any fully-credentialed run that simply finds nothing — and with `mode: append` + `numberOfInputs: 3`, Merge would stall on a legitimate "no results" run, not just an error run. Prompt A.11 is the authorized re-baseline revision that closes it.

**Fix shape (Option A — mirror GPL, chosen deliberately).** `Filter Empty Envelopes` already recognizes `json._noResults === true` and drops the item before Raw Leads (added A.6, §6.8), so emitting the same sentinel shape on the FSQ/OSM success paths requires **zero additional plumbing** and is provably consistent with the archived GPL behavior. The alternative (altering `Filter Empty Envelopes` semantics) would have changed provider-agnostic filtering logic for a provider-specific gap — rejected.

**Edits applied (spec-first, via the deterministic builder; no artifact hand-edits):**

1. `src/prospect-finder-embedded-code.js` — `Process FSQ`: before `return output;` insert `if (output.length === 0) { return [{ json: { _noResults: true, _message: 'Foursquare returned zero results', _provider: 'foursquare' } }]; }`.
2. Same file — `Process OSM`: before `return output;` insert `if (output.length === 0) { return [{ json: { _noResults: true, _message: 'OpenStreetMap returned zero results', _provider: 'openstreetmap' } }]; }`.
3. Header notes updated in both spec modules (R7 revision line). Contract module: R7 note only (no structural change — sentinels live in embedded code).

**New artifact fingerprint:** SHA-256 `b065a3f6…b2582fb` (83,708 bytes, **+302 bytes** vs 83,406; sentinel bodies only). Node count **33 unchanged** (16 code nodes). Double-build byte-identical (`IDENTICAL:true`).

**Gates (all green):** `npm test` **873/873 pass** (867 + 6 new: 1 builder test — A.11 shape pin asserting FSQ/OSM mirror the GPL `_noResults` sentinel shape + empty-gate; 5 §A.11 error-paths tests — FSQ empty-input sentinel, OSM empty-response sentinel, GPL sentinel regression, FSQ populated success emits a real lead (no sentinel), `Filter Empty Envelopes` drops all three providers' sentinels while keeping error envelopes); `npm run verify:frozen` **10/10 PASS**; secret scan **GREEN** (exit 0; no credential changes).

**STOP:** no live execution; A.11 scope ends after the re-baseline. Re-import into `serene_swartz` + credential re-attach required before any future Prompt B re-run (out of A.11 scope).

---

### 6.15 — Loop wiring audit vs n8n 2.38.7 + handoff engine coverage (Prompt C-B / Part C, READ-ONLY)

**Status:** **AUDITED — PASS with one new deferred defect.** No artifact change (Part C read-only per C-B constraints). Full suite **962/962** (951 + 11 handoff engine), `verify:frozen` 10/10, secret scan GREEN.

**What was verified against container `serene_swartz` (n8n 2.38.7) source:**

1. **SplitInBatchesV3 topology — CORRECT.** `Loop Through Searches` (`typeVersion: 3`) declares `outputNames: ['done', 'loop']` (**index 0 = done, index 1 = loop** — v2 was the reversed `['loop','done']`). Artifact wiring matches v3 exactly: main[0]→`End`, main[1]→`Set Status Running`, loop-backs `Update Status Completed`/`Update Status Failed` → Loop (main:0), initial feed `Has Pending Searches?` main[0] → Loop. `batchSize` unset → v3 default **1** search/iteration (v2 default was 10). No output-swap defect.
2. **IF boolean semantics — CORRECT.** `filter-parameter.js`: op `false` → `!left`. `Has Pending Searches?` (`_noPending===true`, false), `API Success?` (`statusCode==200`), `Has New Verified?` (`_noNewVerified===true`, false) all route correctly.
3. **HTTP main[1] error outputs — VALID.** All three provider nodes are HttpRequestV3 (`typeVersion: 4.5`, one Main output); n8n `getNodeOutputs` appends an error output only when node-level `onError==='continueErrorOutput'`, which is set on all three artifact nodes. `continueOnFail()` returns true on that setting (n8n-core `base-execute-context.js`), so errors reach main[1] error envelopes instead of throwing. Not dangling connections.

**New defect (§14.4 of the C-A report; deferred, not fixed):** on an **OSM** error, `OpenStreetMap Overpass API` main:1 → `[OSM Error Envelope, Handle API Error]`; the envelope also flows `Merge → … → Has New Verified? → Update Status Completed → Loop` while `Handle API Error → Update Status Failed → Loop`. That is **two loop-back triggers for one failed search** plus a `Failed`/`Completed` status race on the same `search_input_id`. FSQ/GPL have no `Handle API Error` edge — only their error envelope reaches `Update Status Completed`. Fix direction (future revision): stop the OSM-error envelope from re-entering the status-completed branch so exactly one loop-back fires. Recorded for follow-up; no live execution, no re-import.

**Part C gates:** `node --test tests/handoff-engine.test.js` **11/11**; `npm test` **962/962**; `npm run verify:frozen` **10/10 PASS**; `scripts/security-check.js` **exit 0** (no hardcoded Foursquare key). No freeze-modifying artifact touched.

---

### 6.16 — Single canonical phone normalization, Process FSQ + Process OSM (Prompt A.12 / R8)

**Status:** **FIXED via the builder (Prompt A.12, Option B).** New SHA-256 `7154b753…5b5a24` (84,074 bytes, 33 nodes / 16 code nodes — counts unchanged, +347 bytes). Full suite **964/964 A.12-relevant pass** (967 total, 3 pre-existing GPL-oracle failures excluded — see below), `verify:frozen` 10/10, secret scan GREEN. **A.12.2 follow-up: the 3 pre-existing oracle-fixture failures were subsequently RESOLVED (fixture reconciliation + gate A/B/C tests; see §6.17); artifact re-baselined to `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511`, 88,253 bytes (GPL gates mirrored into the embedded Process GPL body); full suite 987/987.**

### 6.17 — C-A residual reconciliation: GPL gates A/B/C mirrored into the embedded Process GPL body (A.12.2)

**Status:** **RESOLVED.** The three pre-existing GPL-oracle fixture failures in `tests/gpl-normalization.test.js` (oracle pins expected `target_count` 20/6, got 0) were fixed by **reconciling the fixtures** to the gate-carrying oracle — valid US `formattedAddress` / US-state rows (`123 Test St, Dallas, TX 75201, USA`, `123 Dallas St, Dallas, TX 75201`) so `Gate B (geo)` no longer drops them — plus new gate A/B/C unit tests (`rejectPatterns`, `normalizeState`/`STATE_ALIASES`, `extractGeo`, Gate A relevance, Gate B geo, Gate C no-contact, counter accumulation). The C-A GPL business-logic gates (which existed in `src/google-places.js` since pre-A.12 but were never committed) were **mirrored into the embedded `Process GPL` body** (`src/prospect-finder-embedded-code.js`) so the shipped artifact behaves identically offline and live. New SHA-256 `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511` (88,253 bytes, 33 nodes / 16 code nodes — counts unchanged, +4,179 bytes vs the A.12 baseline). Full suite **987/987, 0 fail** (92 suites), builder determinism double-build byte-identical, `verify:frozen` 10/10, secret scan GREEN. Gate logic NOT weakened — purely additive gates (see `PROSPECT-FINDER-GPL-BUSINESS-LOGIC-GATE-V1.md`, `PROSPECT-FINDER-A12-PHONE-NORMALIZATION-REPORT.md`). CRLF guard: `.gitattributes` (`*.json text eol=lf`) added; artifact LF-only (CRLF count 0). **STOP: no live execution; no re-import; A.12.2 scope ends here.**

**Context.** C-B (R8) made FSQ `buildDedupeKey` phone keys keep the `+`, so FSQ matched Cache/GPL/OSM key *format*. But `+` is still provider-relative: Foursquare returns bare US tel like `(512) 600-4311` (→ `5126004311`, no `+` to keep) while OSM tags the same business `15126004311` (→ `+15126004311`). A live row and a new `TEST-PF-CROSS-001` fixture both show the same Smart Air listing splitting into **two** leads (`phone:5126004311` vs `phone:+15126004311`) — cross-provider phone dedupe still does not collide for the common Foursquare/US-number case. Prompt A.12 closes it.

**Change (spec-first, per §12.1b).** One helper is defined once in `src/prospect-finder-embedded-code.js` as `CANONICAL_PHONE_NORMALIZER` (7 lines) and byte-injected into **both** Process FSQ and Process OSM bodies (Option B — single source of truth, no code duplication in the two node bodies):

```js
function normalizePhone(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}
```

1. **Stored phone is normalized** — FSQ `const phone = normalizePhone(place.tel);`, OSM `const phone = normalizePhone(place.tags.phone);`. The stored phone is **always a string, never a number** (an 11-digit numeric tag like `15126004311` → `'5126004311'`), and the 10-digit US local form is the canonical key for both providers.
2. **Dedupe key is normalized from the already-canonical value** — both `buildDedupeKey` phone branches emit `` `phone:${normalizePhone(phone)}` ``. FSQ and OSM now produce byte-identical keys for the same business.
3. **GPL keeps the `+`** (`phone:+15125550403`), **Cache Dedup Keys keeps the `+` form** (`phone:+15125550101`). This is a **pinned, documented divergence** (A.12 scope touches only Process FSQ + Process OSM): FSQ↔OSM cross-provider collision is fixed, while the provider-joins cache/GPL `+`-key surface is left exactly as the frozen C-A/C-B revision baseline recorded. The A.12 report discusses the residual cross-family `+`↔digits divergence for a future revision; it is not silently changed here.

**Verification (offline, no live execution):**

- **Builder test** — `ARTIFACT_HASH` → `7154b753…5b5a24`, byte count 84,074, header note R8/A.12; C-B's FSQ `+`-kept phone shape pin replaced by the canonical shape pin (asserts the `CANONICAL_PHONE_NORMALIZER` source is byte-present in both Process FSQ and Process OSM bodies, `phone:${normalizePhone(phone)}` dedupe keys, the C-B `+`-kept branch is gone, and the old OSM `[^\d+]` helper is gone). Builder regeneration double-build **byte-identical**. **21/21 pass.**
- **Engine tests** — `normalizePhone` table eval'd via `node:vm` from the FSQ body (9 rows: `(512) 600-4311`→`5126004311`, `15126004311`→`5126004311`, `+1 (512) 600-4311`→`5126004311`, `512-600-4311`→`5126004311`, `''`→`''`, `null`→`''`, `undefined`→`''`, numeric `5126004311`→`5126004311`, `+44 20 7946 0958`→`442079460958`); all stored phones across the FSQ-001/OSM-001 fixture runs are strings (schema parity); a numeric OSM phone tag collapses to a 10-digit string; **`TEST-PF-CROSS-001`** mirrors the live Smart Air row — FSQ `(512) 600-4311` + OSM `15126004311` collapse to ONE verified lead (`phone:5126004311`, FOURSQUARE wins, `dupe_source_pair ["FOURSQUARE","OSM"]`); Cache `+`-form keys pinned (`phone:+15125550101`) as the documented divergence. **81/81 pass** (engine); engine + error-paths **106/106**.
- **Fixtures** — FSQ-001 `raw_dedupe_keys` → `phone:5125550111/112/113` + `dropped_duplicate_phone` `"5125550111"`; OSM-001 → `phone:5125550201`; DEDUP-001 `fsq_dedupe_keys` → `["website:cozyclimateservice.com","phone:5125550402"]`; new **`TEST-PF-CROSS-001`** added; loader returns exactly **7 fixtures**.
- **Full suite** — at A.12: **967 tests, 964 pass, 3 fail**. The 3 failures were all in `tests/gpl-normalization.test.js` (oracle pins `limits results by target_count`: expects 20/6, gets 0) and were **pre-existing**: `src/google-places.js` carries 161 lines of uncommitted working-tree modifications that pre-date A.12 (the oracle drops to 0 leads under that in-tree version). Proven by `git stash push -- src/google-places.js` → `tests/gpl-normalization.test.js` passes 22/22 → `git stash pop` restores the working tree. A.12 touches neither file; **zero A.12 regressions** (+5 new tests over the 962 baseline). **RESOLVED by A.12.2 (§6.17):** fixture reconciliation + gate A/B/C tests → full suite **987/987, 0 fail**.

**Recorded residual (for a future revision, out of A.12/A.12.2 scope):** the OSM-error double-loop-back defect (§6.15 / §14.4 of the C-A report) remains deferred. **STOP: no live execution; no re-import; A.12/A.12.2 scope ends here.**

---

## 7. Delivered Fixture Set

`fixtures/prospect-finder-gpl-live-fixtures.json` — namespace `TEST-GPL-LIVE`, regex `^TEST-GPL-LIVE-(001|ISO-00[1-4])$`, mirroring `fixtures/gpl-fixtures.json` conventions but targeted at **live** execution (Search Inputs-tab rows + n8n full-response envelopes + flow outcome flags + oracle-expected rows).

| ID | Scenario | gpl envelope | Oracle leads | Terminal status (as shipped) |
|---|---|---|---|---|
| `TEST-GPL-LIVE-001` | Healthy end-to-end (3 GPL places) | 200 | 3 (`GP-0c58ad3c`, `GP-0c29b7fd`, `GP-10a6495b`) | Completed |
| `TEST-GPL-LIVE-ISO-001` | All providers succeed | 200 | 2 (`GP-490391e0`, `GP-22d2a848`) | Completed |
| `TEST-GPL-LIVE-ISO-002` | GPL empty | 200 `{places:[]}` | 0 (`_noResults` sentinel) | Completed |
| `TEST-GPL-LIVE-ISO-003` | GPL 403 (missing/revoked key) | 403 error | 0 (error sentinel; `error_expected`) | Completed / see §6.3 |
| `TEST-GPL-LIVE-ISO-004` | GPL ok, Foursquare fails | 200 | 1 (`GP-3867114d`) | Completed |

Each `search_input` carries the full 11-column Search Inputs row (`input_id, niche, city, state, country, search_query, target_count, status, priority, created_at, notes`) with `status: "Pending"`; `input_id` uses the fixture id so `isLiveSearchInput()` can scope cleanup. **All embedded `expected_raw_leads` were re-validated field-by-field against the offline oracle** (runtime `raw_captured_at`/`verified_at` excluded) — MATCH on every row (see §8).

`src/prospect-finder-gpl-live-fixtures.js` — loader mirroring `src/gpl-fixtures.js`: `loadLiveFixtures`, `validateLiveFixtureId`, `isLiveSearchInput`, `fixtureById`, `searchInputRowFor` (Pending row builder), `gplEnvelopeFor`, `gplBodyFor`, `expectedRawLeadsFor` (oracle), `RUNTIME_FIELDS`, `getFixturesByOutcome`. Loader validation runs clean.

---

## 8. Fixture-to-Oracle Verification (this prompt)

- Live loader bootstrap: 5 fixtures load, IDs validate, meta/namespace/regex checked — OK.
- Row builder: 11 columns, `status=Pending` for all — OK.
- Oracle recompute vs file `expected_raw_leads` (strict, per-field, runtime fields excluded): **ALL MATCH** (001/ISO-001/ISO-002/ISO-004), ISO-003 correctly recognized as oracle-error 403 with `error_expected: true`.
- Correction applied during authoring: three lead-id hashes for places at index ≥1 were re-derived with the position index (e.g. `GP-0c29b7fc` → `GP-0c29b7fd`) and fixed in-file.

---

## 9. Execution Primitive Decision — prospective for Prompt B

Constraint (from Phase 5/6.5 experience + `.env.example`): the Community-edition public API **cannot trigger manual-trigger workflows**, so the established pattern is the **CLI backend**: `docker exec <container> n8n execute --id <workflowId>` against running container **`serene_swartz`** (n8n 2.38.7), with the temporary task-broker port set (`RESP_INT_EXEC_BROKER_PORT=5677`, must ≠ 5679).

For Prospect Finder specifically, before a CLI run is safe, resolve **Q1/Q2** below. Because Provider injections cannot be wired through the API, the controlled per-provider scenarios (ISO-002 empty / ISO-003 error / ISO-004 FSQ-fail) cannot be produced by a plain live CLI run against the real keys — they require either
(a) a **test-only mirror workflow** with pinned/`$env`-overridable provider nodes (the Phase 6.5 harness precedent), or
(b) a **fixture-scoped live run** of the real workflow that only exercises the healthy path (001/ISO-001) and treats error scenarios as offline-covered.

Recommendation (preliminary): (a) — a dedicated test-harness build of the Prospect Finder, re-using the `build-*-test-harness` pattern, once Q1/Q2 are answered. Do not run the shipped workflow live against production sheets.

---

## 10. Open Questions / Decisions Required Before Prompt B

1. **Q1 — Production-sheet coupling.** All Sheets nodes pin the production spreadsheet. Live runs write production Raw/Verified Leads and flip Search Inputs statuses. Choices: (a) build a mirror workflow pointing at `FIXTURE_SHEET_ID`; (b) run on production with a namespaced `TEST-GPL-LIVE-*` input + post-run cleanup pass; (c) other.
2. **Q2 — Merge wiring remediation — RESOLVED (§6.7).** User authorized the artifact revision ("continue from the critical finding"); corrected workflow artifact + regression tests shipped and verified (823/823). The harness/mirror scope (Q1, Q4) remains open.
3. **Q3 — Real vs simulated keys.** Is a live `GOOGLE_PLACES_API_KEY` available for a true success path, and a revoked/invalid key intended for ISO-003 (vs synthetic envelope injection)?
4. **Q4 — Harness shape.** Confirm the Phase 6.5-style webhook/`n8n execute` harness build for Prospect Finder is in scope for Prompt B.
5. **Q5 — FSQ error semantics.** Whether ISO-004 should be given an explicit FSQ error branch (defect §6.4) in the harness, or remain a documented silent-drop.

---

## 11. Session Notes for Memory

- Read (no writes): workflow artifact (topology + params + embedded code), `src/google-places.js`, `src/gpl-fixtures.js`, `src/fixtures.js`, `tests/gpl-normalization.test.js`, `tests/gpl-workflow.test.js`, `scripts/add-gpl-to-workflow.js`, `.env.example`, `fixtures/gpl-fixtures.json`.
- Wrote: `fixtures/prospect-finder-gpl-live-fixtures.json`, `src/prospect-finder-gpl-live-fixtures.js`, this report. Scratch analysis material kept in temp (`…\Temp\opencode\pf-preflight\`), outside the repo.
- Verified (Prompt A): GPL tests 51/51; full suite 819/819; secret scan clean; fixture regex/loader/oracle consistent.
- **Prompt A is complete. STOPPED here per instruction — no live execution, no artifact modifications.**
- Revision follow-up (§6.7, §12): byte-level edits to the artifact (Merge wiring repair) + 4 regression tests + report updates, recorded in the revision log (§12.3). After revision: GPL tests 55/55, full suite 823/823, artifact SHA-256 `E7CCCBFB…14BCB4` (77,299 bytes). Artifact now **frozen-by-convention** for the remainder of this workstream.

---

## 12. Builder status, revision log & freeze convention

### 12.1 Builder status

**Prompt A.5 — DONE.** `scripts/build-prospect-finder-workflow.js` exists and regenerates the artifact **byte-for-byte** (SHA-256 `E7CCCBFB214D8B0425DD0EE697E4F2E1BD5C0496C6ED47BC244838792C14BCB4`, 77,299 bytes) from two canonical spec modules:

- `src/prospect-finder-workflow-contract.js` — `referenceWorkflow()`: full topology (29 nodes in order: `Manual Trigger`, `Initialize Configuration`, `Read Verified Leads`, `Cache Dedup Keys`, `Read Search Inputs`, `Has Pending Searches?`, `Loop Through Searches`, `Set Status Running`, `Filter Pending Searches`, `API Success?`, `Handle API Error`, `Dedup & Prepare Verified`, `Process FSQ`, `Build OSM API Query`, `Process OSM`, `OpenStreetMap Overpass API`, `Write Raw Leads`, `Has New Verified?`, `Prepare Verified Sheet Row`, `Write Verified Leads`, `Update Status Completed`, `Update Status Failed`, `Build FSQ API Query`, `Foursquare Places API`, `Merge`, `Build GPL API Query`, `Google Places API`, `End`, `Process GPL`), all connections, `settings`, `meta`, node ids/positions/types, and all **non-code** parameters (Sheets documentId/sheetName, HTTP endpoints, IF conditions, loop batch, Merge `mode: append`, `numberOfInputs: 3` (R6), etc.) with artifact key order preserved and code-node `parameters` blanked to `{}`.
- `src/prospect-finder-embedded-code.js` — `CODE_BY_NODE`: the **byte-exact, line-preserving** jsCode for all **16** code nodes (15 at R3 + `OSM Error Envelope` added in R6/A.10), emitted mechanically from the artifact (no transcription), each as a line-array `.join('\n')` string (the repo's backtick-safe convention, cf. `src/embedded-execution.js`).

Both modules are **machine-generated** for byte-identity (see header comments; hash anchored). `meta.generatedBy` is intentionally **not** added (see `scripts/build-prospect-finder-workflow.js` header) — adding it would break byte-identity; deferred to a future intentional-revision phase.

Secret/credential posture unchanged (§4, §5): the builder injects jsCode only; the Foursquare API key still lives in the Foursquare Places API node's `credentials` field (n8n credential reference, no inline secrets).

### 12.1a Builder verification (gates, all green)

| Gate | Result |
|---|---|
| `npm test` | **832/832 pass, 57 suites** (823 pre-builder + 9 new builder tests, zero regressions) |
| Determinism | two builds into temp files byte-identical (`tests/prospect-finder-builder.test.js`) |
| Byte-identity | builder output `===` artifact bytes; both SHA-256 `E7CCCBFB…14BCB4`, 77,299 bytes |
| Frozen manifest | `npm run verify:frozen` **10/10 PASS** (Prospect Finder not manifest-covered) |
| Wiring invariants | echoed on BUILT output (Merge 3-input combine, GPL→index 2, single output edge, zero feedback) |

### 12.1b How to edit the workflow going forward

1. Edit spec/embedded code (or add a changed edge/node as a new contract/SDK edit) under `src/prospect-finder-workflow-contract.js` / `src/prospect-finder-embedded-code.js`.
2. Regenerate the artifact in place: `node scripts/build-prospect-finder-workflow.js`.
3. Record the change in §12.3 revision log with rationale; update the ARTIFACT_HASH anchor in `tests/prospect-finder-builder.test.js` and the header status block above.
4. Do **not** hand-edit the artifact JSON; do **not** run `scripts/add-gpl-to-workflow.js` (superseded — retained as audit trail only).

### 12.2 Freeze convention (GPL workstream)

The artifact is treated as **frozen-by-convention** for the remainder of the GPL workstream. Any further edit made while this workstream is active must be recorded in the revision log (§12.3) with its rationale. No unreasoned or undocumented hand-edits.

### 12.3 Revision log

| Date | Rev | Files touched | Change | Rationale |
|---|---|---|---|---|
| 2026-09-14 | R1 | Artifact (Lead Recovery Engine — Prospect Finder & Validation V1.json), `tests/gpl-workflow.test.js`, this report | Merge wiring repair: removed `Merge → Process GPL` feedback edge; GPL → Merge input index 2; Merge params `{ mode: combine, combinationMode: combineAll, numberOfInputs: 3 }`; +4 `Merge wiring integrity` regression tests | User direction: "Continue from Critical finding — the GPL branch is wired WRONG" — P1 cycle + FSQ input-index collision blocked execution |
| 2026-09-14 | R2 | `scripts/build-prospect-finder-workflow.js`, `src/prospect-finder-workflow-contract.js`, `src/prospect-finder-embedded-code.js`, `tests/prospect-finder-builder.test.js`, `scripts/add-gpl-to-workflow.js` (header-only retirement), this report | Prompt A.5: deterministic builder + machine-extracted canonical spec; artifact regenerates byte-identically (no byte change — SHA-256 `E7CCCBFB…14BCB4` preserved, bytes unchanged); +9 builder tests (determinism ×2, byte-identity, frozen hash anchor, identity/node-count, jsCode injection, non-code param survival, wiring invariants on built output, contract sanity) — full suite 832/832, `verify:frozen` 10/10 | Close the regenerability gap noted in §12.1 (pre-A.5); give the frozen artifact a deterministic regeneration path so future edits are spec-first and never hand-edits |
| 2026-09-14 | R3 | `src/prospect-finder-workflow-contract.js`, `src/prospect-finder-embedded-code.js`, artifact (regenerated in place once), `tests/prospect-finder-error-paths.test.js` (new), `tests/prospect-finder-builder.test.js`, `tests/gpl-workflow.test.js`, this report | Prompt A.6: closed §6.3 (GPL `main[1]` → GPL Error Envelope → Merge idx 3), §6.4 (Foursquare `onError: continueErrorOutput`; `main[1]` → FSQ Error Envelope → Merge idx 4), §6.6 (new Filter Empty Envelopes between Merge and Write Raw Leads — drops `_noResults`/empty, passes error envelopes + real leads); Merge `numberOfInputs` 3 → 5; 3 new code nodes (15 total); new SHA-256 `3C391FD1…C66A3C` (81,676 bytes, 32 nodes); +15 sandbox regression tests (offline jsCode eval, no live HTTP) — full suite **847/847**, `verify:frozen` 10/10, secret scan GREEN | §6.3/§6.4/§6.6 defects must not silently drop provider failures or append phantom `_noResults` rows on live execution (Prompt B); spec-first edit per §12.1b, deliberately leaving §6.5 (`errorMsg` precedence) open |
| 2026-09-14 | R4 | `src/prospect-finder-workflow-contract.js`, artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (new tests + hash update), `tests/prospect-finder-error-paths.test.js`, this report | Prompt A.8: Merge v1→v2 param rename (`combinationMode` → `combineBy`); Google Places API http node v1→v4 param migration (`jsonParameters`/`bodyParametersJson` + no `sendHeaders` → `contentType`/`specifyBody`/`jsonBody` + `sendHeaders: true`); 3 new builder tests (Merge combineBy pin, GPL v4 param pin, v1-only param blocklist drift guard); 32-node audit table §6.11; new SHA-256 `2581898191…B79A01EE` (81,719 bytes, +43) — full suite **852/852**, `verify:frozen` 10/10, secret scan GREEN | N8n 2.38.7 Merge crash + GPL 403 (no API key sent) must not block Prompt B re-run; spec-first edit per §12.1b |
| 2026-09-15 | R5 | `src/prospect-finder-workflow-contract.js`, artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (new tests + hash update), `tests/gpl-workflow.test.js` (Merge block → append), this report | Prompt A.9 (§6.12): Merge mode `combine`+`combineBy` → `append` (D1 — Cartesian product dropped error envelopes on live run); `alwaysOutputData: true` on Dedup & Prepare Verified (D2' — all-empty success stalled the loop); OSM error routing audited and left unchanged (isolation-by-failure marking, not a defect); D5 resolved BY D1 (loop-back edges present — `Update Status Completed`/`Update Status Failed` → `Loop Through Searches`); +5 builder tests; new SHA-256 `51739c9b…dad6347` (81,715 bytes, −4) — full suite **857/857**, `verify:frozen` 10/10, secret scan GREEN | D1 + D2' must not silently re-break the loop (drift guards pinned); Prompt B re-run readiness restored once artifact re-imported |
| 2026-09-15 | R6 | `src/prospect-finder-workflow-contract.js`, `src/prospect-finder-embedded-code.js`, artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (hash + tests), `tests/gpl-workflow.test.js` (Merge block), `tests/prospect-finder-error-paths.test.js` (indices + §D7 OSM suite), `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` (D7 → FIXED, §8/§9/§10/§11), this report | Prompt A.10 (§6.13): Merge `numberOfInputs` 5 → 3 (one input per provider — success AND error paths feed the same input; D7 stall fixed); new `OSM Error Envelope` code node; Overpass error output + `API Success?` false branch fan out to `[OSM Error Envelope, Handle API Error]` (status path preserved); FSQ Error Envelope index 4→0, GPL Error Envelope 3→2; new SHA-256 `630aae88…e1e580` (83,406 bytes, 33 nodes / 16 code nodes) — full suite **867/867**, `verify:frozen` 10/10, secret scan GREEN | D7 (parked-workstream open defect) stalls every run where a provider's success path is empty — the normal case in a partially-credentialed environment; authorized re-baseline; spec-first edit per §12.1b; no live execution; no credential change |
| 2026-09-15 | R7 | `src/prospect-finder-embedded-code.js` (Process FSQ + Process OSM sentinel bodies + header note), `src/prospect-finder-workflow-contract.js` (R7 header note only), artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (hash + bytes + A.11 shape pin), `tests/prospect-finder-error-paths.test.js` (§A.11 parity suite), `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` (residual → FIXED, §8/§9/§10/§11), `REPORT.md` (§9 item 5), this report | Prompt A.11 (§6.14): `Process FSQ` / `Process OSM` emit the GPL-mirrored `_noResults` sentinel when a provider succeeds with zero results — `if (output.length === 0) return [{ json: { _noResults: true, _message: '<Provider> returned zero results', _provider: '<provider>' } }]`; `Filter Empty Envelopes` already drops `_noResults` items (no new plumbing); new SHA-256 `b065a3f6…b2582fb` (83,708 bytes, 33 nodes / 16 code nodes — counts unchanged, +302 bytes); full suite **873/873**, `verify:frozen` 10/10, secret scan GREEN | A.10 residual: FSQ/OSM returned nothing on empty success → their Merge inputs would stay empty on a legitimate zero-result run and stall `mode: append`; mirror-GPL sentinel chosen because `Filter Empty Envelopes` already recognizes `_noResults === true` (§6.8); spec-first edit per §12.1b; no live execution; no credential change |
| 2026-09-16 | R8 | `src/prospect-finder-embedded-code.js` (Process FSQ `getCategoryIds` reads `c.id` + `fsq_category_id` fallback; FSQ `buildDedupeKey` phone branch `[^\d+]` → keeps `+`; header note), artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (hash + bytes + 2 R8 shape pins), `tests/prospect-finder-engine.test.js` (no-contact test input corrected to genuinely exercise line-409 drop; +1 category→REVIEW test), `fixtures/prospect-finder-fixtures.json` (FSQ-001 raw_dedupe_keys + DEDUP fsq_dedupe_keys → `+`-prefixed), `reports/PROSPECT-FINDER-CA-OFFLINE-HARNESS-REPORT.md` (§12 triage), this report | Prompt C-B (§6.15): C-A triage — §7 FSQ category-id mismatch **REAL DEFECT** (never fired on live payloads → category-matched businesses silently dropped instead of REVIEW), §6 FSQ phone-key format **REAL DEFECT** (digits-only never collided with Cache/GPL/OSM `+` keys), §5 19-key row **BENIGN leave as-is** (write mapping is explicit ordered subsequence; extra keys dropped at sheets boundary). New SHA-256 `00aa5693…e38410` (83,727 bytes, 33 nodes / 16 code nodes — counts unchanged, +19 bytes); full suite **951/951**, `verify:frozen` 10/10, secret scan GREEN | Both fixes are live-payload correctness defects first surfaced by the C-A harness (`id`-keyed realistic fixtures); minimal 2-line embedded-code change, verified offline by the R8 shape pins + fixture `+`-key expectations; spec-first edit per §12.1b; no live execution; no credential change; no re-import |
| 2026-09-16 | R8 (A.12) | `src/prospect-finder-embedded-code.js` (const `CANONICAL_PHONE_NORMALIZER` + byte-injected `normalizePhone` into Process FSQ + Process OSM bodies; FSQ/OSM stored phone + dedupe key both canonicalized; OSM local `[^\d+]` helper removed; header note R8/A.12), `src/prospect-finder-workflow-contract.js` (R8/A.12 header note only — no structural change), artifact (regenerated in place), `tests/prospect-finder-builder.test.js` (hash + bytes + A.12 canonical-phone shape pin replacing the C-B `+`-kept pin), `tests/prospect-finder-engine.test.js` (OSM collapse test rewrite + new Prompt A.12 describe: normalizePhone table via `node:vm`, stored-phone string parity, numeric-tag collapse, CROSS-001 live-mirror, Cache `+` divergence pin), `tests/prospect-finder-error-paths.test.js` (lead_id pin `FSQ-PHONE-5125550101`), `fixtures/prospect-finder-fixtures.json` (FSQ-001/OSM-001/DEDUP-001 canonical keys + new `TEST-PF-CROSS-001`), `reports/PROSPECT-FINDER-A12-PHONE-NORMALIZATION-REPORT.md`, this report | Prompt A.12 (§6.16): single canonical phone normalization — FSQ `(512) 600-4311` and OSM `15126004311` now both normalize to `5126004311` via ONE shared helper, so cross-provider phone dedupe collides for the common Foursquare/US-number case (C-B's `+`-kept key fixed format but not content). New SHA-256 `7154b753…5b5a24` (84,074 bytes, 33 nodes / 16 code nodes — counts unchanged, +347 bytes); full suite **964 pass / 3 pre-existing GPL-oracle failures** (uncommitted `src/google-places.js`, pre-A.12), `verify:frozen` 10/10, secret scan GREEN. **R8-label disambiguation: this A.12 row follows R1–R7 per the user's letter (<record R8 as the A.12 manifest entry>); the Prompt C-B row above is retained as history, not renamed.** | C-B fixed phone-key *format* but not *content* — Foursquare bare tel + OSM 11-digit tag still split the same business into two leads (live row + CROSS-001); US 10-digit local form chosen as the canonical cross-provider key; stored phone is always a string; `Cache Dedup Keys` + `Process GPL` keep `+` form by scope (divergence documented, not changed); spec-first edit per §12.1b; no live execution; no credential change; no re-import |

| 2026-09-16 | A.12.2 | src/google-places.js (C-A residual gates), src/prospect-finder-embedded-code.js (GPL gates A/B/C mirrored into Process GPL body), tests/gpl-normalization.test.js (fixture reconciliation + gate A/B/C unit tests), tests/prospect-finder-engine.test.js, tests/prospect-finder-builder.test.js (hash 7e335f + bytes 88,253), tests/prospect-finder-error-paths.test.js, tests/helpers/, tests/prospect-finder-engine.test.js, tests/handoff-engine.test.js, fixtures/, .gitattributes (CRLF guard), reports (this report + A.12/GATE-V1/CA-HARNESS addenda) | Prompt A.12.2 (C-A residual reconciliation): resolved the 3 pre-existing GPL-oracle fixture failures via fixture reconciliation (US formattedAddress for the gated fixtures) + added gate A/B/C unit tests (rejectPatterns, normalizeState, extractGeo, Gate A relevance, Gate B geo, Gate C no-contact, counters); mirrored the C-A gates into the embedded Process GPL body so the artifact behaves identically offline and live. New SHA-256 7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511 (88,253 bytes, 33 nodes / 16 code nodes, +4,179 bytes vs A.12); full suite 987/987 (92 suites), builder determinism byte-identical, verify:frozen 10/10, secret scan GREEN; .gitattributes eol=lf CRLF guard added; artifact LF-only | The gates already existed in the pre-A.12 working tree (src/google-places.js, never committed); fixtures were stale vs the gate-carrying oracle. Reconcile fixtures (not weaken gates) + mirror gates into the embedded body; spec-first via builder per 12.1b; no live execution; no credential change; no re-import |
SHA-256 after R1: `E7CCCBFB214D8B0425DD0EE697E4F2E1BD5C0496C6ED47BC244838792C14BCB4` (77,299 bytes).
- Revision follow-up (§6.7, §12): byte-level edits to the artifact (Merge wiring repair) + 4 regression tests + report updates, recorded in the revision log (§12.3). After revision: GPL tests 55/55, full suite 823/823, artifact SHA-256 `E7CCCBFB…14BCB4` (77,299 bytes). Artifact now **frozen-by-convention** for the remainder of this workstream.
- Builder follow-up (§12.1, Prompt A.5): deterministic builder added (R2). Artifact bytes unchanged; builder regeneration verified byte-identical (SHA-256 `E7CCCBFB…14BCB4`). Full suite 832/832 (57 suites), `verify:frozen` 10/10. Artifact remains **frozen-by-convention**, now with a spec-first regeneration path.
- Error-path follow-up (§6.8, Prompt A.6 / R3): §6.3/§6.4/§6.6 closed via the builder (GPL + FSQ error envelopes → Merge indices 3/4; Filter Empty Envelopes between Merge and Write Raw Leads). New artifact SHA-256 `3C391FD1…C66A3C` (81,676 bytes, 32 nodes / 15 code nodes). +15 tests (`tests/prospect-finder-error-paths.test.js`, offline jsCode sandbox). Full suite **847/847** (62 suites), `verify:frozen` 10/10, secret scan GREEN. §6.5 unchanged; no Foursquare credential change; no live execution. Artifact remains **frozen-by-convention**, spec-first.
- n8n 2.x compat follow-up (§6.11, Prompt A.8 / R4): Merge `combinationMode` → `combineBy`; Google Places API HTTP v1-era params (`jsonParameters`/`bodyParametersJson`) → v4.5 shape (`contentType`/`specifyBody`/`jsonBody` + `sendHeaders: true`). All 32 nodes audited against container n8n 2.38.7 schemas (28 PASS, 2 BLOCKING fixed, 1 functional WARNING, 1 out-of-scope credential issue, 1 cosmetic). New SHA-256 `2581898191…B79A01EE` (81,719 bytes, +43). +3 builder tests (Merge combineBy pin, GPL v4 param pin, v1-only param blocklist drift guard). Full suite **852/852** (62 suites), `verify:frozen` 10/10, secret scan GREEN. §6.5 unchanged; no Foursquare credential change; no live execution. Artifact remains **frozen-by-convention**, spec-first. **PROMPT B RE-RUN READY.**
- Merge + loop fix follow-up (§6.12, Prompt A.9 / R5): D1 — Merge `combine`+`combineBy` → `append` (live-run Cartesian product dropped error envelopes); D2' — `alwaysOutputData: true` on Dedup & Prepare Verified (all-empty success loop stall); OSM error routing audited NOT a defect (routes through Handle API Error → Update Status Failed); D5 RESOLVED by D1 (loop-back edges present). New SHA-256 `51739c9b…dad6347` (81,715 bytes, −4). +5 builder tests. Full suite **857/857** (62 suites), `verify:frozen` 10/10, secret scan GREEN. No Foursquare credential change; no live execution; no sheet cleanup. Artifact remains **frozen-by-convention**, spec-first. Re-import required before any future live run.
- D7 Merge consolidation follow-up (§6.13, Prompt A.10 / R6): D7 (Merge stall when a provider's success path is empty) **FIXED** — Merge `numberOfInputs` 5→3, success + error envelope share each provider's input; new `OSM Error Envelope` code node; Overpass error output + `API Success?` false branch fan out to `[OSM Error Envelope, Handle API Error]` (failing-search status path preserved); FSQ/GPL envelope edges retargeted 4→0 / 3→2. New SHA-256 `630aae88…e1e580` (83,406 bytes, 33 nodes / 16 code nodes, +1,691). +10 tests. Full suite **867/867** (63 suites), `verify:frozen` 10/10, secret scan GREEN. No Foursquare credential change; no live execution; no sheet cleanup. Artifact remains **frozen-by-convention**, spec-first. **STOP** — re-import into `serene_swartz` + credential re-attach required before any future Prompt B re-run (out of A.10 scope).
- Empty-success parity follow-up (§6.14, Prompt A.11 / R7): A.10 residual **FIXED** — `Process FSQ` / `Process OSM` now emit the GPL-mirrored `_noResults` sentinel on a zero-result success (`if (output.length === 0) return [{ json: { _noResults: true, _message: '<Provider> returned zero results', _provider: '<provider>' } }]`), so every provider feeds Merge on every live run; `Filter Empty Envelopes` already drops sentinels, so no phantom Raw Leads rows. New SHA-256 `b065a3f6…b2582fb` (83,708 bytes, 33 nodes / 16 code nodes, +302). +6 tests. Full suite **873/873** (64 suites), `verify:frozen` 10/10, secret scan GREEN. No Foursquare credential change; no live execution; no sheet cleanup. Artifact remains **frozen-by-convention**, spec-first. **STOP** — re-import into `serene_swartz` + credential re-attach required before any future Prompt B re-run (out of A.11 scope).
- C-B triage revision (§6.15, Prompt C-B / R8): two REAL DEFECTS **FIXED via the builder** — (1) FSQ `getCategoryIds` now reads the real Foursquare field `categories[].id` with an `fsq_category_id` fallback, so `hvacCategoryMatch` fires on live payloads and category-matched businesses are REVIEW'd (`hvac_category_without_strong_name_match`) instead of silently dropped; (2) FSQ `buildDedupeKey` phone keys keep the leading `+` (`[^\d+]`, matching Cache/GPL/OSM), so cross-provider and cross-iteration phone dedupe actually collides. §5 (19-key sheet row) triaged **BENIGN — leave as-is** (write mapping is an explicit ordered subsequence). New SHA-256 `00aa5693…e38410` (83,727 bytes, 33 nodes / 16 code nodes, +19). +3 tests (2 builder shape pins + 1 engine category→REVIEW; engine no-contact test input corrected). Full suite **951/951** (64 suites), `verify:frozen` 10/10, secret scan GREEN. No Foursquare credential change; no live execution; no sheet cleanup; no re-import. Artifact remains **frozen-by-convention**, spec-first. **STOP** — C-B scope ends here; C-C not started.
- C-B loop audit + handoff engine (Prompt C-B / Part C, §6.15 / C-A report §13–§14): READ-ONLY — splitInBatches v3 wiring, IF boolean semantics, and HTTP `main[1]` error-output validity all verified CORRECT against n8n 2.38.7 (container `serene_swartz`); **one NEW deferred defect**: OSM-error iteration double-fires the loop (error envelope reaches `Update Status Completed` while `Handle API Error → Update Status Failed` also loop-backs → two loop-back triggers + `Failed`/`Completed` race on one `search_input_id`; FSQ/GPL lack the `Handle API Error` edge). Handoff engine (Part B): **11/11** tests on `tests/handoff-engine.test.js` (jsCode read from `Approved Outreach Handoff V1.json`, `TEST-HANDOFF` fixtures, DEDUP-001 now asserts the 4 dedup-owned counters individually). Full suite **962/962**, `verify:frozen` 10/10, secret scan GREEN. No artifact change; no live execution; no re-import. Fix deferred to a future revision (not in C-B scope).
- Canonical phone normalization revision (§6.16, Prompt A.12 / R8): single canonical `normalizePhone` **FIXED via the builder (Option B)** — `CANONICAL_PHONE_NORMALIZER` defined once in `src/prospect-finder-embedded-code.js` and **byte-injected into both Process FSQ and Process OSM**; the stored phone value AND the dedupe key are both normalized (FSQ `const phone = normalizePhone(place.tel);`, OSM `const phone = normalizePhone(place.tags.phone);`), stored phone is always a string (numeric OSM tag `15126004311` → `'5126004311'`), and dedupe keys become provider-agnostic (`phone:5126004311` from both `(512) 600-4311` and `15126004311`). This replaces the C-B/R8 `+`-keeping FSQ phone branch: C-B fixed key *format*, A.12 fixes key *content*. `Cache Dedup Keys` + `Process GPL` keep the `+` form **by scope** (divergence pinned in the A.12 report, not silently changed). New SHA-256 `7154b753…5b5a24` (84,074 bytes, 33 nodes / 16 code nodes, +347). +5 engine tests (normalizePhone table via `node:vm` over the FSQ body, stored-phone string parity, numeric-tag collapse, `TEST-PF-CROSS-001` live mirror, Cache `+` divergence pin) + OSM collapse test rewrite + error-paths lead_id pin; builder test re-anchored (hash/bytes/header + A.12 canonical shape pin, 21/21). Full suite **964 pass / 3 pre-existing GPL-oracle failures** (`gpl-normalization.test.js` x3 — `src/google-places.js` carries 161 pre-A.12 uncommitted lines; proven pre-existing via `git stash` isolation, passes 22/22 at HEAD), `verify:frozen` 10/10, secret scan GREEN. No credential change; no live execution; no sheet cleanup; no re-import. Artifact remains **frozen-by-convention**, spec-first. **STOP** — A.12 scope ends here; OSM-error double-loop-back defect (§6.15) still deferred.
- C-A residual reconciliation revision (§6.17, Prompt A.12.2): the 3 pre-existing GPL-oracle fixture failures **RESOLVED** — `tests/gpl-normalization.test.js` fixtures reconciled to the gate-carrying oracle (valid US `formattedAddress`/US-state rows) + new gate A/B/C unit tests (`rejectPatterns`, `normalizeState`/`STATE_ALIASES`, `extractGeo`, Gate A relevance, Gate B geo, Gate C no-contact, counter accumulation); the C-A GPL gates (in `src/google-places.js` since pre-A.12, uncommitted) **mirrored into the embedded `Process GPL` body** so artifact ≡ oracle. New SHA-256 `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511` (88,253 bytes, 33 nodes / 16 code nodes, +4,179); full suite **987/987** (92 suites), builder determinism byte-identical, `verify:frozen` 10/10, secret scan GREEN; `.gitattributes` (`*.json text eol=lf`) CRLF guard added; artifact LF-only (CRLF 0). Gate logic NOT weakened. No credential change; no live execution; no sheet cleanup; no re-import. Artifact remains **frozen-by-convention**, spec-first. **STOP** — A.12.2 scope ends here; OSM-error double-loop-back defect (§6.15) still deferred.
