# Prospect Finder — Prompt A.10 — Merge Consolidation (D7) Report

**Date:** 2026-09-15  
**Scope:** D7 Merge stall fix (spec-first), new OSM Error Envelope, rebuild, re-baseline (R6), verify  
**Status:** PASS — D7 FIXED, ALL GATES GREEN, STOP (no live execution)

---

## 1. Context

The GPL workstream was parked with **D7 (open defect)** in
`reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`:

- Merge ran `mode: append`, `numberOfInputs: 5` — three success inputs
  (`Process FSQ`, `Process OSM`, `Process GPL`) plus two error inputs
  (`FSQ Error Envelope` @ 4, `GPL Error Envelope` @ 3).
- n8n Merge waits for **all** declared inputs before emitting. On any
  run where a provider's success path produced zero items — the normal
  case in a partially-credentialed environment — the success input
  stayed empty, `Merge.runData.source` collapsed to
  `[null, null, null, {GPL env}, {FSQ env}]`, and Merge emitted zero
  items even though error envelopes were present.

Prompt A.10 is the authorized re-baseline revision: consolidate to
**one Merge input per provider** and route each provider's success AND
error paths to the same input.

**Scope constraints honored:**

- Touched no other workflow.
- Did NOT touch the Foursquare credential.
- Did NOT modify any existing error-envelope `jsCode` body.
- No live execution; no container re-import; no sheet cleanup.
- No Prompt B attempt. Fix via spec → builder → re-baseline only.

---

## 2. Topology Decided

**Target:** `numberOfInputs: 3`, each provider owns one input:

| Merge input | Success path | Error path |
|---|---|---|
| 0 | `Process FSQ` | `FSQ Error Envelope` |
| 1 | `Process OSM` | `OSM Error Envelope` (new) |
| 2 | `Process GPL` | `GPL Error Envelope` |

### 2.1 Deliberate deviations from the A.10 sketch (both justified)

1. **The two OSM error edges were NOT removed.** The sketch said to
   rewire "the existing edges into Handle API Error". Those edges are
   required: `OpenStreetMap Overpass API main[1]` and the `API
   Success?` false branch feed `Handle API Error → Update Status
   Failed → Loop Through Searches` — the failing-search isolation
   behavior validated live in the isolation matrix and audited as
   "NOT a defect" in A.9 §6.12. A.10 uses a **fan-out** instead: both
   sources now emit to `[OSM Error Envelope, Handle API Error]`. OSM
   gains the same visible `:error` envelope in Raw Leads that GPL/FSQ
   already have, while the status path is preserved verbatim.
2. **The FSQ/GPL envelope edges were retargeted, not re-created.**
   `FSQ Error Envelope` 4 → 0; `GPL Error Envelope` 3 → 2.

### 2.2 Why the envelope and the raw error diverge

`Handle API Error`'s `jsCode` reads `response.statusCode` /
`response.body` from the raw HTTP error item. Feeding it the envelope
object would yield `'HTTP error 0'`. The source fan-out keeps the raw
payload on the `Handle API Error` edge (unchanged semantics) and hands
the envelope to Merge.

---

## 3. Changes Applied (spec-first, via the builder)

### 3.1 `src/prospect-finder-workflow-contract.js`

- Header/API note: R6 — D7 `numberOfInputs` 5 → 3.
- `CODE_NODE_NAMES`: `"OSM Error Envelope"` inserted after
  `"Process OSM"`.
- New node object after `Process OSM` (code node, `type` v2,
  `parameters: {}`):
  - id `e0d8f43a-7b21-4c9e-9a56-1f3c0b8d2e77`
  - position `[2160, 176]`
- `Merge`: `numberOfInputs` 5 → **3** (`mode: append` unchanged).
- Connections:
  - `OpenStreetMap Overpass API` main[1] → `[OSM Error Envelope,
    Handle API Error]` (was `[Handle API Error]`).
  - `API Success?` main[1] → `[OSM Error Envelope, Handle API
    Error]` (was `[Handle API Error]`).
  - New connection key `"OSM Error Envelope"` → `Merge` @ index 1
    (after `"Process OSM"`, before `"Merge"` — artifact key order).
  - `FSQ Error Envelope` Merge index 4 → **0**.
  - `GPL Error Envelope` Merge index 3 → **2**.

