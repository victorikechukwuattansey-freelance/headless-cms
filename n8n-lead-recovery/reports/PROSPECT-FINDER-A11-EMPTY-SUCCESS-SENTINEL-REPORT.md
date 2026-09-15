# Prospect Finder — Prompt A.11 — Empty-Success Sentinel (`_noResults`) Parity Report

**Date:** 2026-09-15  
**Scope:** A.10 residual fix — Process FSQ / Process OSM emit the GPL `_noResults` sentinel on empty success (spec-first), rebuild, re-baseline (R7), verify  
**Status:** PASS — RESIDUAL FIXED, ALL GATES GREEN, STOP (no live execution)

---

## 1. Context

Prompt A.10 (R6) consolidated the Merge defect (D7) to
`numberOfInputs: 3`, one input per provider, with each provider's
success AND error path feeding the same input. That fixed the error
case. A.10 explicitly left one residual open:

> if a provider *succeeds with zero results*, `Process GPL` emits a
> `_noResults` sentinel (input 2 stays fed), but `Process FSQ` /
> `Process OSM` emit nothing on an empty success — that input would
> remain empty on such a run.

Because Merge runs `mode: append` and waits for every declared input,
a legitimate zero-result run from FSQ or OSM — no API error at all,
the area just has nothing to return — would leave that provider's
Merge input empty and stall the workflow exactly like D7 did. On a
fully-credentialed pipeline this is the *normal* outcome for some
searches, so the residual is a real merge stall, not a cosmetic gap.

**Scope constraints honored:**

- Touched no other workflow.
- Did NOT touch the Foursquare credential.
- Did NOT modify the `Filter Empty Envelopes` node or the error
  envelopes.
- No live execution; no container re-import; no sheet cleanup.
- No Prompt B attempt. Fix via spec → builder → re-baseline only.

---

## 2. Decision — Option A (mirror GPL), and why

Three shapes were considered for FSQ/OSM empty success:

| Option | Shape | Verdict |
|---|---|---|
| **A. Mirror GPL** | Emit the same `{ _noResults: true, _message, _provider }` sentinel GPL already emits | **Chosen.** `Filter Empty Envelopes` explicitly recognizes `json._noResults === true` (embedded code, R3/§6.8) and drops the item — zero new plumbing, provably consistent with archived GPL behavior |
| B. Emit one empty `{ json: {} }` item | Merge input stays fed, sentinel semantics lost | Rejected — a structurally-empty item is indistinguishable from a malformed lead and obfuscates the flow |
| C. Re-wire `Filter Empty Envelopes` | Change provider-agnostic filtering for one provider's gap | Rejected — broadens blast radius; A.11's prompt rule is to change provider code bodies, not the sink |

Mirroring GPL is also what the A.11 decision rule asked for (parity
with the provider that already implements the behavior correctly).

**Sentinel shapes shipped** (exact structure mirrors `Process GPL`):

    Process FSQ  → { _noResults: true, _message: 'Foursquare returned zero results', _provider: 'foursquare' }
    Process OSM  → { _noResults: true, _message: 'OpenStreetMap returned zero results', _provider: 'openstreetmap' }
    Process GPL  → { _noResults: true, _message: 'Google Places returned zero results', _provider: 'google_places' } (unchanged)

---

## 3. Changes Applied (spec-first, via the builder)

### 3.1 `src/prospect-finder-embedded-code.js`

Both process nodes gate their sentinel on an empty accumulator before
the final `return output;`:

- `Process FSQ` — inserted between the for-loop close and
  `return output;`:

      if (output.length === 0) {
        return [{ json: { _noResults: true, _message: 'Foursquare returned zero results', _provider: 'foursquare' } }];
      }

- `Process OSM` — inserted at the same position:

      if (output.length === 0) {
        return [{ json: { _noResults: true, _message: 'OpenStreetMap returned zero results', _provider: 'openstreetmap' } }];
      }

`Process GPL` already gates `if (leads.length === 0) { return [{ json:
{ _noResults: true, _message: 'Google Places returned zero results',
_provider: 'google_places' } }]; }` — left untouched.

Both files' header revision notes advanced to R7 (Prompt A.11). The
sentinels carry **no** lead fields (`lead_id` absent), so downstream
schema expectations are unchanged.

### 3.2 `src/prospect-finder-workflow-contract.js`

