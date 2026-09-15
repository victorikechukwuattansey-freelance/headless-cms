# Prospect Finder — Prompt A.9 — Merge + Loop Fix Report

**Date:** 2026-09-15  
**Scope:** Two spec edits (D1 + D2'), rebuild, verify  
**Status:** PASS — D1 + D2' FIXED, B RE-RUN READY

---

## 1. D1 Fix (Merge mode — before/after)

**Before:**
```json
{
  "mode": "combine",
  "combineBy": "combineAll",
  "numberOfInputs": 5
}
```

**After:**
```json
{
  "mode": "append",
  "numberOfInputs": 5
}
```

`combineBy` (and any combine-mode-only params `fieldsToMatch`, `joinMode`) removed entirely. Concatenation preserves whichever branches produced items, including error envelopes, rather than computing a Cartesian product that drops to 0 whenever any single input is empty.

---

## 2. D2' Fix (alwaysOutputData — before/after)

**Before:** `Dedup & Prepare Verified` carried no `alwaysOutputData` field. When all providers returned empty success, the chain produced 0 items at every downstream node; `Has New Verified?` (IF) emitted nothing on either branch and the loop stalled.

**After:** Added `"alwaysOutputData": true` as a node-level field on `Dedup & Prepare Verified`, placed AFTER `position` to mirror the existing `Read Verified Leads` and `Update Status Completed` examples byte-for-byte. The IF node now always receives ≥1 item and takes its false branch (`Update Status Completed → Loop Through Searches`), keeping the loop alive.

---

## 3. D5 Status: RESOLVED BY D1

D5 (loop termination depends on Merge output) is a consequence of D1, not a missing edge. The loop-back edges exist:
- `Has New Verified?` main[1] → `Update Status Completed` → `Loop Through Searches` (splitInBatches)
- `Handle API Error` → `Update Status Failed` → `Loop Through Searches`

With append mode, Merge produces items whenever any branch produces items; with `alwaysOutputData` on Dedup & Prepare Verified, even the all-empty case reaches the IF node. D5 is resolved by D1 (confirmed by inspection; no edge changes required).

---

## 4. OSM Routing: Audited, NOT a Defect, Unchanged

`OpenStreetMap Overpass API main[1]` routes failures via `Handle API Error → Update Status Failed → Loop Through Searches`, marking the search failed and continuing the loop. This is a different isolation philosophy from FSQ/GPL (which write visible `:error` envelopes to Raw Leads via Merge) but satisfies the same premise. **Left unchanged.**

---

## 5. New Artifact Hash + Byte Count

| Field | R4 (before) | R5 (after) | Delta |
|---|---|---|---|
| SHA-256 | `2581898191D3534E228FAA57F53E2AF847EFDD68212CD642B69B4B78B79A01EE` | `51739C9BB18DEF72AF9250ED54BD6B07BB0BAA3F73BFC9E2014C9AC04DAD6347` | — |
| Bytes | 81,719 | 81,715 | −4 |
| Node count | 32 | 32 | 0 |
| Code nodes | 15 | 15 | 0 |

Double-build verification: byte-identical (`IDENTICAL:true`), no trailing newline.

---

## 6. Tests Added / Updated

**prospect-finder-builder.test.js** (5 new, 2 updated):

| Test | Type | Guard |
|---|---|---|
| `Merge uses append mode (not combine)` | new | D1 pin: `mode === 'append'`; `combineBy === undefined`; `combinationMode === undefined` |
| `Merge numberOfInputs is 5` | new | D1 pin: `numberOfInputs === 5` |
| `Merge has no combine-mode parameters` | new | D1 drift guard: `fieldsToMatch === undefined`; `joinMode === undefined` |
| `Dedup & Prepare Verified has alwaysOutputData: true` | new | D2' pin |
| `Dedup & Prepare Verified alwaysOutputData placement matches pattern` | new | D2' field-order guard (mirrors Read Verified Leads) |
| structural wiring invariants (Merge block) | updated | `mode` assertion changed from `'combine'` → `'append'` |
| node count | updated | 33 → 32 |
| byte count | updated | 81719 → 81715 |
| hash anchor | updated | new SHA-256 |

**gpl-workflow.test.js** (2 updated, 1 new):

| Test | Type | Guard |
|---|---|---|
| `declares five append inputs on the Merge node` | updated | `mode` assertion changed from `'combine'` → `'append'` |
| `Dedup & Prepare Verified sets alwaysOutputData` | new | D2' integration pin |

---

## 7. Preflight Report §6.12

Section 6.12 added to `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` with:
- D1, D5, D2' defect characterization (live-run evidence from exec5)
- OSM routing audit conclusion (not a defect)
- Before/after JSON for both spec edits
- New artifact hash + byte count
- Gates summary (857/857, verify:frozen 10/10, secret scan GREEN)
- R5 revision log entry

---

## 8. Gates

| Gate | Result |
|---|---|
| `npm test` | **857/857 pass**, 62 suites, 0 failures |
| Builder byte-identity | double-build **byte-identical** (`IDENTICAL:true`) |
| `npm run verify:frozen` | **10/10 PASS** |
| Secret scan (`scripts/security-check.js`) | **GREEN** (exit 0) |

---

## Completion State

**PASS — D1 + D2' FIXED, B RE-RUN READY**

- D1 resolved (Merge mode append, drift guards pinned)
- D2' resolved (alwaysOutputData on Dedup & Prepare Verified)
- D5 resolved by D1 (loop-back edges confirmed present by inspection)
- OSM routing audited, not a defect, unchanged
- Artifact regenerated, builder byte-identical
- All tests pass, no regressions
- Preflight report §6.12 + revision log R5 updated
- STOP condition met — no live execution, no sheet cleanup, no B re-run
