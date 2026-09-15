# Phase 5.3 Report — Live Runner Sheets URL Construction Fix

**Status:** PASS — PHASE 5.3 COMPLETE, PHASE 6 RE-READY

**Date:** 2026-09-13

---

## 1. Objective

Implement Phase 5.3 — fix the live runner's Google Sheets URL construction in `src/google-sheets-client.js`: (1) a `--allow-non-pinned-sheet` run configured with a full spreadsheet URL must resolve to the bare spreadsheet id, and (2) the A1 range separator must be `!`, not `.`. Add a dedicated URL-construction test file, re-run all gates, decide the frozen-manifest action, and stop after Phase 5.3 (no Phase 6, no Phase 7, no live n8n).

---

## 2. Defects Confirmed (Before)

### Bug 1 — `spreadsheetId` received a full URL instead of a bare id

The runner passes `GOOGLE_SHEET_ID` verbatim into the Sheets client. Trace:

- `readConfig(env)` (`src/response-interpretation-live-runner.js:135`): `googlesheetId = String(env.GOOGLE_SHEET_ID || '').trim()`.
- `clientFor(env)` (`src/response-interpretation-live-runner.js:280-296`): `new GoogleSheetsClient({ spreadsheetId: config.googlesheetId, ... })`.
- Constructor (`src/google-sheets-client.js`): `this.spreadsheetId = spreadsheetId;` stores whatever was passed with no validation.

Under `--allow-non-pinned-sheet` the operator legitimately configures `GOOGLE_SHEET_ID` with the share URL, so the full URL flowed straight into the request path. The captured malformed URL:

```
https://sheets.googleapis.com/v4/spreadsheets/
  https://docs.google.com/spreadsheets/d/1KN-mAYQ.../edit
  /values/'Response%20Log'.A1%3AAZ
```

### Bug 2 — `quotedRange` used `.` instead of `!`

`quotedRange(tabName, rangeSuffix = 'A1:AZ')` returned `'${tabName}'.${rangeSuffix}`. A1 notation requires `'<tab name>'!<range>`; the `.` separator is invalid, so the `/values/...` segment was malformed.

### Confirmation

A working manual call against the same sheet confirms both defects — bare id, `!` separator, encoded range:

```
.../v4/spreadsheets/<bare-id>/values/'Response%20Log'!A1:L1
```

---

## 3. The Correction (After)

### Fix 1 — `normalizeSpreadsheetId` (pure, deterministic, no network)

New function in `src/google-sheets-client.js`, called from the constructor boundary so **every** construction path (`clientFor`, `fromEnv`, direct) is normalized:

- Bare id (`^[A-Za-z0-9_-]+$`) passes through unchanged (the pinned engine id is a bare id; zero behavior change for pinned runs).
- Full Google Sheets URL `https://docs.google.com/spreadsheets/d/<id>` — with `/edit` suffix, no suffix, or `#gid=` fragment (`/^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:[\/?#]|$)/`) — reduces to the captured bare id.
- Input is trimmed first; empty/null and strings that are neither a bare id nor a `docs.google.com/spreadsheets/d/...` URL throw a clear `GoogleSheetsError` (status 400).
- No network, no extra parsing dependency, no public API change beyond accepting both forms.

### Fix 2 — `quotedRange` separator

- `.` → `!` (`'Response Log'!A1:AZ`).
- Embedded single quotes in tab names are escaped by doubling (`'It''s Done'`), the documented A1 quoting rule.
- Default span preserved: `A1:AZ` (unchanged; only the separator was wrong).

### Fixed request URL form

`listRows` / `appendRows` keep `encodeURIComponent` over the quoted range, so the built URL is:

```
https://sheets.googleapis.com/v4/spreadsheets/<bare-id>/values/%27Response%20Log%27%21A1%3AAZ
```

(no nested URL, no `.` separator — the canonical encoded form of `'Response Log'!A1:AZ`).

