# Phase 6 Re-Run Report — Response Interpretation V1 Live Execution (CLI Backend)

**Status: FAIL — PHASE 6 BLOCKED (hard gate: runner Sheets auth unset) + STRUCTURAL — headless `n8n execute` does not complete the workflow**

**Date:** 2026-09-12
**Runner used:** `src/response-interpretation-live-runner.js` (Phase 5 revision `d5d20af`, frozen — **not modified this session**)
**Live n8n executions performed:** 2 (both real, both read-only; evidence below)

---

## 1. Environment gate result — PARTIAL (most gates now satisfiable)

n8n IS provisioned and verified live (authoritative container DB, read-only):

- n8n `serene_swartz` running (image n8nio/n8n, **v2.38.7**, port 5678 → host).
- Workflow `gLzXBltBMeVcUIEN` present in DB, `active: 0`, name `Lead Recovery Engine — Response Interpretation V1` (single workflow in DB).
- Credential bound: `googleSheetsOAuth2Api` id `Q2J6wmozbkk3NCTM` ("Google Sheets account") attached to the `Read Response Log` node.
- Workflow precondition (Phase 4 contract) re-asserted **live** from the DB: 5 nodes with exact IDs/types (Manual Trigger, Read Response Log [googleSheets v4 read], Read Reconciliation Report [code v2], Interpret Responses [code v2], Response Interpretation Complete [noOp]), zero write nodes, zero provider/AI/webhook/scheduler nodes, one Sheets read. The task's §5 REST re-assert (`GET /api/v1/workflows/gLzXBltBMeVcUIEN`) returns **401** (reachable, key required) — `N8N_API_KEY` is not present in the session, so the DB read is the authoritative equivalence.

Runner-side session env at execution time:

| Variable | Status |
| --- | --- |
| `RESP_INT_EXEC_BACKEND` | `cli` (set) |
| `RESP_INT_EXEC_CONTAINER` | `serene_swartz` (set) |
| `RESP_INT_EXEC_BROKER_PORT` | `5677` (set) |
| `N8N_WORKFLOW_ID` | `gLzXBltBMeVcUIEN` (set) |
| `GOOGLE_SHEET_ID` | pinned `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ` (set; E2 match = pinned sheet confirmed intended) |
| `GOOGLE_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON` | **UNSET** |
| `N8N_API_KEY` | **UNSET** |
| `N8N_BASE_URL` | UNSET (unneeded: backend=cli) |
| `RESP_INT_LIVE_RUN_TOKEN` | fixed hex `a3f0c2d9e8b17d46` (deterministic, valid) |

Preflight (CLI mode, `--no-interactive`, pinned sheet): **1 hard gate FAIL — `E3 auth configured`**.
All other gates PASS (A shipped workflow contract, D namespace, D2 informational, E sheet present, E2 matches pinned, F tab explicit, H 27 fixtures, I contiguous, informational n8n-execution-configured). E3 is the single hard-environment gate still open.

## 2. Scenarios A–F — explicit results

Every scenario evaluated through the live CLI path. **All six: `NOT_CONFIGURED`** (never a fabricated PASS). Two distinct causes: (i) the environment gate E3 (runner Sheets auth) prevents seed/verify/cleanup for scenarios requiring rows; (ii) **structure**: the shipped workflow cannot reach `Interpret Responses` under headless `n8n execute` (evidence below), so no scenario can produce the collected Interpret output to compare.

| # | Scenario | Seed rows required | Seed | Execute | Collect | Result |
| --- | --- | --- | --- | --- | --- | --- |
| A | healthy populated | fixture rows | NOT_CONFIGURED (E3) | NOT_CONFIGURED (stall) | NOT_CONFIGURED | NOT_CONFIGURED |
| B | healthy empty | none | SKIPPED (none required) | NOT_CONFIGURED (stall) | NOT_CONFIGURED | NOT_CONFIGURED |
| C | Response Log read failure | none (trigger metadata) | SKIPPED | NOT_CONFIGURED (stall + no injection) | NOT_CONFIGURED | NOT_CONFIGURED |
| D | reconciliation read failure | none (trigger metadata) | SKIPPED | NOT_CONFIGURED (stall + no injection) | NOT_CONFIGURED | NOT_CONFIGURED |
| E | upstream INCOMPLETE report | fixture rows | NOT_CONFIGURED (E3) | NOT_CONFIGURED (stall + no injection) | NOT_CONFIGURED | NOT_CONFIGURED |
| F | double failure | none (trigger metadata) | SKIPPED | NOT_CONFIGURED (stall + no injection) | NOT_CONFIGURED | NOT_CONFIGURED |

## 3. Live execution evidence

Probe executes (real `n8n execute`, read-only — the workflow only reads the Response Log tab; 0 rows read):

| Run | argv | workflow id | started_at (UTC) | exit | stdout |
| --- | --- | --- | --- | --- | --- |
| runner probe | `docker exec -u node -e N8N_RUNNERS_BROKER_PORT=5677 serene_swartz n8n execute --id gLzXBltBMeVcUIEN` | gLzXBltBMeVcUIEN | 12:48:57.370 | 0 | `n8n Task Broker ready on 127.0.0.1, port 5677` + execution JSON; runData = `Manual Trigger` (1 item), `Read Response Log` (0 items); `lastNodeExecuted: Read Response Log`; no error |
| raw probe | same argv + `--rawOutput` | gLzXBltBMeVcUIEN | (same window) | 0 | same structure |

