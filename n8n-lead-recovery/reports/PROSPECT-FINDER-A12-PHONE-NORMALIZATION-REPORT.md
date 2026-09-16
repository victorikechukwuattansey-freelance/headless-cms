# Prospect Finder — Prompt A.12 — Single Canonical Phone Normalization Report

**Date:** 2026-09-16  
**Scope:** Prompt A.12 (Option B) — one canonical `normalizePhone` shared byte-for-byte by `Process FSQ` and `Process OSM` (stored phone AND dedupe key), spec-first, rebuild, re-baseline (R8), verify  
**Status:** PASS — CANONICAL PHONE NORMALIZATION FIXED, ALL GATES GREEN, STOP (no live execution)

---

## 1. Context

Prompt C-B (R8) fixed the FSQ phone-key **format** so FSQ `buildDedupeKey`
kept the leading `+` (`[^\d+]`), matching Cache/GPL/OSM format so
cross-provider phone dedupe collides. But format-parity is not
**content**-parity: the `+` is provider-relative. Foursquare returns bare
US tel like `(512) 600-4311` — after `[^\d+]` that is `5126004311`, no `+`
to keep — while OpenStreetMap tags the same business `15126004311`, which
becomes `+15126004311`. Both keys describe the SAME Smart Air HVAC
business, yet they do not collide, so cross-provider phone dedupe still
splits one business into two leads for the common Foursquare/US-local case.

This is a real, **live-observed** collision gap:

- **Live row (12/50 mirrors):** Foursquare `(512) 600-4311` vs OSM numeric
  `15126004311` → two distinct keys → two leads.
- **`TEST-PF-CROSS-001` fixture** reproduces the same row offline.

**Scope constraints honored:**

- Touched no workflow other than the Prospect Finder.
- Modified ONLY `Process FSQ` and `Process OSM` code bodies (plus
  tests/fixtures/docs/artifact re-baseline).
- `Process GPL` and `Cache Dedup Keys` keep their `+` form **by A.12
  scope** — the divergence is documented (this report + §2) and pinned in
  tests, not silently changed.
- No live execution; no container re-import; no sheet cleanup.
- No Prompt B attempt. Fix via spec → builder → re-baseline only.

---

## 2. Decision — Option B (single shared helper, injected), and why

Three shapes were considered:

