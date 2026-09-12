# Hygiene Workstream Report — H1–H7 (n8n-lead-recovery)

**Status: PASS — HYGIENE WORKSTREAM COMPLETE**

**Date:** 2026-09-12
**Scope:** `n8n-lead-recovery/` + `.github/workflows/test.yml` (git root) + this report.
**Previous state of record:** Phase 6 = `FAIL — PHASE 6 BLOCKED (environment gate)`
(`reports/PHASE-6-response-interpretation-v1.md`). Not un-blocked here; that requires a
live environment (see `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md`).

This report is the **definitive, superseding hygiene report**. It supersedes ad-hoc
reports and escalation notes for the hygiene workstream; it does **not** overwrite any
spec/artifact doc (Phase 6 report, workflow specs, harness docs all remain intact).

---

## 1. H1 — Phase 6 environment runbook: PASS

- New `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` documents: the 9 env vars with exact
  semantics, PowerShell export without plaintext echo, n8n install/start/import/workflow-id
  steps, spreadsheet + OAuth setup (pinned `SPREADSHEET_ID`; `--allow-non-pinned-sheet`
  is non-live-equivalent), scenario A–F re-run commands via the Phase 5 runner, and exit
  codes (0 PASS / 1 FAIL / 2 unknown / 3 NOT_CONFIGURED / 4 CLEANUP_NOT_PERFORMED).
- Ground truth came from the frozen runner (`src/response-interpretation-live-runner.js`
  usage text) and Phase 6 report — never guessed.

## 2. H2 — Foursquare bearer token removed: PASS

- **Method:** replaced the hardcoded `Authorization: Bearer 3VHR…G4` header on the
  `Foursquare Places API` node (Prospect Finder) with a named n8n `httpHeaderAuth`
  credential reference (`name: "Foursquare API"`, value `=Bearer {{$credentials.value}}`).
  No topology, Overpass, OSM, connections, node order, or workflow identity changed
  (26 nodes / 25 connections preserved, `active:false` preserved).
- **Docs updated:** `APPROVED-OUTREACH-HANDOFF-v0.1.md` (Open Risks) and
  `GOOGLE-SHEETS-VERIFICATION-HARNESS-v0.1.md` (Credentials and Secrets) now describe the
  credential mechanism; README rebase (H4) removed the last Google-Places-era key notes.
- **Literal scan:** the former token string and every credential-shaped pattern now appear
  **only** inside the frozen `redact()` detector + its test fixtures (intentional pattern
  constants) and a doc note that does not quote the token. No real secret anywhere.

## 3. H3 — Git hygiene / logical commits: PASS

- Root `.gitignore` already excluded `.env*`/`node_modules`; project `.gitignore`
  extended (`.env*` kept `!.env.example`, `reports/`, `*.log`, `*.tmp`).
- Committed scoped, logical commits (no `git add -A`), all on `pre-cleanup-2026-09-08`:

  | Commit | Contents |
  | --- | --- |
  | `a21fd9a` | H2: token removal + Prospect Finder export rename + 2 spec-doc secrets notes |
  | `a52e18c` | 8 pipeline workflow exports |
  | `7847ae0` | 7 downstream workflow specs |
  | `f1b7715` | core system (src/tests/fixtures/scripts/ps1/package/env skeleton) |
  | `b9ad488` | H4: README rebase |
  | `1162e80` | H6: verify:frozen + manifest + CI workflow |
  | `4a85eda` | H1+H5: runbook + credentials docs |

- **Before:** 40+ untracked n8n-lead-recovery artifacts + 1 tracked deletion.
  **After:** zero `n8n-lead-recovery/` entries in `git status` (clean).
- **Needs decision (left uncommitted, unrelated):** `_open-canva/` (thumbnails/themes),
  `kaya-renovations/`, `landing-pages/`, `AGENTS-BACKUP.md`, `reconcilekit/` (Phase 3
  docs/storefront changes), `saas-boilerplate/` thumbnail. Owned by other workstreams.

## 4. H4 — README rebase: PASS

- `README.md` rewritten from the Google Places-era doc (removed Places setup, $32/1k
  pricing tables, Places field-mask, Places errors, Places deployment checklists) to the
  current **Foursquare + Overpass** dual-provider pipeline: accurate node-by-node table
  (FSQ branch, OSM branch, `Merge`, `API Success?` IF, error semantics), one-prospect
  test, cost control, formula preservation, troubleshooting, and a 9-workflow ecosystem
  index. Version footer updated to v2 (2026-09-12).

## 5. H5 — Credentials documentation claim verified: PASS