Runner report: `reports/RESPINT-LIVE-a3f0c2d9e8b17d46-response-interpretation-live.json` records
`execution: { backend: cli, workflow_id, container: serene_swartz, broker_port: 5677 }`, `started_at 12:48:57.370Z / completed_at 12:49:06.067Z`, `mode DRY_RUN`, stages execute/collect NOT_CONFIGURED. Broker port fix works (broker bound 5677, no 5679 collision) — the CLI backend genuinely executes the workflow.

## 4. Reconciliation-artifact injection — mechanism confirmed present, cannot be driven by cli

- `injectedTriggerInputFor(...)` exists (Phase 5) and supplies `{ event, reconciliation_report, response_log_read_error, reconciliation_read_error }` through the Manual-Trigger boundary. That is the only injection path in the workflow (`Read Reconciliation Report` is a **code** node reading `$('Manual Trigger').all()`).
- **cli mode has no injection channel**: `n8n execute --help` exposes only `--id`, `--rawOutput`, `--file` (deprecated). No per-run input flag. So the boundary always resolves to default `{ status: 'COMPLETED', results: [] }` and empty read errors.
- Additionally (worst), headless `n8n execute` **does not even start** the un-rooted `Read Reconciliation Report` node (it has no incoming connection and is not the trigger), so `Interpret Responses` never receives its report input and never executes (live: `lastNodeExecuted: Read Response Log`).
- Consequences: scenarios C (read failure), D (reconciliation read failure), E (INCOMPLETE), F (double failure) cannot be induced via cli — no way to inject the read-error/report metadata. A (healthy populated) also cannot produce canonical evidence because the required reconciliation report cannot be injected (and E3 blocks seeding). B (empty) still cannot complete because Interpret never runs.

## 5. Live output origin and comparison method

- Live output WAS produced by the real `n8n execute` run (not the pure engine) — but it stops at `Read Response Log` (0 rows; the Response Log tab is currently empty). No Interpret output exists in any live run, so no comparison is claimed.
- The comparison path (expected = `stripRuntime(engineBehaviorFor(projectedFixtureFor(...)))`) is intact and unit-tested; it simply has nothing to compare against.

## 6. Comparison results vs canonical Phase 3/4 expectations

None performed — there is no collected Interpret output. No fabricated comparison.

## 7. Cleanup results and namespace safety

No `TEST-RESP-INT-LIVE-a3f0c2d9e8b17d46-*` rows were seeded (E3 gate), so nothing exists to clean. Namespace guards re-asserted by the 663-test suite. Prior-phase artifacts in `reports/` are local evidence, not sheet rows.

## 8. Security results

- No code changed this session (runner, engine, contract, embedded mirror, workflow, tests untouched — frozen hashes below). Two temporary diagnostic scripts lived in the OS temp dir only.
- Report artifacts scanned for secret-shaped literals (`AIza…`, `sk-…`, `AKIA…`, `ya29.…`, key names, PEM): **GREEN**.
- Foursquare key not touched (separate workstream, per instructions).

## 9. Frozen integrity (hashes)

`npm run verify:frozen` → **PASS: 7 frozen artifact(s) verified (SHA-256 match)**. Manifest v2; runner hash `ecf46417d700d87cefa99efa4fd37f2e9ec35e6b9f8680578303837111989f68` matches. No artifact modified.

## 10. Baseline preservation (663/663)

`npm test` → **663/663 PASS, 0 fail** (Node `--test`, 29 suites). Zero regressions. No live execution is part of `npm test`.

## 11. Known limitations

1. **E3 runner Sheets auth unset** (GOOGLE_ACCESS_TOKEN / GOOGLE_SERVICE_ACCOUNT_JSON) — required for seed/verify-seed/cleanup and preflight hard gate; operator-supplied per runbook.
2. **STRUCTURAL: headless `n8n execute` cannot complete this workflow.** n8n 2.38.7 `n8n execute --id` starts only the trigger-rooted chain; the un-rooted `Read Reconciliation Report` code node is never started, so `Interpret Responses` (which needs both inputs) never runs. `lastNodeExecuted: Read Response Log`, exit 0, no error.
3. **cli mode cannot inject the Manual-Trigger boundary** — no input flag exists; read-error/report scenarios (C/D/E/F) and canonical A evidence cannot be produced via cli.
4. `N8N_API_KEY` absent → §5 REST re-assert returned 401; container-DB read used as the authoritative equivalence (node ids/types/creds/active all match).
5. Response Log tab currently empty (0 rows) — scenario-B seeding cannot start until E3 closes.

## 12. Phase 7 readiness

Not ready for a live-validation-based Phase 7: no live Interpret output exists (all six scenarios `NOT_CONFIGURED`). Artifact-side readiness unchanged. Unblock options for the operator (none executed here):
A. Accept Phase 6 as blocked/partial for the cli backend (this report).
B. Authorize a targeted runner change so the cli backend completes the workflow (currently out of scope: "do NOT rebuild the Phase 5 runner").
C. Provision an n8n instance/endpoint exec "run" for manual-trigger workflows → canonical injection via the `http` backend.
D. Drive each scenario manually in the n8n UI with trigger boundary values and export the execution (requires UI session credentials; collection would need a collector change).

---

## Verdict

```
FAIL — PHASE 6 BLOCKED
```

Precise cause: (1) hard environment gate **E3 (runner Sheets auth) fails**, and (2) proven **structural** block — under the shipped cli backend, `n8n execute` never reaches `Interpret Responses` (live evidence: `lastNodeExecuted: Read Response Log`), and the Manual-Trigger boundary cannot be injected headlessly. Every scenario A–F is explicitly `NOT_CONFIGURED`; no live PASS is claimed; no comparison is fabricated. Security, frozen-integrity, and baseline gates are all green (663/663, 7/7).