| Option | Shape | Verdict |
|---|---|---|
| **A. Duplicate a canonical helper into each process body** | Two copies of `normalizePhone` written into Process FSQ and Process OSM separately | Rejected — two byte-identical hard copies invites drift; the A.5 builder exists precisely to kill this class of divergence |
| **B. One helper constant, injected into both bodies via the builder** | `CANONICAL_PHONE_NORMALIZER` defined once in `src/prospect-finder-embedded-code.js` and spread into both node bodies by the builder | **Chosen.** Single source of truth; the builder tech already guarantees byte-identity (Option B was the A.12 prompt's prescribed option) |
| C. Write a shared top-level function referenced by both | n8n Code-node sandbox executes each `jsCode` body in isolation — no shared scope across nodes | Rejected — n8n code nodes cannot share a module scope; the "shared" helper must be physically embedded in each body, which is exactly what Option B does |

**Canonical form shipped** (exact, byte-identical in both bodies — 211
characters, matching the module constant exactly):

```js
function normalizePhone(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1);
  }
  return digits;
}
```

Selected because the **10-digit US local form is the cross-provider
canonical key**: Foursquare already yields 10 digits (`5126004311`), OSM
often yields an 11-digit `1…` E.164 (`15126004311`) that collapses to the
same 10, and GPL-style international numbers keep their country code
(`+44 20 7946 0958` → `442079460958`).

**Scope boundary (pinned, not silently changed):** `Process GPL` keeps
its `+`-keeping phone key (`phone:+15125550301`) and `Cache Dedup Keys`
keeps `+`-form keys (`phone:+15125550101`). A.12 therefore fixes the
FSQ↔OSM cross-provider collision while leaving the provider-joins-cache
`+`-surface exactly as the frozen C-A/C-B baseline documented it. The
residual cross-family `+`↔digits divergence is recorded (this report,
§9) for a future revision.

---

## 3. Changes Applied (spec-first, via the builder)

### 3.1 `src/prospect-finder-embedded-code.js`

1. **New module constant** `CANONICAL_PHONE_NORMALIZER` (7-line array,
   the `normalizePhone` body above) defined once, before `CODE_BY_NODE`.
2. **Process FSQ** — `...CANONICAL_PHONE_NORMALIZER,` injected right
   after the `normalize(value)` helper block (before `normalizeState`);
   the stored value now uses it —
   `const phone = normalizePhone(place.tel);` (was `clean(place.tel)`);
   `buildDedupeKey` phone branch keys on the canonical digits —
   `` return `phone:${normalizePhone(phone)}`; `` (replaces the C-B
   `+`-keeping branch).
3. **Process OSM** — the same `...CANONICAL_PHONE_NORMALIZER,` spread
   replaces the old local `[^\d+]`-keeping `normalizePhone` (old lines
   813–815); `getPhone(tags)` now returns the canonical digits, so the
   stored OSM phone is canonical too. The batch dedupe-phone branch is
   `` `phone:${phone}` `` on an already-canonical value (functionally
   equivalent to re-normalizing: `normalizePhone(phone)` on a canonical
   value is idempotent).

   Net effect in BOTH bodies: a numeric OSM tag `15126004311` becomes the
   string `'5126004311'`; the stored phone is always a string, never a
   number; and FSQ `(512) 600-4311` + OSM `15126004311` dedupe to the
   same `phone:5126004311`.
4. **Exports** — `module.exports = { CODE_BY_NODE, CANONICAL_PHONE_NORMALIZER };`.
5. **Header** — revision note advanced to R8 (Prompt A.12), referencing
   this report.

### 3.2 `src/prospect-finder-workflow-contract.js`

R8 (A.12) header note only. No structural change — the helper lives in the
embedded-code module, which the builder injects into the node parameter
`jsCode`.

### 3.3 Regenerated artifact

```
node scripts/build-prospect-finder-workflow.js
```

Rebuilt once. Double-build verification emitted `IDENTICAL:true` (bytes
`7154B753…5B5A24`, 84,074, both builds).

---

## 4. New Artifact Fingerprint

| Item | Value |
|---|---|
| SHA-256 | `7154B753FA646C80D40AA225D349D05E36FF85438290C0C68DFCDDA5EF5B5A24` |
| Bytes | 84,074 (+347 vs C-B/R8's 83,727) |
| Nodes | 33 (unchanged) / 16 code nodes (unchanged) |
| Δ | Shared canonical `normalizePhone` added to FSQ + OSM only — no node added, removed, or re-typed |

---

## 5. Baseline Anchors Re-baselined (R8 — Prompt A.12)

| Anchor | Action |
|---|---|
| `tests/prospect-finder-builder.test.js` | `ARTIFACT_HASH` → `7154b753…5b5a24`; byte assertion 83,727 → 84,074; header comment → "revision R8, Prompt A.12 — replaces the R8 C-B anchor"; C-B FSQ `+`-kept phone shape pin **replaced** by the A.12 canonical shape pin (asserts `CANONICAL_PHONE_NORMALIZER` source byte-present in both Process FSQ and Process OSM, helpers byte-identical, `phone:${normalizePhone(phone)}` key, C-B branch gone, old OSM `[^\d+]` helper gone); C-B category-id pin kept |
| `tests/prospect-finder-engine.test.js` | `before()` fixture count 6 → 7 (adds `TEST-PF-CROSS-001`); OSM collapse test rewritten (1 item, `['phone:5125550500']`); new `Prompt A.12 single canonical phone normalization (R8)` describe: `normalizePhone` table via `node:vm` over the FSQ body, stored-phone string parity, numeric-OSM-tag collapse, CROSS-001 live mirror, Cache `+` divergence pin |
| `tests/prospect-finder-error-paths.test.js` | lead_id pin → `FSQ-PHONE-5125550101` (matches canonical 10-digit phone) |
| `fixtures/prospect-finder-fixtures.json` | FSQ-001 `raw_dedupe_keys` → `["phone:5125550111","phone:5125550112","phone:5125550113"]` + `dropped_duplicate_phone` `"5125550111"`; OSM-001 `raw_dedupe_keys` → `["phone:5125550201","website:https://bluebonnet.example.com"]`; DEDUP-001 `fsq_dedupe_keys` → `["website:cozyclimateservice.com","phone:5125550402"]` (GPL `+` keys unchanged); **new `TEST-PF-CROSS-001`** added |
| `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` | §6.16 (new), §12.3 R8 (A.12) row + disambiguation note + tail bullet, header status block / artifact block / history line + date |
| `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md` | Header, §8 resume item 3 (new), §9 artifact table, §10 R8 change-log row |
| `src/prospect-finder-workflow-contract.js` | R8 (A.12) header note |
| `REPORT.md` | §9 item 5 → appended A.12 FIXED note |

Point-in-time reports (`PROSPECT-FINDER-A10-…`,
`PROSPECT-FINDER-A11-…`, C-A/C-B, isolation matrix) were **not** edited.

**R8-label disambiguation:** the preflight §12.3 revision log already
held an "R8" row for Prompt C-B (2026-09-16, 83,727 bytes). Per the
user's letter (<record R8 as the A.12 manifest entry, following R1–R7
from A.5 through A.11>), the A.12 revision is recorded as **R8** too.
The C-B row is retained verbatim as history (`R8 (Prompt C-B)` in tests;
this report and the preflight §12.3 note the reuse so readers can
disambiguate). History rows are not renamed.

---

## 6. Tests Added / Updated

**+5 new engine tests, 1 rewritten, several pins updated; all offline; no live HTTP.**

`tests/prospect-finder-builder.test.js` — re-anchored (hash, bytes,
header) + A.12 canonical shape pin **replacing** the C-B `+`-kept pin.
The C-B category-id pin survives unchanged. **21/21 pass.**

`tests/prospect-finder-engine.test.js` — new `Prompt A.12 single
canonical phone normalization (R8)` describe:

- **`normalizePhone` table** — extracts the helper from the Process FSQ
  body and evaluates it via `node:vm` (9 rows): `(512) 600-4311` →
  `5126004311`; `15126004311` → `5126004311`; `+1 (512) 600-4311` →
  `5126004311`; `512-600-4311` → `5126004311`; `''` → `''`; `null` → `''`;
  `undefined` → `''`; numeric `5126004311` → `5126004311`; `+44 20 7946
  0958` → `442079460958`.
- **stored phones are strings** after the FSQ-001 + OSM-001 fixture runs
  (schema parity — no number leaks into `phone`).
- **numeric OSM tag collapses** — `15126004311` → `5126004311` string.
- **`TEST-PF-CROSS-001` live mirror** — FSQ `(512) 600-4311` + OSM
  `15126004311` → ONE verified lead (`phone:5126004311`, source
  FOURSQUARE wins, `dupe_source_pair ["FOURSQUARE","OSM"]`).
- **Cache Dedup Keys `+`-form keys pinned** (`phone:+15125550101`) — the
  documented divergence.

OSM collapse test rewritten accordingly; `before()` fixture count 6 → 7.
**81/81 pass** (engine); engine + error-paths **106/106**.

`tests/prospect-finder-error-paths.test.js` — lead_id pin →
`FSQ-PHONE-5125550101`.

---

## 7. Preflight Report §6.16 + Revision Log

`reports/PROSPECT-FINDER-GPL-PREFLIGHT.md` gained §6.16 (Single canonical
phone normalization, Process FSQ + Process OSM — Prompt A.12 / R8) and
the R8 (A.12) row + disambiguation note + R8 tail-bullet in §12.3, plus
updated header status/date and the canonical artifact block (hash
`7154b753…5b5a24`, 84,074 bytes, history line now runs through
R8/A.12).

---

## 8. Gates

| Gate | Result |
|---|---|
| `npm test` (`node --test "tests/*.test.js"`) | **967 tests, 964 pass, 3 fail** — the 3 failures are all in `tests/gpl-normalization.test.js` (oracle pins expect `target_count` 20/6, get 0) and are **pre-existing**: `src/google-places.js` carries 161 lines of uncommitted working-tree modifications pre-dating A.12. Proven via `git stash push -- src/google-places.js` → file passes **22/22** → `stash pop` restores. A.12 itself adds +5 with **zero regressions** |
| Builder determinism | Byte-identical double build (`IDENTICAL:true`) |
| `npm run verify:frozen` | **10/10 PASS** |
| `node scripts/security-check.js` | **GREEN** (exit 0; no credential change) |
| Artifact hash anchor | Matches on-disk artifact (`7154b753…5b5a24`, 84,074 bytes) |

No gate failed at any point during the revision.

---

## 8b. A.12.2 addendum — fixture reconciliation and C-A residual gate merge (2026-09-16)

The 3 pre-existing failures in §8 (`tests/gpl-normalization.test.js`
oracle pins expecting `target_count` 20/6, got 0) were **resolved** by
A.12.2 fixture reconciliation — fixtures re-pinned to the
gate-carrying oracle with valid US `formattedAddress` / US-state rows
(`123 Test St, Dallas, TX 75201, USA`, `123 Dallas St, Dallas, TX
75201`) so `Gate B (geo)` no longer drops them; plus new gate A/B/C
unit tests (`rejectPatterns`, `normalizeState` / `STATE_ALIASES`,
`extractGeo`, Gate A relevance, Gate B geo, Gate C no-contact, counter
accumulation).

The C-A GPL business-logic gates (which existed in `src/google-places.js`
since pre-A.12 but were never committed) were mirrored into the
embedded `Process GPL` body (`src/prospect-finder-embedded-code.js`) so
the shipped artifact behaves identically offline and live. Gate logic is
purely additive — nothing weakened.

**Final fingerprint:** `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511`, 88,253 bytes (33 nodes / 16 code nodes). Full suite **987/987** (92 suites), `verify:frozen` 10/10, builder determinism byte-identical, artifact LF-only (`*.json text eol=lf` `.gitattributes` CRLF guard).

This completes the A.12 workstream — see `PROSPECT-FINDER-GPL-BUSINESS-LOGIC-GATE-V1.md` for full gate-implementation details.

---

## 9. Residual Risk (out of A.12 scope)

- **`+`-form surface not touched.** `Process GPL` (`phone:+15125550301`)
  and `Cache Dedup Keys` (`phone:+15125550101`) keys retain the `+` form.
  FSQ↔OSM cross-provider collision is now fixed; a future revision may
  extend the canonical form to the cache/GPL family (or make Cache
  Dedup Keys consume the verified-lead dedupe keys directly) so
  cross-family phone dedupe also collides.
- **§6.5 (`errorMsg` precedence bug in Process GPL)** remains open from
  preflight — unchanged.
- **OSM-error double-loop-back defect (§6.15 / C-A report §14.4)**
  remains deferred — unchanged.
- **Live re-import still pending.** The fix is validated offline and in
  the artifact, but the container `serene_swartz` still holds a
  pre-A.12 workflow. Re-import + credential re-attach are operator
  tasks before any future Prompt B run.
- **External blockers unchanged** (§7 of the closure doc): GCP billing
  frozen, FSQ token invalid, Overpass 504 on load.

---

## Completion State

A.12 is complete: the cross-provider phone normalization gap (FSQ
`(512) 600-4311` vs OSM `15126004311` splitting one business into two
leads) is closed through the canonical spec and rebuilder — one shared
`CANONICAL_PHONE_NORMALIZER` now byte-identical in both Process FSQ and
Process OSM, applied to the stored phone AND the dedupe key. The
artifact is re-baselined at R8 (Prompt A.12), tests/docs/fixtures are
updated (incl. the new `TEST-PF-CROSS-001` live mirror), all gates are
green, and the work stops here — no live execution, per scope. The next
step is an operator task (re-import + credentials), not code.