### 3.2 `src/prospect-finder-embedded-code.js`

New `CODE_BY_NODE['OSM Error Envelope']` entry (inserted after
`Process OSM`, header note added). Mirrors the FSQ/GPL envelope
byte-pattern:

- Context: `$('Build OSM API Query').first().json` → `input_id`,
  `search_input_id`, `niche` fallback `'HVAC'`, etc.
- `_provider: 'openstreetmap'`
- `_status: 'error'`
- `_errorMessage: 'OpenStreetMap API error: ' + errorMsg + statusText`
- `_rawStatus: httpCode ? ('HTTP ' + httpCode) : 'ERROR'`
  (graceful degradation when the payload carries no httpCode/statusCode)
- `errorsEncountered` incremented
- `source: 'openstreetmap:error'`
- `notes: 'OpenStreetMap API error: ' + errorMsg + statusText`

### 3.3 Regenerated artifact

`node scripts/build-prospect-finder-workflow.js` — no hand-edits.
Double-build byte-identical.

---

## 4. New Artifact Fingerprint

| Field | R5 (before) | R6 (after) | Delta |
|---|---|---|---|
| SHA-256 | `51739C9B…DAD6347` | `630AAE88D8A6BFC157A431988ABE50C84BA4124113D5E18DB711BB8DA9E1E580` | — |
| Bytes | 81,715 | 83,406 | +1,691 |
| Node count | 32 | 33 | +1 |
| Code nodes | 15 | 16 | +1 |

Double-build verification: byte-identical (`IDENTICAL:true`), no
trailing newline.

Verified wiring on the built artifact:

```
Process FSQ   → Merge@0      FSQ Error Envelope → Merge@0
Process OSM   → Merge@1      OSM Error Envelope → Merge@1
Process GPL   → Merge@2      GPL Error Envelope → Merge@2

OpenStreetMap Overpass API main[1] → [OSM Error Envelope, Handle API Error]
API Success?                 main[1] → [OSM Error Envelope, Handle API Error]

Merge { mode: 'append', numberOfInputs: 3 }
```

---

## 5. Baseline Anchors Re-baselined (R6)

The Prospect Finder baseline has no `frozen-artifacts.manifest.json`
entry (that manifest covers response-* artifacts only, 10/10 —
unchanged). The R6 re-baseline therefore updated every anchor that
does carry the Prospect Finder fingerprint:

| Anchor | Change |
|---|---|
| `tests/prospect-finder-builder.test.js` `ARTIFACT_HASH` | → `630aae88…e1e580` |
| `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` §12.3 + header + §6.13 | R6 row + status block |
| `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` §6/§8/§9/§10/§11 | D7 → FIXED |
| `REPORT.md` item 5 | D7 note appended |

Historical, point-in-time reports are intentionally NOT edited:
`PROSPECT-FINDER-ISOLATION-MATRIX.md` (live-run evidence),
`PROSPECT-FINDER-MERGE-LOOP-FIX-REPORT.md` (A.9 state),
`PROSPECT-FINDER-GPL-ISOLATION.md` (Prompt B report).

---

## 6. Tests Added / Updated

**prospect-finder-builder.test.js** (2 new, 4 updated):

| Test | Type | Guard |
|---|---|---|
| `Merge numberOfInputs is 3 — A.10 D7 fix (one input per provider)` | updated (was 5) | `numberOfInputs === 3` |
| `Merge numberOfInputs cannot regress above 3 (D7 drift guard)` | new | `numberOfInputs <= 3` |
| `OSM Error Envelope is a code node feeding Merge input 1 (A.10 D7)` | new | node type + `jsCode` equals `CODE_BY_NODE['OSM Error Envelope']` + `Merge` edge index 1 |
| structural wiring invariants | updated | `expectIndex` map over all 6 producers; every Merge input ≥1 producer; Overpass/API Success? main[1] fan-out pinned |
| hash anchor / bytes / node count | updated | new SHA, 83,406, 33 |

**gpl-workflow.test.js** (2 updated):

| Test | Type | Guard |
|---|---|---|
| `declares three append inputs on the Merge node — A.10 D7` | updated | `numberOfInputs === 3`, `mode === 'append'` |
| `routes each provider and its error envelope onto the same Merge input index` | updated | 6 producers → distinct indices {0,1,2} |