R7 header note only. No structural change — the sentinel bodies live
in the embedded-code module, which the builder injects into the node
parameter `jsCode`.

### 3.3 Regenerated artifact

    node scripts/build-prospect-finder-workflow.js

Rebuilt once. Double-build verification emitted `IDENTICAL:true`.

---

## 4. New Artifact Fingerprint

| Item | Value |
|---|---|
| SHA-256 | `B065A3F6B1E1C3F33E1CE2B969FC7158D0DD2413E3F579B32904C95B2B2582FB` |
| Bytes | 83,708 (+302 vs R6's 83,406) |
| Nodes | 33 (unchanged) / 16 code nodes (unchanged) |
| Δ | Sentinel bodies only — no node added, removed, or re-typed |

---

## 5. Baseline Anchors Re-baselined (R7)

| Anchor | Action |
|---|---|
| `tests/prospect-finder-builder.test.js` | `ARTIFACT_HASH` → `b065a3f6…2fb`; byte assertion 83,406 → 83,708; header note R6 → R7 |
| `tests/prospect-finder-error-paths.test.js` | New `§A.11 Process empty-success sentinel parity` suite |
| `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` | §6.14 (new), §12.3 R7 row + R7 tail note, header status block + date |
| `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` | §6 D7 residual → FIXED (A.11 reference), §8 item 2, §9 table, §10 R7 row, §11, header |
| `REPORT.md` | §9 item 5 → appended A.11 FIXED note |

Point-in-time reports (`PROSPECT-FINDER-A10-…`, isolation matrix,
merge-loop-fix) were **not** edited.

---

## 6. Tests Added / Updated

**+6 tests, all offline; no live HTTP.**

`tests/prospect-finder-builder.test.js` (+1):

- *Process FSQ/OSM mirror the GPL `_noResults` sentinel on empty
  success (A.11 shape pin)* — asserts, per node: the body contains the
  exact `return [{ json: { _noResults: true, … } }]` line and gates it
  on an empty result set (`output.length === 0` for FSQ/OSM,
  `leads.length === 0` for GPL).

`tests/prospect-finder-error-paths.test.js` (+5, §A.11):

- `Process FSQ` + empty input → exactly one item, `_noResults: true`,
  `_provider: 'foursquare'`, no `lead_id`.
- `Process OSM` + empty `elements` response → exactly one item,
  `_provider: 'openstreetmap'`, no `lead_id`.
- `Process GPL` + empty `places` response → sentinel (A.11 regression).
- `Process FSQ` + populated success → real lead emitted, **no** sentinel.
- `Filter Empty Envelopes` drops all three providers' sentinels while
  still propagating real leads and error envelopes.

---

## 7. Preflight Report §6.14 + Revision Log

`reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` gained §6.14
(Empty-success parity: Process FSQ/OSM `_noResults` sentinel) and the
R7 row + R7 tail-bullet in §12.3, plus updated header status/date and
the canonical artifact block.

---

## 8. Gates

| Gate | Result |
|---|---|
| `npm test` (`node --test "tests/*.test.js"`) | **873/873 PASS** (867 + 6) |
| Builder determinism | Byte-identical double build (`IDENTICAL:true`) |
| `npm run verify:frozen` | **10/10 PASS** |
| `node scripts/security-check.js` | **GREEN** (exit 0; no credential change) |
| Artifact hash anchor | Matches on-disk artifact (`b065a3f6…b2582fb`) |

No gate failed at any point during the revision.

---

## 9. Residual Risk (out of A.11 scope)

- **§6.5 (`errorMsg` precedence bug in Process GPL)** remains open
  from preflight — unchanged (it only affects the error-message string
  on GPL errors, not merge feeding).
- **Live re-import still pending.** The fix is validated offline and
  in the artifact, but the container `serene_swartz` still holds the
  pre-R7 workflow. Re-import + credential re-attach are operator tasks
  before any future Prompt B run.
- **External blockers unchanged** (§7 of the closure doc): GCP billing
  frozen, FSQ token invalid, Overpass 504 on load.

---

## Completion State

A.11 is complete: the empty-success residual is closed through the
canonical spec and rebuilder, the artifact is re-baselined at R7,
tests/docs are updated, all gates are green, and the work stops here —
no live execution, per scope. The next step is an operator task
(re-import + credentials), not code.