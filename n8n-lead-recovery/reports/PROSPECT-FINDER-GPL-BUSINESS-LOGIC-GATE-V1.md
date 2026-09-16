# Prospect Finder — Process GPL Business Logic Quality Gate Report (V1)

**Artifact under test:** `Lead Recovery Engine — Prospect Finder & Validation V1.json` (repo root; em-dash `—` in filename; **88,253 bytes**)
**Gate under test:** Process GPL business-logic quality gates — **A (relevance)**, **B (geo)** applied **before** lead creation; **C (no-contact)** applied **after** lead creation.
**Prompt:** offline, controlled-fixture gate verification — no live execution, no API calls, no credential changes, no commits.
**Artifact status:** builder-regenerated, hash pined, **frozen-by-convention** (unchanged).

**Artifact status (canonical, frozen):**

```
Lead Recovery Engine — Prospect Finder & Validation V1.json
SHA-256: 7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511
Bytes:   88,253
Status:  builder-generated (GPL business-logic gates A/B/C — relevance, geo, no-contact)
```

**Status:** **ALL GATES GREEN** — full suite **987/987 pass, 0 fail** (92 suites), `npm run verify:frozen` **10/10 PASS**. The three quality gates (A relevance, B geo, C no-contact) are implemented in **both** the offline oracle (`src/google-places.js`) and the embedded `Process GPL` node body (`src/prospect-finder-embedded-code.js`), with engine↔embedded **output parity verified**. Controlled fixture `TEST-PF-GPL-GATES-001` (9 places → 3 leads) asserts gate counters `relevance=3 / geo=3 / noContact=1`, pinned `GP-` lead ids, and the no-contact `dedupe_key:''` override. **STOP: no live execution; no re-import; this report's scope ends here.**

**Date:** 2026-09-16
**Session token:** `PF-GPL-BUSINESS-LOGIC-GATE-V1-2026-09-16`

---

## 1. Objective

Verify the shipped Prospect Finder workflow's **Process GPL** node enforces the intended business-logic quality gates — filter out irrelevant trades, drop geographically out-of-range businesses, and mark contact-less leads so they are excluded from verified promotion — **before** a lead ever reaches `Dedup & Prepare Verified`. Deliverables:

1. Implement gates A/B/C in the offline oracle `src/google-places.js` (source of truth for GPL lead normalization).
2. Mirror the gates **byte-semantically** into the embedded `Process GPL` node body (`CODE_BY_NODE["Process GPL"]`) so the shipped workflow behaves identically offline and live.
3. Add controlled fixture `TEST-PF-GPL-GATES-001` (9 places, 6 rejected, 3 accepted, gate counters asserted).
4. Add unit + gate regression coverage to `tests/gpl-normalization.test.js` and `tests/prospect-finder-engine.test.js`.
5. Rebuild the artifact via the deterministic builder; re-anchor the builder fingerprint.
6. Prove engine↔embedded parity and run the full suite + frozen verification.
7. Write this report.

No live API calls, no credential changes, no sheet writes, no commits, no re-import.

---

## 2. Gate Design (as implemented)

### 2.1 Gate A — Relevance (applied BEFORE lead creation)

- 17 compiled `rejectPatterns` over `displayName + types.join(' ')`, case-insensitive:
  `credit`, `roofing`, `plumbing`, `flooring`, `painting`, `insulation`, `foundation`, `concrete`, `carpet`, `dryer vents`, `ducts cleaning`, `power cleaning`, `supply`, `wholesale`, `hardware`, `rental`, `construction supply`.
- Rejected businesses never become leads. Rejection count accumulates on `staticData.gplRelevanceRejected` (identical key name in the embedded mirror so `Raw Leads` counter parity holds).
- The name field is the signaling trade text in Google Places (e.g. `Dallas HVAC Tool Rental` → `rental`, `Texan Air & Heating Wholesale` → `wholesale`, `Dallas HVAC Supply Co` → `supply`).

### 2.2 Gate B — Geo (applied BEFORE lead creation)