---

## 4. Diff Confinement

`git diff` for this phase (n8n-lead-recovery scope) is **exactly**:

- `src/google-sheets-client.js` — 2 new constants, `quotedRange` fix (+ quote escaping), new `normalizeSpreadsheetId`, constructor calls the normalizer, exports extended with `quotedRange` and `normalizeSpreadsheetId` (additive; `GoogleSheetsClient`, `GoogleSheetsError`, `mintJwt`, `base64Url` preserved).
- `tests/google-sheets-url.test.js` — new file (14 tests).
- `.env.example` — 2-line doc note that `GOOGLE_SHEET_ID` may also be a full spreadsheet URL (extracted to the bare id; primarily for `--allow-non-pinned-sheet` runs).

No frozen artifact was touched (see §9-§10).

---

## 5. Regression Tests (`tests/google-sheets-url.test.js`, new; 14/14 PASS)

All use a **synthetic example id** (`AbCdEf123456-_AbCdEf123456-_Ab`) — no real spreadsheet id or credential material appears in the test file.

| # | Test | What it proves |
| --- | --- | --- |
| 1 | bare id passes through unchanged | no regression for pinned runs |
| 2 | whitespace-trimmed bare id | trim before validation |
| 3 | full `/edit` URL → bare id | Bug 1 fix |
| 4 | URL with no suffix → bare id | Bug 1 edge |
| 5 | URL with `#gid=` fragment → bare id | Bug 1 edge |
| 6 | empty / null / invalid inputs throw `GoogleSheetsError` 400 | clear failure, never a malformed request |
| 7 | `quotedRange` emits `!`, not `.` | Bug 2 fix |
| 8 | default range span is preserved (`A1:AZ`) and explicit `A1:AZ` is unchanged | span not altered |
| 9 | single quotes inside tab names escaped (`'It''s Done'`) | A1 quoting rule |
| 10 | client constructed with a full URL normalizes to bare id | constructor boundary fix |
| 11 | client constructed with a bare id keeps it unchanged | no regression |
| 12 | runner `clientFor` + `--allow-non-pinned-sheet` URL builds the bare-id values URL (offline, `_request` stubbed) | end-to-end URL construction, no network I/O |
| 13 | runner client `appendRows` builds the bare-id `:append` URL | write-path construction |
| 14 | regression — the captured malformed URL pattern (nested URL, `.` separator) cannot be produced | Bug 1 + Bug 2 fixed together |

Tests 12-13 exercise the real `GoogleSheetsClient` URL builders through `clientFor` with a stubbed `_request`, so URL string construction is asserted against the actual code path with zero network calls.

---

## 6. Full Test Gate

`npm test`: **748/748 PASS, 0 fail** (46 suites) — the 734-test Phase 5.2 baseline plus the 14 new URL-construction tests. No regressions across engine, contract, embedded mirrors, capture/reconcile suites, or the live-runner suite.

---

## 7. Frozen Integrity Gate

`node scripts/verify-frozen.js`: **PASS — 7/7** artifacts SHA-256 verified.

All 7 frozen artifacts are byte-identical to their manifest baselines:

| Frozen artifact | SHA-256 |
| --- | --- |
| `src/response-interpretation.js` | `1e3341dbeb02800d21cc69ea1a4648ef196f0982ce2ee98e11fde2c3c6afe401` |
| `src/response-interpretation-workflow-contract.js` | `7bfb4715ab9ba2d340e5a01a3d5383044a549c1ee2d8d7dace2e060618218115` |
| `src/embedded-response-interpret.js` | `8d56121734094e3e9f14d0a8ab1f82db76d7b7b45f81e115753535acf0d7894c` |
| `src/response-interpretation-live-runner.js` | `ecf46417d700d87cefa99efa4fd37f2e9ec35e6b9f8680578303837111989f68` |
| `Response-Interpretation V1.json` | `57b80b947fe0d08054285590ffe8ea2d5ef225bdc8e8daad79c0eae7470e2dce` |
| `src/response-capture.js` | `83407df33c2f5b9f88185162480bb7abda600c9d43b79e345007ab1b8ab0f779` |
| `src/response-reconcile.js` | `7554973cbab19f7e68cdf363833bd34f6518843b05ce46d597a6a16dad0a6131` |

