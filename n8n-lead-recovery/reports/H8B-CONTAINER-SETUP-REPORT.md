# H.8b Report — Engine-Direct Enrichment Runner

**Date:** 2026-09-18
**Status:** Runner shipped + verified offline; **dry-run preflight blocked by missing operator env** (NOT_CONFIGURED, exit 3 — by design). No sheet writes performed; per H.8b, STOP after the report.

---

## 1. What shipped

`scripts/run-enrichment-live.js` drives the frozen engines
(`src/enrichment-contact.js` + `src/enrichment-contact-oss.js`) directly against
the production sheet, using the same column contracts and consolidation rules as
the shipped `Enrichment V1.json` workflow — so live results stay byte-consistent
with the artifact.

### Runner defect fixes (this phase)

1. **Broken tail removed** — the `module.exports = { APP }` placeholder block is
   gone; the runner loads (`node -e require(...)` → LOAD OK) and `--help` works.
2. **Three `writeRunReport` wrapper defects** on the FAIL / NOT_CONFIGURED /
   sheet-read-fail paths in `runEnrichment` now write the **redacted** report
   (`report.redacted`) and return it, instead of the `{redacted, raw}` envelope.
3. **CLI exit code honored** — the entrypoint previously dropped `main`'s return
   value and always exited `0`; it now sets `process.exitCode` from `main`, so
   `0 PASS / 1 FAIL / 3 NOT_CONFIGURED` are real.

## 2. Immutable guards (verified by tests)

- **Default DRY_RUN**; no `--allow-production-writes` exists. Writes only under
  `--execute`.
- **Namespace guard:** log append, `cache_hit_count` (M) write-back, and Approved
  Outreach V/W updates are written only for `lead_id`s under
  `TEST-ENRICH-LIVE-<tag>` (`^TEST-ENRICH-LIVE-[0-9a-f]{8,32}-`). Production leads
  are enriched + reported as *would-append / would-update* but never written.
- **Approved Outreach writes are V/W only:** `contact_blocked` (V) and
  `contact_source_provider` (W) — A–U never written.
- **Log writes:** append A–N only; cache-hit write-back on M only.
- **Preflight** aborts before any read/enrich/write on missing columns, no auth,
  no provider key, or unconfigured env.

## 3. Offline verification

`tests/enrichment-live-runner.test.js` — **46 tests, all green** (offline;
MockSheets + injected transport/resolver/now):

- Export surface & canonical constants
- `parseArgs` / `readConfig` (agentdata, hunter, service-account, TTL/min-score)
- Namespace helpers + classification priority (non-us → no-domain →
  already-enriched → blocked → out-of-scope)
- Preflight pass/fail incl. exact missing-column reporting
- Dry-run pipeline: exclusions, credits, cache-hit (provider never called),
  cross-run determinism, zero writes
- Execute pipeline: log append, OSS fallback, manual block, V/W-only cell map
  (`!V4` + `!W2/W3/W4`), production-lead guard, cache-hit M write-back
- `updateValues` authenticate + bearer PUT cells
- OSS resolver envelopes incl. installed `@absolutejs/enrich` (discovery-only,
  never scores ≥ minScore)
- Redaction: no secrets / raw emails in reports; CLI exit-code wiring

## 4. Gates (all green)

| Gate                     | Result                                    |
| ------------------------ | ----------------------------------------- |
| `npm test`               | 1188 / 1188 pass                          |
| `npm run verify:frozen`  | PASS — 24 frozen artifacts SHA-256 match  |
| `npm run enrichment:security` | Clean — no keys/creds/bearer patterns |

## 5. Dry-run preflight result (NO `--execute`)

```
$ node scripts/run-enrichment-live.js --limit=3 --no-interactive
RESULT: NOT_CONFIGURED
stages: preflight=NOT_CONFIGURED
exit code: 3
```

`reports/ENRICH-LIVE-1a0b362ae6e-6aace610-enrichment-live.json` written to the
repo reports dir; verified UTF-8, redacted, no secrets, correct shape.

## 6. Open items (operator action required — H.8b stops here by design)

1. **Env not set on this host:** `GOOGLE_SHEET_ID`, `GOOGLE_ACCESS_TOKEN` (or
   `GOOGLE_SERVICE_ACCOUNT_JSON`), and `AGENTDATA_API_KEY` (or
   `HUNTER_API_KEY` + `ENRICHMENT_PROVIDER=hunter`) → runner correctly exits 3.
2. **Sheet header verification pending (carried from H.8a PARTIAL):** once env is
   set, run the preflight again (`npm run enrichment:run -- --limit=3
   --no-interactive`) and confirm `Contact Enrichment Log` head starts exactly at
   `Contact Enrichment Log` (A2) with A–N headers, and `Approved Outreach` A–W.
   Any mismatch is reported by the runner as an exact missing-column list.
3. No live enrichment, no `--execute` run, and no H.9 until the operator signs
   off the env + headers above.