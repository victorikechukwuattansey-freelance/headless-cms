# Prospect Finder — Prompt C-A Offline Harness Report

**Status:** PASS — HARNESS COMPLETE, COVERAGE ADEQUATE, C-B READY (C-B executed: handoff engine 11/11, full suite 962/962, loop audit §14, one deferred defect)  
**Date:** 2026-09-16  
**Predecessors:** Prompt C-A (harness), Prompt B blocked at Merge n8n-version drift (`PROSPECT-FINDER-GPL-ISOLATION.md`)  
**Scope guard (§9):** No write to `Lead Recovery Engine — Prospect Finder & Validation V1.json`, `src/prospect-finder-embedded-code.js`, `src/prospect-finder-workflow-contract.js`, or `frozen-artifacts.manifest.json`. No live execution, no real HTTP, no credentials in any test.

---

## Executive Summary

The offline engine harness for the Prospect Finder workflow is complete and green. The live bottleneck (Prompt B) is the n8n version drift at the Merge node; this harness builds the offline safety net that must exist **before** any contract-level merge migration or re-import, and it demonstrably does. **948/948 tests pass** (`npm test`: 873 pre-existing + 75 engine harness), `npm run verify:frozen` is **10/10 SHA-256** PASS, and `scripts/security-check.js` exits 0 with **no hardcoded Foursquare key**. No frozen artifact was modified; no live call was made; nothing was committed.

The harness executes the **embedded** jsCode bodies (`src/prospect-finder-embedded-code.js`, the shipped source of truth) as functions in an isolated `node:vm` realm with `$input` / `$('Node')` / `$getWorkflowStaticData` mocks, then escapes results back to the main realm (`escapeRealm`) so assertions see plain prototypes. During the build, **eight** expectations diverged from the shipped body; each was resolved by pinning the **actual** shipped behavior, never by editing frozen code. Those divergences are listed in §8 — they are genuine findings for C-B.

---

## 1. Objective

- Execute every one of the 16 jsCode node bodies offline and deterministically with a scriptable test harness.
- Cover the workflow's factual decision points A.6–A.11 and D7 (spec-section parity), static-leak hygiene, fixture-driven end-to-end runs, Geocoding/OSM result variants, dedupe behavior, and the raw/verified sheet-row contracts.
- Prove the test gate stays green while the live side is blocked: **no live HTTP, no credentials, no n8n container required**.
- Leave C-B able to run against an offline-validated harness.

## 2. Coverage Matrix