Confirming the bug was fully contained in the client: the runner's `readConfig`→`clientFor` pass-through is unchanged (the DNS/URL resolution now happens in the client constructor boundary).

---

## 8. Manifest Decision (`frozen-artifacts.manifest.json`)

**No manifest changes were made — stated explicitly, not silently.**

- `src/google-sheets-client.js` (the only code file changed) is **not** among the 7 frozen artifacts, so no artifact entry applies to it.
- `src/response-interpretation-live-runner.js` (frozen) was **not modified** — same hash `ecf46417d700d87cefa99efa4fd37f2e9ec35e6b9f8680578303837111989f68`.
- No revision entries and no artifact entries were added to the manifest v2, and its `about` text was not amended.
- `verify:frozen` still passes 7/7, demonstrating the manifest and the working tree are consistent.

---

## 9. Secret Scan

Scanned the modified/new files (`src/google-sheets-client.js`, `tests/google-sheets-url.test.js`, `.env.example`) for secret-shaped literals (`sk-*`, Google `AIza*`, `AKIA*`, `ya29.*`, PEM/private-key blocks, `ghp_*`) and for the real pinned spreadsheet id (`1KN-mAYQ…`): **no matches** (the pinned id never appears in the new test file — only the synthetic `AbCdEf123456-_AbCdEf123456-_Ab`). No credentials introduced in code or tests.

---

## 10. Unchanged Surfaces (Constraints Honored)

- Engine, embedded mirror, Capture, Reconcile, live runner, workflow contract, and shipped JSON are **byte-identical** to their manifest baselines.
- Preflight gates (A-E), execution backend (cli/http), exit-code contract, and namespace/cleanup logic are untouched.
- No hand-editing of any generated artifact; the only class `SHEETS_API` URL construction changed is the client's `values`/`:append` builders.
- No live n8n invoked, no Phase 6 scenarios ran, no Phase 7 work started. The Foursquare hardcoded key (Prospect Finder, pre-existing) was not touched.
- Runner behavior for pinned runs is unchanged: the pinned id is a bare id and passes the normalizer through unaltered.

---

## 11. Next Move / Phase 6 Readiness

Phase 5.3 is complete; nothing in the runner, artifact, or preflight path changed, so Phase 6 readiness is unchanged:

1. **Re-import** `Response-Interpretation V1.json` (hash `57b80b94…`) into container `serene_swartz` workflow `gLzXBltBMeVcUIEN` (the corrected single-slot Manual Trigger source; the extra non-pinned-run setup now works with either a bare id or a share URL in `GOOGLE_SHEET_ID`).
2. Provide `GOOGLE_ACCESS_TOKEN` and `N8N_API_KEY` to close environment gates E3/REST.
3. Re-run Phase 6 live scenarios (A–F) with `RESP_INT_EXEC_BACKEND=cli`, `RESP_INT_EXEC_CONTAINER=serene_swartz`, `RESP_INT_EXEC_BROKER_PORT=5677`, evidence capture, redaction, and `TEST-RESP-INT-LIVE-*` cleanup.

## Completion Verdicts

- `PASS — PHASE 5.3 COMPLETE, PHASE 6 RE-READY` — both URL defects fixed at the client boundary, 14 new regression tests, suite 748/748, verify:frozen 7/7, secret scan clean, manifest correctly left untouched.
- `PARTIAL — PHASE 5.3 INCOMPLETE` — not applicable; all deliverables done.
- `FAIL — PHASE 5.3 BLOCKED` — not applicable; no blockers within Phase 5.3 scope.