- Audited **all 9** workflow exports: only **Prospect Finder** carries in-file credential
  **references** (7× `googleSheetsOAuth2Api` `rOKhG0ESKifN5zy2` + H2's `httpHeaderAuth`).
  The other 8 export **no** references in-file — they rely on post-import attach.
- **Zero** embedded credential data (`privateKey`/`"data":`/GCP/OAuth payloads) anywhere.
- Documented in `docs/CREDENTIALS.md` incl. the trade-off (no embedding to avoid
  committing secrets) with the import-side limitation flagged for a future phase.

## 6. H6 — Frozen-artifact integrity gate + CI: PASS

- `frozen-artifacts.manifest.json` — SHA-256 of the 7 Phase 1–5 frozen artifacts
  (baseline = Phase 6 report §9).
- `scripts/verify-frozen.js` — dependency-free SHA-256 comparator, exit 0/1.
- `npm run verify:frozen` → **`PASS: 7 frozen artifact(s) verified (SHA-256 match).`**
- `.github/workflows/test.yml` (git root) — on push/PR to `n8n-lead-recovery/**`:
  `npm install` → `npm test` → `npm run verify:frozen` (Node 20; no live env, no secrets).

## 7. H7 — REPORT.md (this file): PASS

- Definitive superseding hygiene report at the repository root. Spec/artifact docs
  untouched.

---

## Gate verification

| Gate | Result |
| --- | --- |
| `npm test` (full suite, offline) | **637/637 PASS, 0 fail** (exit 0) |
| `npm run verify:frozen` | **PASS** — 7/7 frozen artifacts unchanged |
| Literal secret scan (all files except node_modules/.git/reports) | **GREEN** — former token gone; only frozen `redact()` detector/test fixtures + doc notes remain (all intentional) |
| Frozen artifact hashes | unchanged this session (manifest matches Phase 6 baseline) |
| `git status` | no `n8n-lead-recovery/` entries; unrelated dirty files listed in §3 |
| No live execution attempted | Phase 6/7 remain blocked on environment by design; runner returns `NOT_CONFIGURED` |

## Frozen-artifact integrity statement

No Phase 1–5 artifact (engine, contract, embedded mirrors, shipped
`Response-Interpretation V1.json`, capture/reconcile engine, live runner, fixtures,
tests, Capture/Reconciliation workflows) was modified this workstream. Verified by
`verify:frozen` SHA-256 match **and** the still-green 637/637 suite. H2 changed only the
**Prospect Finder** export and non-frozen spec docs.

## Known limitations / deferred

1. **Phase 6/7 live execution** — still blocked on environment provisioning
   (`docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` is the unblock path). The Phase 5 revision
   below removes the API-execution blocker; a live n8n container is still required.
2. **Prospect Finder Foursquare error handling** — HTTP errors are uncaught (execution
   fails); OSM errors are caught. Documented in README §4; flagged, not fixed (out of
   hygiene scope).
3. **Credential reattach on fresh n8n instances** — eight workflow exports carry no
   credential references; operator attaches per node after import (CREDENTIALS.md). A
   future import-mapping helper is deferred; it must never embed secret values.
4. **Unrelated workspace dirt** (§3) belongs to other workstreams — not committed here.

---

# Phase 5 Revision Report — Live Runner Execution Mechanism

**Status: PASS — PHASE 5 REVISION COMPLETE**

**Date:** 2026-09-12
**Scope:** `n8n-lead-recovery/src/response-interpretation-live-runner.js` (the only
frozen artifact touched), its new test file, `.env.example`, the Phase 6 runbook, and
this report. The shipped `Response-Interpretation V1.json` workflow was **not** modified
and no Webhook trigger was added.

## Root cause

The runner's execute phase POSTed `workflowData` to the n8n public REST API
(`/api/v1/executions`). The Community edition's public API cannot trigger executions for
workflows whose trigger is a **Manual Trigger node** (`n8n-nodes-base.manualTrigger`), so
the shipped workflow could never be executed by the runner. Additionally, the alternative
`n8n execute --id` CLI inside the container failed because its temporary task broker binds
to port **5679**, already held by the running n8n server.

## Design

Configurable execution backend, selected by env:

- **cli (default):** spawn the validated argv array
  `docker exec -u node -e N8N_RUNNERS_BROKER_PORT=<port> <container> n8n execute --id <workflowId>`
  and capture stdout/stderr/exit code. Port conflict resolved via
  `RESP_INT_EXEC_BROKER_PORT=5677` (any port other than the server's 5679; the runner
  **rejects 5679**). Exit 0 → parse the execution payload from stdout → extract the
  `Interpret Responses` report (reused by the collect phase, no re-run). Non-zero exit → FAIL
  with stderr excerpt; exit 0 but output not located → NOT_CONFIGURED (never a fake PASS).
- **http (fallback):** the previous REST POST + GET path, preserved verbatim for
  instances that expose a run endpoint.

## Files changed

| Path | Change |
| --- | --- |
| `src/response-interpretation-live-runner.js` | Backend dispatch, `readConfig` exec section, `buildCliCommand`, `runCommand`, `parseExecuteStdout`, `executionIdFromPayload`, `mapCliExitCode`, `validateExecParams`; collect reuses CLI capture; report records `execution.{backend,workflow_id,container,broker_port}` |
| `tests/response-interpretation-live-runner-exec.test.js` | **new** — backend selection, command construction, exit-code mapping, stdout parsing, injection hardening, cli/http execute+collect, full CLI run (no network) |
| `tests/response-interpretation-live-runner.test.js` | `ENV_READY` gains `RESP_INT_EXEC_BACKEND: 'http'` (keeps HTTP-path tests as the explicit backend) |
| `frozen-artifacts.manifest.json` | v2 — runner re-baselined (`revisions[]` records old→new sha256); other 6 artifacts **unchanged** |
| `.env.example` | `RESP_INT_EXEC_BACKEND`, `RESP_INT_EXEC_CONTAINER`, `RESP_INT_EXEC_BROKER_PORT` + 5679 warning |
| `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` | New §3 "execution backend" (cli/http, port conflict, input caveat), env table + PowerShell example + gate table updated |

## Verification

| Gate | Result |
| --- | --- |
| `npm test` | **663/663 PASS, 0 fail** (637 baseline + 26 new), exit 0 |
| `npm run verify:frozen` | **PASS** — 7/7 (6 artifacts byte-identical to Phase 6 baseline; runner re-baselined intentionally) |
| Workflow modified? | **No** — `Response-Interpretation V1.json` untouched, no Webhook trigger, `active:false` preserved |
| Preflight A–I / namespace / cleanup / redaction / determinism gates | Preserved — test suite green, no fixture or engine code touched |

## Deferred (unchanged)

Phase 6/7 live execution still needs a running n8n container; `n8n execute` drives the
workflow as shipped (Manual Trigger input is not injectable via CLI) — the runbook
documents the http/manual-UI collect path for input-injected canonical comparison.