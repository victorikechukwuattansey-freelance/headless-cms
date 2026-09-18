# H.8b.2 Report — V/W Orientation Fix + Positional Preflight

**Date:** 2026-09-18
**Status:** PASS — live-sheet orientation restored and positionally guarded;
sheet-state confirmation delegated to the operator (env not on this machine).

---

## 1. Root cause

`src/schema.js` shipped `APPROVED_COLUMNS` with the last two entries in the
REVERSE of the live sheet:

- shipped: V (index 21) = `contact_blocked`, W (index 22) = `contact_source_provider`
- live sheet (verified via Sheets API by the operator): V = `contact_source_provider`, W = `contact_blocked`

The engine-direct runner reads/writebacks Approved rows positionally through
`APPROVED_COLUMN_INDEX` (auto-derived from `APPROVED_COLUMNS`), so the reversed
schema would have written provider values into column W and blocked flags into
column V — misplacing both enrichment-owned fields on an `--execute` run.
Preflight D in H.8b.1 only verified column NAMES present, so a V/W swap passed.

## 2. Fix — schema orientation (`src/schema.js`)

Swapped the last two entries of `APPROVED_COLUMNS` to match the live sheet:

```
  'notes',
  'contact_source_provider',   // index 21 = column V
  'contact_blocked',           // index 22 = column W
```

`APPROVED_COLUMN_INDEX` is derived from the array, so it updated automatically:
`contact_source_provider = 21`, `contact_blocked = 22`. The column-ownership
comment now records the live orientation.

Scope check: `src/schema.js` is **not** in the 24-artifact frozen manifest
(confirmed); `src/enrichment-schema.js` (frozen) holds only the A–N log columns
and was untouched; all enrichment engines (`src/enrichment-contact*.js`, cached
mirrors) are field-name based, not positional, so no engine changes were needed.

## 3. Preflight hardening — positional column checks

`scripts/run-enrichment-live.js` now validates column POSITION, not just
presence, for every Approved column (all 23) and every log column (all 14):

- New helpers: `columnLetter(index)` (A/…/W), `positionalMismatches(grid,
  expectedColumns)`, `mismatchDetail(...)`.
- Check `D Approved Outreach columns`: rejects swapped columns, renamed
  enrichment fields, and wrong-slot placements; detail names the mismatching
  letter and both values, e.g. `V is "contact_blocked", expected
  "contact_source_provider"`.
- Check `E Contact Enrichment Log columns`: same positional treatment (A–N).
- `PREFLIGHT_APPROVED_COLUMNS` is retained (export untouched) but the D check
  now validates against the authoritative `APPROVED_COLUMNS` constant.
- The obsolete presence-only `missingColumnsFor` helper was removed.

## 4. Tests

- Fixed orientation pins that encoded the reverse mapping:
  - execute test V/W write refs → `['!V2', '!V3', '!V4', '!W4']`
  - namespace test provider write → `!V2`
  - cache-hit write-back test provider write → `!V2`
- Added (5 tests → runner suite 57/57):
  - schema pinned to the live header order via an independent literal
    (`V=contact_source_provider` at 21, `W=contact_blocked` at 22)
  - V/W-swapped Approved header FAILs D positionally with V/W detail
  - renamed enrichment-owned column FAILs D and names the position
  - enrichment column at the wrong position FAILs D
  - execute run writes provider→V and blocked→W only (`TRUE` never lands on V)

## 5. Gates

| Gate                    | Result              |
| ----------------------- | ------------------- |
| `npm run enrichment:live:test` | 57/57        |
| `npm test`              | 1199/1199           |
| `npm run verify:frozen` | PASS — 24/24 SHA-256 match |
| `npm run enrichment:security` | exit 0 (GREEN) |
| CLI dry run (no env)    | NOT_CONFIGURED, exit 3, report written |

## 6. Open item — live sheet confirmation (operator)

Verification of "no prior damage" (Contact Enrichment Log has 0 data rows;
Approved V/W empty) requires the configured host env, which this session does
not inherit. **Before any `--execute`:** confirm on the live sheet that

- Approved Outreach header V = `contact_source_provider`, W = `contact_blocked`,
- Contact Enrichment Log is empty / only header row.

If any data is present, STOP and report manually — no automated migration was
performed; the frozen Enrichment V1.json workflow writes both fields by NAME
(not position), so the correction applies to the engine-direct runner only.

## 7. No-op guarantees

- No workflow artifact modified (Enrichment V1.json and the 23 other frozen
  artifacts unchanged — `verify:frozen` PASS).
- No `src/enrichment-*.js` engine module modified.
- No `src/enrichment-schema.js` modified.
- No manual data migration performed.
- No `--execute` run performed.