- Evidence is **only** `formattedAddress` — the field mask is intentionally NOT expanded.
- `extractGeo(address)` scans comma-separated segments for a segment matching `/^([A-Za-z][\w.' ]*?)\s+\d{5}(?:[-\s]\d{4})?$/` (state + ZIP). The state token is pulled from the last token of group 1 and normalized via `normalizeState` (50-state + DC full-name→abbr map with a 2-letter code whitelist regex). City is derived from remaining state-segment tokens or, if none, the preceding segment. Segments with an **unrecognized ZIP-less / non-US shape are skipped** and scanning continues; a segment whose state token is not a recognized US state is also skipped.
- Accept if targeting `city or state` matches AND the other is **not contradicted**; reject on contradiction; **fail closed** when `!geo || !geo.state`.
- Rejection count accumulates on `staticData.gplGeoRejected`.

### 2.3 Gate C — No-contact (applied AFTER lead creation)

- After the lead is built: if `!lead.phone && !lead.website` then `lead.dedupe_key = ''`, `lead.notes += '; no_contact=true'`, and `staticData.gplNoContact++`.
- This is a **post-build mutation of existing keys only** — the canonical `RAW_LEAD_SCHEMA` key order is preserved (verified by the key-order regression test).
- `Dedup & Prepare Verified` already skips rows without a `dedupe_key` (`if (!key) continue`), so a no-contact lead stays in Raw Leads (visible, auditable) but is never promoted to Verified.

### 2.4 Loop order (engine + embedded mirror — identical)

```
for each place (i):
  displayName empty            → skip (not a lead, not counted)
  gate A: relevance mismatch   → gplRelevanceRejected++, continue
  gate B: geo reject/failclose → gplGeoRejected++, continue
  build lead (lead_id = hash(placeId + ORIGINAL index i))
  gate C: no phone && no site  → dedupe_key='', notes+='; no_contact=true', gplNoContact++
  push lead
```

`lead_id` uses the **original** place index `i` (not a post-filter counter), so pre-existing `GP-` hashes across healthy fixtures are stable.

### 2.5 Error/empty sentinel divergence (parameterized, intentional)

- **Engine oracle** returns `{ leads, error }` — it does NOT emit an all-rejected sentinel.
- **Embedded mirror** has TWO sentinel branches: a distinct all-rejected sentinel `if (leads.length === 0 && (relevanceRejected > 0 || geoRejected > 0))` (emits `_gplRelevanceRejected` / `_gplGeoRejected` counters) and the pre-existing plain zero-results sentinel `if (leads.length === 0) {`. The builder test pins the second branch's exact text (`if \(leads\.length === 0\) \{`) so the sentinel contract cannot drift.

---

## 3. Engine Changes (`src/google-places.js`)

| Symbol | Role |
|---|---|
| `rejectPatterns` | exported compiled `RegExp[]` (17 patterns, `i` flag, `.source` pinned by unit tests) |
| `STATE_ALIASES` | full-name → 2-letter map (50 states + DC) |
| `STATE_CODE_REGEX` | 2-letter US state-code whitelist |
| `normalizeState` | exported; string → lowercased 2-letter code or `''` |
| `extractGeo` | exported; `formattedAddress` → `{city, state}` or `null` (fail-closed on no evidence) |
| `normalizeGooglePlacesResponse` | gated loop (A → B → build → C), counts onto `staticData` |

New exports verified live via a temp harness: `rejectPatterns`, `normalizeState`, `extractGeo`, `MAX_RESULTS_PER_SEARCH` — all present and callable.

---

## 4. Embedded Mirror (`src/prospect-finder-embedded-code.js` — `CODE_BY_NODE["Process GPL"]`)

The embedded body was updated in three edits, all **spec-first** then re-emitted through the deterministic builder:

1. Gate-A helper insert (compiled `rejectPatterns` array, same 17 patterns).
2. `normalizeState` + `extractGeo` insert (byte-semantic copy of the engine helpers).
3. Loop replacement: single pass with relevance → geo → build → no-contact, counter accumulation via `staticData`, plus the two sentinel branches (2.5).