**prospect-finder-error-paths.test.js** (7 new, 2 updated):

| Test | Type | Guard |
|---|---|---|
| `the GPL Error Envelope reaches Merge on the GPL input index` | updated | index 3 → 2 |
| `the FSQ Error Envelope reaches Merge on the FSQ input index` | updated | index 4 → 0 |
| `Merge is fed by each provider on indices 0,1,2 and its error envelope on the same input (D7 — A.10)` | updated | 6-producer map |
| `Merge declares append mode with numberOfInputs 3 (D7 — A.10)` | new | Merge params |
| `routes the Overpass HTTP error output to OSM Error Envelope (keeping Handle API Error)` | new | fan-out deep-equals + `onError` |
| `routes the API Success? false branch to OSM Error Envelope (keeping Handle API Error)` | new | fan-out deep-equals |
| `the OSM Error Envelope reaches Merge on the OSM input index (1)` | new | edge index |
| `converts a real Overpass HTTP failure into an explicit failure envelope (offline)` | new | offline sandbox: envelope schema, `errorsEncountered` increment, no fabricated `lead_id` |
| `degrades gracefully if the HTTP error payload carries no httpCode/statusCode` | new | `_rawStatus === 'ERROR'` |
| `reads the search context from the Build OSM API Query node (not the payload)` | new | `input_id` provenance |
| `OSM errors reach Merge input 1 while Process OSM also feeds input 1 (success path preserved)` | new | success/error co-location |

Offline sandbox: `runNode` evals the embedded `jsCode` in a
`$('…')`-stubbed VM — no live HTTP.

---

## 7. Preflight Report §6.13 + Revision Log

`reports/PROSPECT-FINDER-GPL-PREFLIGHT.md`:

- §6.13 added: D7 context, topology (incl. the two justified
  deviations), changes applied, fingerprint, gates.
- Header follow-up/status/date lines + artifact status block → R6.
- §12 revision log: R6 row added; follow-up bullet added.

`reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`:

- §6 D7 → **FIXED** (fix description, deviations, residual risk).
- §8 resume conditions: A.10 marked DONE; re-import/credential
  re-attach still required before any live run.
- §9 artifact state, §10 change log R6 row, §11 recommendation updated.

---

## 8. Gates

| Gate | Result |
|---|---|
| `npm test` | **867/867 pass**, 63 suites, 0 failures (857 + 10 new) |
| Builder byte-identity | double-build **byte-identical** (`IDENTICAL:true`) |
| `npm run verify:frozen` | **10/10 PASS** (no Prospect Finder entry — unaffected) |
| Secret scan (`scripts/security-check.js`) | **GREEN** (exit 0) |

---

## 9. Residual Risk (out of A.10 scope)

If a provider **succeeds with zero results**, `Process GPL` emits a
`_noResults` sentinel so Merge input 2 stays fed; `Process FSQ` and
`Process OSM` emit nothing on an empty success, leaving their Merge
input empty on such a run. A.10 tests assert "≥1 producer exists per
input" (connection-based), not guaranteed emission. Fixing this would
require adding `_noResults`-style sentinels to the FSQ/OSM code bodies
— out of A.10 scope; do NOT add here. Flagged so a future revision can
decide.

---

## Completion State

**PASS — D7 FIXED, ALL GATES GREEN, STOP (no live execution)**

- D7 resolved: Merge `numberOfInputs` 5 → 3, one input per provider,
  success + error paths share the input; drift guard pinned (`<= 3`).
- New `OSM Error Envelope` code node added; Overpass error + `API
  Success?` false branch fan out to `[OSM Error Envelope, Handle API
  Error]` — status path preserved, no existing jsCode modified.
- FSQ/GPL envelope edges retargeted 4→0 / 3→2.
- Artifact regenerated via the builder (no hand-edits),
  `630aae88…e1e580`, 83,406 bytes, 33 nodes / 16 code nodes,
  double-build identical.
- All anchors re-baselined (R6): builder-test hash, preflight §6.13 +
  header + §12.3, closure doc, REPORT.md.
- Full suite 867/867, `verify:frozen` 10/10, secret scan GREEN.
- STOP condition met — no live execution, no re-import, no sheet
  cleanup, no Prompt B.