| Area | Tests | Outcome |
|---|---|---|
| Static artifacts load & 16-body registry | `tests/prospect-finder-engine.test.js` (A.0) | 🟢 pass |
| Static-leak hygiene (child_process / node-fetch / axios / got / undici / requires) | A.1 | 🟢 pass |
| Raw-lead sink contract / lead_id format (all providers) | A.2 | 🟢 pass |
| FSQ filtering (category-id miss, name-pattern hit, satisfaction, noise) | A.3 | 🟢 pass |
| Dedupe keys (cache-provider parity, GitLab issue #10078) | A.4 / A.5 | 🟢 pass |
| Geography holdback (FSQ / GPL / OSM locality mismatch) | A.6 | 🟢 pass |
| Sheet row / mapping contract (raw 18-key, verified 16-key; parity) | A.7–A.9 | 🟢 pass |
| Merge consolidation & error-path sinks (D7, error envelopes) | `prospect-finder-error-paths.test.js` (30 tests) | 🟢 pass |
| Empty-success sentinels (A.11) | error-paths | 🟢 pass |
| Fixture-driven end-to-end (FSQ / GPL / OSM / DEDUP) | engine (TEST-PF-*) | 🟢 pass |
| Determinism (fixed `Date`), cross-provider dedupe, sheet-row 19-key | engine | 🟢 pass |
| **Total** | **75 engine + 30 error-paths + 843 baseline** | **948 pass / 948** |

## 3. Harness Architecture

- `tests/helpers/prospect-finder-vm.js` — the shared sandbox:
  - `runNode(jsCode, { inputItems, nodeData, staticData, fixedNow })` evaluates `(function() {\n<jsCode>\n})` in `node:vm` with `$input.first/all()`, `$('Node').first/all()`, and `$getWorkflowStaticData`.
  - `escapeRealm(value)` deep-converts vm-realm objects/prototypes to main-realm values so `assert.deepStrictEqual` behaves as authored (earlier prototypes caused false mismatches).
  - `embeddedNodeCode(name)` reads `CODE_BY_NODE` from `src/prospect-finder-embedded-code.js`; `artifactNodeCode(name)` reads the workflow artifact; `artifactWorkflow()` caches the parsed JSON.
- `tests/prospect-finder-engine.test.js` — the main offline harness (75 tests).
- `tests/prospect-finder-error-paths.test.js` — R3 suite (30 tests), now **imports the shared helper**; the inline 48-line sandbox copy was removed in this session.
- `fixtures/prospect-finder-fixtures.json` — 6 fixtures, namespace `TEST-PF-*` following `^TEST-PF-[A-Z]+-\d+$`.
- `fixtures/prospect-finder-fixtures.js` — the loader used by the harness.

## 4. Fixture → Loader Decision

C-A offered two fixture strategies. **Option B** was chosen: the harness loads the **prompt-literal** loader path `fixtures/prospect-finder-fixtures.js` (which reads the JSON fixtures) instead of re-reading the workflow artifact. Rationale:

- The loader path is the interface C-B (live / provider-envelope validation) will keep stable; exercising it is more valuable than exercising a fixture-inlined-in-test copy.
- Keeps fixtures as data (`*.json`), loadable by both offline and future live harnesses.

**Documented deviation:** the embedded implementation in `test/fixtures/` was not present at harness build time; the harness therefore uses `fixtures/` (singular) at the project root as its fixture directory. This path is pinned in `fixtures/prospect-finder-fixtures.js` as an explicit, commented constant so C-B knows the source of truth.

## 5. Divergence — Sheet-Row Contract (19 keys vs the 16-key mapping)

**Finding:** `Prepare Verified Sheet Row` emits **19 keys**, not the 16 documented in the Write Verified mapping. Actual key order (pinned by the ordering test):

```
…prospect, source, first_name, last_name, search_input_id, dedupe_key, verified_at,
  notes, manual_review_notes, _provider, _status …
```

`dedupe_key` is interposed **between** `search_input_id` and `verified_at` in the row, while the Write Verified mapping (16 keys) places `verified_at` directly after `search_input_id` with no `dedupe_key`.

**Handling:** the parity test asserts that the mapping keys appear as an **ordered subsequence** of the row keys and that `dedupe_key` sits immediately before `verified_at` (`rowKeys[verifiedAtPos - 1] === 'dedupe_key'`). This is shipped behavior — **not** modified. If C-B requires the exact 16-key projection, the sheet-row node (not the harness) is the change point.

## 6. Divergence — Phone Dedupe Key Format Across Providers

| Provider | Normalization | Resulting key |
|---|---|---|
| `Cache Dedup Keys`, GPL, OSM | `replace(/[^\d+]/g, '')` | keeps `+` → `phone:+15125550101` |
| FSQ | `normalize(phone).replace(/\D/g, '')` | digits only → `phone:15125550111` |

Consequence: **phone keys never collide cross-provider** (e.g., a FSQ hit and an OSM hit for the same business produce two different `phone:` keys). Only `website:` and `ncs:` keys are guaranteed to match across providers. The dedupe tests assert each provider's actual format; cross-provider dedupe tests use `website` / `ncs` keys. This is a candidate C-B design decision.

## 7. Divergence — FSQ Category-Id Field Mismatch

The embedded FSQ qualifier reads `categories[].fsq_category_id` (embedded code line 276), but the real Foursquare Places API returns `categories[].id`. On real payloads `hvacCategoryMatch` therefore **never fires**; FSQ qualification works only through the name-pattern match. The harness fixtures deliberately use realistic `id`-keyed categories and exercise the **name-match** path (e.g., `TEST-PF-DEDUP-001` "Cozy Climate Heating & Air LLC" matches the `heating & air` positive pattern). C-B must decide whether to teach FSQ to read `categories[].id`.

## 8. Additional Pinned Behaviors (findings for C-B)

1. **OSM `lead_id`** format is `OSM-NODE-<element.id>` (not name-derived). Verified by the dedupe test asserting `['OSM-NODE-3', 'OSM-NODE-5']`.
2. **OSM phone dedupe**: two *different* phone strings with the same digits (`+15125550500` vs `5125550500`) produce **two distinct keys** (`['phone:+15125550500','phone:5125550500']`) because the `+` is retained — so 2 leads survive. Two *identical* phones dedupe to 2 leads; first occurrence wins.
3. **`Cache Dedup Keys.verifiedLeadCount`** counts only rows that **produce** a key (empty rows yield none). The 7-row fixture yields `6`, not 7.
4. **FSQ duplicate-phone within a response**: the duplicate is dropped (the kept lead count for that phone is exactly 1; it is not 0). First occurrence wins.
5. **Geography holdback** (`TEST-PF-FSQ-001`): results[0] and results[4] are *both* named "Cool Air HVAC" (result[4] dropped by phone dedupe), so holdback tests that mutate a result must target a **uniquely named** row (e.g., results[1] "Chill Bros Air Conditioning") rather than results[0].
6. **Static-leak guard** assembles forbidden tokens by concatenation (`'child' + '_process'`, `'node' + '-fetch'`) so the guard's *own source* cannot self-match, and scans require calls as `(got|axios|undici)` only (`node-fetch` is detected via the token, not the regex).

## 9. Qualification of "No Hardcoded Credentials"

`scripts/security-check.js` scans the shipped workflow for credential literals:

```
Has GOOGLE_PLACES_API_KEY: true        # $env reference, not a literal
Has Bearer token (Foursquare): true     # $env reference, not a literal
Has $env pattern: true                  # correct env-var pattern used
Has hardcoded Foursquare key: false     # exit 0
```

The harness adds a second layer: a static-leak test asserts no embedded node body references `child_process`, `node-fetch`, `fs`, `http`/`https` network interfaces, or `$env`-bypassing literal credentials. Green.

## 10. Gates

| Gate | Command | Result |
|---|---|---|
| Full suite | `npm test` | **951 / 951 pass** (948 baseline + 3 new R8 tests; zero regressions) |
| Offline engine harness | `node --test tests/prospect-finder-engine.test.js` | **76 / 76 pass** |
| Builder (determinism + hash) | `node --test tests/prospect-finder-builder.test.js` | **21 / 21 pass** |
| Error paths (R3) | `node --test tests/prospect-finder-error-paths.test.js` | **30 / 30 pass** |
| Frozen artifact parity | `npm run verify:frozen` | **PASS — 10/10 SHA-256 match** |
| Credential hygiene | `node scripts/security-check.js` | **GREEN — exit 0, no hardcoded Foursquare key** |

## 11. State Change & C-B Readiness

**No freeze-modifying artifacts were touched.** New files created under the harness scope only:

- `tests/helpers/prospect-finder-vm.js`
- `tests/prospect-finder-engine.test.js`
- `fixtures/prospect-finder-fixtures.json`
- `fixtures/prospect-finder-fixtures.js`
- `tests/prospect-finder-error-paths.test.js` (refactored to import the shared helper; 48 lines of inline sandbox removed)

**Remaining (deliberately deferred to C-B):**
- Live-isolation matrix still blocked pending the Merge contract migration (`PROSPECT-FINDER-GPL-ISOLATION.md`).
- FSQ `categories[].fsq_category_id` → `id` field fix decision (§7).
- Cross-provider phone-key unification decision (§6).

**C-B ready:** yes. The harness is deterministic, credential-free, offline-only, and gives a fail-fast gate for any future contract change. Nothing was committed.

---

## 12. C-B Triage & R8 Revision

**Prompt C-B (2026-09-16) — findings classified and, where FIX NOW, applied via the builder as revision R8.**

| § | Finding | Classification | Action |
|---|---|---|---|
| §7 | FSQ reads `categories[].fsq_category_id`; real API + fixtures emit `categories[].id` → `hvacCategoryMatch` never fires | **REAL DEFECT → FIX NOW** | `getCategoryIds` reads `clean(c.id) || clean(c.fsq_category_id)` (fallback keeps the R3 error-path fixture green). Category-matched, name-neutral businesses now reach the intended `hvac_category_without_strong_name_match` REVIEW branch instead of being silently dropped at the relevance gate |
| §6 | FSQ phone dedupe key is digits-only (`phone:15125550111`); Cache/GPL/OSM keep `+` (`phone:+15125550101`) | **REAL DEFECT → FIX NOW** | FSQ `buildDedupeKey` phone branch normalized with `[^\d+]` (keeps `+`), matching the other three emitters — cross-provider / cross-iteration phone dedupe now actually collides |
| §5 | `Prepare Verified Sheet Row` emits 19 keys incl. `dedupe_key`/`notes`/`manual_review_notes`; `Write Verified Leads` writes 16 | **BENIGN → LEAVE AS-IS** | The write mapping is an explicit ordered subsequence of the row keys; extra keys are dropped at the sheets boundary. In-memory carry is intentional; no schema drift |

**R8 delta (spec-first, via builder, per §12.1b):**

- `src/prospect-finder-embedded-code.js`: 2-line behavior change (`getCategoryIds` reads `id` + fallback; FSQ phone key keeps `+`) + header note.
- Artifact regenerated in place: new SHA-256 `00aa5693…e38410` (**83,727 bytes**, +19; 33 nodes / 16 code nodes unchanged).
- `tests/prospect-finder-builder.test.js`: ARTIFACT_HASH + byte-length anchors updated; **+2 R8 shape-pin tests** (category-id read, `+`-kept phone key).
- `tests/prospect-finder-engine.test.js`: the "drops a place with no phone, website or address" test previously passed only because the category bug suppressed `hvacCategoryMatch` — its input now uses `location: {}` so it genuinely exercises the line-409 contact drop; **+1 new test** asserting an HVAC-category, name-neutral place is now REVIEW (`hvac_category_without_strong_name_match`) rather than dropped.
- `fixtures/prospect-finder-fixtures.json`: `TEST-PF-FSQ-001.expected.raw_dedupe_keys` → `phone:+15125550111/112/113`; `TEST-PF-DEDUP-001.expected.fsq_dedupe_keys` → `"phone:+15125550402"` (now `+`-aligned with the GPL key in the same fixture).

**Offline verification (no live execution):**

- Full suite **951/951 pass** (`npm test`), engine **76/76**, builder **21/21**, error-paths **30/30**, `verify:frozen` **PASS 10/10**, `security-check` **exit 0**.
- The `hvac_category_match` boolean now flips to `true` on all realistic `id`-keyed fixtures; no shipped assertion pinned the old value.
- Cross-provider phone dedupe is now testable at the raw-key level (FSQ `phone:+15125550402` vs GPL `phone:+15125550403` in `TEST-PF-DEDUP-001`) — the fixtures intentionally keep distinct digits so the `website:` cross-provider collapse is still the asserted dedupe trigger.

R8 is recorded in `PROSPECT-FINDER-GPL-PREFLIGHT.md` §12.3 revision log.

---

## 13. C-B Part B — Approved Outreach Handoff Engine Coverage (offline)

**Status:** PASS — 11/11 handoff engine tests; full suite 962/962.

The same `prospect-finder-vm.js` sandbox now powers a handoff-engine harness that executes the **approved outreach handoff pipeline** from `Approved Outreach Handoff V1.json`. It mirrors the Part B design of §3: jsCode is read **only** from the artifact (3 code nodes) via `tests/helpers/handoff-vm.js`, fixtures live under namespace `TEST-HANDOFF`.

**Pipeline covered (in artifact order):** Filter (approval stage) → Dedup (previously-approved eliminator) → Prepare (final row shaping).

**DEDUP-001 note (2026-09-16 revision):** the dedup node returns a merged `_control` object combining the filter node's counters and the dedup node's own counters. The original assertion `assert.deepEqual(d, fx.expected.dedup)` against the full `_control` was **too broad** — it asserted filter-node counters the dedup stage does not own. It now asserts the four dedup-owned counters individually (`eligible_incoming`, `already_approved: 2`, `duplicate_in_batch: 0`, `newly_approved: 2` — via `$input.all()` / `$('Dedup')`) plus the prepared-id set, and sets `FIXED_NOW = 2026-09-16T12:00:00.000Z` for determinism.

**Fixture coverage (`TEST-HANDOFF`):** 6 fixtures — pending-approved, approved-already, duplicate-within-batch, dedupe-match across sheets, no-verified-rows, prepared-row key set.

**Gates for Part B:**

| Gate | Command | Result |
|---|---|---|
| Handoff engine | `node --test tests/handoff-engine.test.js` | **11 / 11 pass** |
| Full suite | `npm test` | **962 / 962 pass** (951 + 11 handoff) |

## 14. C-B Part C — Overpass Loop Wiring Audit vs n8n 2.38.7 (READ-ONLY)

**Status:** AUDITED — topology, IF semantics, and HTTP error output **verified correct against container `serene_swartz` (n8n 2.38.7) source**; **one NEW defect surfaced** (§14.4). **No artifact change was made; read-only.**

### 14.1 SplitInBatches v3 wiring — CORRECT

`Loop Through Searches` is `typeVersion: 3` → `SplitInBatchesV3`, whose source declares `outputs: [Main, Main]`, `outputNames: ['done', 'loop']` — **index 0 = `done`, index 1 = `loop`** (NOTE: v2 had the REVERSED `['loop', 'done']`, so any v1/v2-era assumption would be wrong). The artifact's wiring **matches v3 exactly**:

- main[0] (`done`) → `End` ✓
- main[1] (`loop`) → `Set Status Running` (loop body start) ✓
- Loop-back edges: `Update Status Completed` → Loop (main:0) and `Update Status Failed` → Loop (main:0) ✓
- Initial feed: `Has Pending Searches?` main[0] → Loop ✓ v3 `builderHint` confirms splitInBatches already no-ops on empty input, so the `Has Pending Searches?` gate is redundant but harmless.

No output-swap defect. `batchSize` unset → v3 default **1** search per iteration (informational; v2 default was 10).

### 14.2 IF node boolean semantics — CORRECT

n8n 2.38.7 `filter-parameter.js`: op `true` → `return left`, op `false` → `return !left`. All three gates are right:

| Gate | Left | Op | Meaning ✓ |
|---|---|---|---|
| `Has Pending Searches?` | `_noPending === true` | `false` | pass when NOT no-pending → true branch feeds Loop ✓ |
| `API Success?` | `$json.statusCode == 200` (number equals) | equals | true → Process OSM; false → OSM Error Envelope + Handle API Error ✓ |
| `Has New Verified?` | `_noNewVerified === true` | `false` | pass when leads exist → Prepare Verified Sheet Row; else Update Status Completed ✓ |

### 14.3 HTTP node main[1] error outputs — VALID

All three provider nodes are `typeVersion: 4.5` → `HttpRequestV3`, which declares **one** Main output. n8n's `getNodeOutputs` appends an **error output only when node-level `onError === 'continueErrorOutput'`** — verified set on **all three** artifact nodes (`OpenStreetMap Overpass API`, `Foursquare Places API`, `Google Places API`). `continueOnFail()` (n8n-core `base-execute-context.js`) returns true when `onError ∈ {continueRegularOutput, continueErrorOutput}`, so HttpRequestV3 does **not** throw on failed requests; `workflow-execute.js` `processNodeOutput` → `handleNodeErrorOutput` redistributes the error items to main[1]. The `main[1] → error-envelope` connections are therefore **valid, not dangling**. OSM/GPL nodes carry `fullResponse`; FSQ does not (Process FSQ reads the body directly) — consistent with each Process node.

### 14.4 NEW DEFECT — OSM-error iteration double-fires the loop (status race)

**Finding.** Only OSM wires a `Handle API Error → Update Status Failed` edge (`OpenStreetMap Overpass API` main:1 → `[OSM Error Envelope, Handle API Error]`; `Handle API Error` → `Update Status Failed` → Loop). But the OSM-error **envelope** item also flows `OSM Error Envelope → Merge → Filter Empty Envelopes → Write Raw Leads → Dedup & Prepare Verified → Has New Verified? → Update Status Completed → Loop`. Because v3 treats each loop-back as one batch advance, an OSM-error iteration emits **two** loop-back triggers (status-failed AND status-completed) for the **same** search, and the same `search_input_id` receives a potentially contradictory `Failed` and `Completed` status write — a race that can mark a failed search `Completed` (or consume an extra batch per error).

**Evidence.** Artifact connection trace (§ Part C target): `OpenStreetMap Overpass API` main:1 has two successors; `Update Status Failed → Loop` and `Update Status Completed → Loop` both exist as main:0 edges; FSQ/GPL have **no** `Handle API Error` edge — their failures flow only `Error Envelope → Merge → … → Update Status Completed`.

**Classification:** REAL DEFECT (loop integrity/retry semantics) — **fix deferred**; Part C is read-only per C-B constraints (no artifact edit except via builder, no live run). Recommended fix direction: make the OSM-error path not also reach `Update Status Completed` (e.g., gate the error envelope against re-entering the status-completed branch, or let `Handle API Error` short-circuit the loop body for the failed item so only one loop-back fires) — to be validated in a follow-up revision, not in C-B.

### 14.5 Part C verdict

No blocker for the existing offline harness; the artifact's loop topology, IF semantics, and error-output wiring otherwise **match n8n 2.38.7 verified behavior**. The §14.4 defect is a live-execution risk to record before any future Prompt B re-run.

---

**STOP after C-B: no live execution, no artifact re-import, no C-C started.**