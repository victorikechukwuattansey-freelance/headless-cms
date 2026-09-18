# H.8b.1 Report — Preflight Observability Fix

**Date:** 2026-09-18
**Status:** PASS — PREFLIGHT SELF-DIAGNOSES (underlying runner defect fixed);
operator re-run on the configured host required to confirm a full PASS against
the live sheet (this session's shell does not inherit the set env vars).

---

## 1. Preflight check inventory

`preflight()` in `scripts/run-enrichment-live.js` runs, in order:

| # | Check | Asserts | PASS | FAIL |
|---|-------|---------|------|------|
| B | config present | `isConfigured(config)` (all required env present) | status `CONFIGURED` | missing env var list |
| C | sheet auth | `config.auth.ready` | token OR service-account present | `no Google Sheets auth configured` |
| D | Approved Outreach columns | header contains every `PREFLIGHT_APPROVED_COLUMNS` name | all present | exact `MISSING: ...` list |
| E | Contact Enrichment Log columns | header contains every `ENRICHMENT_LOG_COLUMNS` name | all present | exact `MISSING: ...` list |
| (D/E) | sheet reads | sheets reachable | — (D+E emitted) | error or `no Sheets client available` |
| F | provider | requested provider in `VALID_PROVIDERS` | provider name | offending value + allowed list |
| G | provider key | provider API key set | `set` | `unset (provider calls would fail)` |
| H | namespace well-formed | `TEST-ENRICH-LIVE-<tag>` shape | ok | informational only (never hard-fails) |

Aggregation: `hard = checks.filter(c => !c.informational && !c.ok)` →
`status = hard.length ? 'FAIL' : 'PASS'`. The report flag is a single aggregate
`preflight_status`; per-check detail now lives in the new `preflight_detail`.

## 2. The specific check that was failing

**`D/E sheet reads` — `no Sheets client available`.**

## 3. Root cause: runner defect

`runEnrichment` called `preflight(env, args, deps)` **before** building the Sheets
client (`const client = await clientFor(...)` came after the preflight FAIL
branch). With no `deps.client`, check D/E unconditionally pushed
`{ ok: false, detail: 'no Sheets client available' }` → hard FAIL → return before
any network call. Explains the <1ms synchronous failure and confirms it was NOT
a config/network/sheet issue: **B/C/F/G all passed; D/E could never run.**

## 4. Fix applied (code)

- The Sheets surface is now built **before** preflight (only when config is
  `CONFIGURED`) and injected via a deps clone `{ client, clientError }`.
  A client-construction failure (e.g. bad service-account path, malformed sheet
  id) is captured as `clientError` and reported as the D/E check detail.
- Preflight FAIL now sets `failure_info` to the specific failing check, e.g.
  `preflight failed: D/E sheet reads (ENOENT: ... no Sheets client ...)`.
- Report gains one new public field: `preflight_detail`
  (`[{name, ok, informational, detail}, ...]`).
- Check F names the offending provider value
  (`provider "bogus" invalid; must be one of agentdata|hunter`).

## 5. New test count

6 tests added (preflight named-per-check shape; bad provider fails F by name;
report `failure_info` names the check; missing-column FAIL names D; PASS reports
carry `preflight_detail` all-ok; client-construction failure named as D/E).
Runner suite: **52/52**. Added test count total: **1194** (was 1188).

## 6. Gates

| Gate | Result |
| --- | --- |
| `npm test` | 1194 / 1194 pass, 0 fail |
| `npm run verify:frozen` | PASS — 24/24 SHA-256 |
| `npm run enrichment:security` | exit 0 — GREEN (no creds/keys/bearer patterns in Enrichment V1.json; Prospect Finder shows only its expected `$env:` references) |

(`npm run security-check` does not exist in this repo; the equivalent gate is
`enrichment:security`, used above.)

## 7. Dry-run preflight result

- This shell has no operator env (this session never inherited it), so the host
  dry-run is `NOT_CONFIGURED` (exit 3) — correct, unchanged.
- Deterministic CLI proof of the fix (service-account path nonexistent):
  `RESULT: FAIL`, `failure: preflight failed: D/E sheet reads (ENOENT: ...)`,
  `preflight_detail` lists all 6 checks with per-check `ok`/`detail`
  (`reports/ENRICH-LIVE-1a0b37b70f1-6aacec67-enrichment-live.json`).
- Operator action required on the machine where env IS set:
  `npm run enrichment:run -- --limit=3 --no-interactive`. Expected: D (23-col
  Approved Outreach) and E (A–N log) pass against the verified headers, then the
  stated 6-stage pipeline runs. If any header is missing the runner now names it
  exactly. Note: the manual header sheet order claimed in the prompt
  (V=contact_source_provider, W=contact_blocked) is the REVERSE of the shipped
  schema (V=`contact_blocked`, W=`contact_source_provider`); preflight only
  verifies header names present, so both orders pass D — the operator should
  confirm the live sheet matches the shipped schema orientation before
  `--execute` (runner writes provider→W, blocked→V only).

## 8. Explicit no-op guarantees

- No workflow artifact modified.
- No `src/enrichment-*.js` engine module modified.
- No schema modified.
- No frozen manifest touched.
- No `--execute` run performed.
- Public report shape changed only by ADDING `preflight_detail`.