**Parity proof (engine↔embedded):** a temp script fed the same 9-place gated payload through (a) the oracle and (b) the embedded body evaluated via `node:vm`. Result: identical 3 leads, identical `GP-` ids, identical `dedupe_key` set (`website:northdallashvac.example.com`, `''`, `phone:+12145550200`), identical `RAW_LEAD_SCHEMA` key order, identical gate counters `3/3/1`. (The engine's `normalizePhone` and the embedded `+`-keeping phone branch are pre-existing, separately-pinned surface.)

---

## 5. Controlled Fixture — `TEST-PF-GPL-GATES-001`

- **Places:** 9 (`fixtures/prospect-finder-fixtures.json`), covering: relevance rejects (`Dallas HVAC Supply Co`, `Texan Air & Heating Wholesale`, `Dallas HVAC Tool Rental`), geo rejects (`Plano Climate Masters`, `Dallas Comfort Experts` — missing address, `Cowboy Air Co` — Dallas **GA**), accepted (`North Dallas Air & Heating`, `Suburban Air Balance` — no contact info, `Bella Mesa Heating & Air`), plus `Smart Air TX` (relevance reject via `supply`).
- **Expected:** `raw_lead_count: 3`, `raw_lead_ids: ["GP-54032cc6", "GP-54034714", "GP-54034ad6"]`, `raw_dedupe_keys: ["website:northdallashvac.example.com", "", "phone:+12145550200"]`, `rejected_business_names` (6), and the gate block:

```json
"gates": {
  "gplRelevanceRejected": 3,
  "gplGeoRejected": 3,
  "gplNoContact": 1
},
"no_contact_lead": {
  "index": 1,
  "dedupe_key": "",
  "note_substring": "no_contact=true"
}
```

- Fixture-ID regex widened to `/^TEST-PF-[A-Z]+(?:-[A-Z]+)*-\d+$/` in **both** the loader (`fixtures/prospect-finder-fixtures.js`) and `_meta.regex` so `TEST-PF-GPL-GATES-001` validates.
- Loader returns exactly **8** fixtures (5 prior + `TEST-PF-GPL-GATES-001` among the GPL family, `CROSS-001`, etc.).

---

## 6. Test Coverage Added

### 6.1 `tests/gpl-normalization.test.js` (now 37 tests, 37 pass)

- **Helper units:** `rejectPatterns` length + spot-patterns (`supply`, `wholesale`, `rental`, `credit`); `normalizeState` table (full names, 2-letter codes, lowercase, junk → `''`); `extractGeo` (state+ZIP w/ `city`, `GA 30132`, `Unit 75201` skip, no-US-state → `null`, `''`/`undefined` → `null`).
- **Gate tests:**
  - Gate A: supply/plumber/roofing rows rejected, healthy `North Dallas Air & Heating` accepted; `gplRelevanceRejected=1`, others `0`.
  - Gate B: Geo-mismatch + fail-closed cases; Bella Mesa accepted; `gplGeoRejected=3`, `gplRelevanceRejected=0`. **Note:** this test needed `target_count: 10` on its local search input — with the module-level `target_count: 1`, `maxResults = min(3, 20, 20) = 3` truncated the 4-place payload before the accepted row (index 3). This was a **test-data defect, not an engine defect**; fixed by widening the cap in the test.
  - Gate C: no-contact place → 1 lead, `dedupe_key === ''`, `notes` contains `no_contact=true`, `gplNoContact=1`.
  - Accumulation: staticData counters carry across calls; `rejectPatterns` preserved on `null`/`undefined` staticData guard.
- `staticData` counters are asserted against `0` (not `undefined`) — the engine always writes the counter keys.

### 6.2 `tests/prospect-finder-engine.test.js`

- Cap-test addresses re-pointed to safe Austin TX rows (previous cells carried no `+1` phone — asserted to be irrelevant, but the new values are unambiguous).
- `fixtureStore` length assertion 7 → **8**, key list includes `TEST-PF-GPL-GATES-001`.
- New tests: gate-fixture smart-assert (3 leads, gate counters, no-contact), all-rejected **distinct** sentinel (embedded mirror), engine↔embedded parity with a 9-place gated payload.
- Upload-prep sanity: lead col-17 `source` and no-contact keys covered by the fixture expected rows.

### 6.3 Builder re-anchor

- `ARTIFACT_HASH = '7e335f38b50d1742fbacf502f8b73458f0bdea13c12b9df884df5f097e407511'`, byte length **88,253** (was pre-gate `7154b753…5b5a24`, 84,074 bytes → gates added ~4,179 bytes of embedded code).

---

## 7. Verification Gates (all green this prompt)

| Gate | Result |
|---|---|
| `node --test tests/gpl-normalization.test.js` | **37/37 pass, 0 fail** (11 suites) |
| `npm test` (full suite) | **987/987 pass, 0 fail** (92 suites) — includes gpl-normalization, engine, error-paths, builder, handoff-engine |
| `node --test tests/prospect-finder-engine.test.js` + builder + error-paths + handoff-engine | **148/148 pass** (33 suites) |
| `npm run verify:frozen` | **10/10 PASS** |
| Builder determinism | double-build byte-identical (`IDENTICAL:true`); bytes equal 88,253 |
| Engine↔embedded parity | identical leads / `GP-` ids / dedupe keys / key order / gate counters |
| Secret scan / credential posture | unchanged — no credentials touched, no inline secrets introduced |

---

## 8. Residual Risks & Documented Divergences

1. **Phone-key `+` divergence (pre-existing, unchanged, still pinned):** `Process GPL` and `Cache Dedup Keys` keep the `+`-form phone dedupe key (`phone:+12145550200`, `phone:+15125550101`) while Process FSQ/OSM use the canonical digit form (A.12). GPL gate fixture pins `phone:+12145550200` for Bella Mesa. Not part of this gate scope.
2. **OSM-error double-loop-back defect (§6.15 of the preflight report):** still deferred — an OSM error fires both `Update Status Completed` and `Update Status Failed` loop-backs on one `search_input_id`. Unrelated to GPL gates; recorded for a future revision.
3. **Gate B evidence = formattedAddress only.** Some legitimate Google Places responses carry an empty `formattedAddress`; such rows **fail closed** by design (cannot prove geography) and count as geo-rejected. This is the intended conservative behavior, not a bug.
4. **Empty displayName rows are skipped silently** (not counted on any gate counter) — pre-existing behavior, unchanged.
5. **No live execution in this prompt.** Gate behavior is validated offline via the oracle + the embedded-body `vm` harness + fixtures; a live run requires re-import + credentials (out of scope, STOP).

---

## 9. Session Notes for Memory

- Wrote (no other files modified): gate logic in `src/google-places.js`; mirrored logic in `src/prospect-finder-embedded-code.js`; fixture `TEST-PF-GPL-GATES-001` + loader regex in `fixtures/prospect-finder-fixtures.js` / `.json`; gate + helper tests in `tests/gpl-normalization.test.js` and `tests/prospect-finder-engine.test.js`; builder anchor + shape pins in `tests/prospect-finder-builder.test.js`; artifact regenerated via builder (no hand-edits); this report.
- Fixed during the prompt: gate-B test data defect (module-level `target_count: 1` truncated the 4-place payload to 3 → accepted row unreachable). Resolved by a wider local `target_count`.
- Artifact fingerprint after this prompt: SHA-256 `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511`, 88,253 bytes, 33 nodes / 16 code nodes — **frozen-by-convention**; any future edit requires the §12-style revision log entry in the preflight report.
- Gates: full suite **987/987**, `verify:frozen` **10/10**, secret scan GREEN. **STOP: no live execution; no re-import; no sheet writes; no commits.**

---

## Verdict

**PASS — Process GPL business-logic quality gates A (relevance), B (geo), C (no-contact) are implemented in the engine oracle AND the embedded node mirror, engine↔embedded parity is proven, the controlled gate fixture asserts all counters and pinned lead ids, the artifact is rebuilt and frozen (`7e335f38…407511`, 88,253 bytes), and the full suite is green (987/987) with frozen verification 10/10.**