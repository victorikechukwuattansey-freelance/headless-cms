# Phase 6 Environment Runbook — Response Interpretation V1 Live Execution

How to provision the live environment for Phase 6 (A–F live execution of the shipped
`Response-Interpretation V1` workflow) and re-run the Phase 5 live runner against it.
Written by the H1-hygiene workstream; supersedes nothing, complements
`reports/PHASE-6-response-interpretation-v1.md` (the recorded `FAIL — PHASE 6 BLOCKED`
environment-gate result).

The live runner never executes against a missing environment: without the correct
configuration it returns `RESULT: NOT_CONFIGURED` (exit 3), prints MANUAL steps, and
persists an honest run report. It never fabricates a PASS.

---

## 1. Environment gate summary

Phase 6 was blocked because, on the development machine at report time:

| Required | Status (at block) |
| --- | --- |
| `N8N_BASE_URL` | UNSET |
| `N8N_API_KEY` | UNSET |
| `N8N_WORKFLOW_ID` | UNSET |
| `N8N_WORKFLOW_NAME` | UNSET |
| `GOOGLE_SHEET_ID` | UNSET |
| `GOOGLE_ACCESS_TOKEN` | UNSET |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | UNSET |
| `RESP_INT_LIVE_RUN_TOKEN` | UNSET |
| `RUN_LIVE` | UNSET |

Reachability at block time: n8n default port `5678` closed (no n8n process). Port `8080`
was owned by an unrelated `httpd`; `11434` by Ollama. The repo has **no `.env`**, only
`.env.example` (documented names, empty values, no secrets). The workspace-root `.env`
holds only `GITHUB_TOKEN`.

This runbook turns those UNSET values into a working configuration.

---

## 2. Required environment variables

All names and semantics come from `src/response-interpretation-live-runner.js`,
`.env.example`, and the workflow contract. Copy `.env.example` to `.env` (never commit
`.env`) or export these in the shell you run the runner from. **No secrets should ever be
written into a file that is committed.**

| Variable | Required for | Value |
| --- | --- | --- |
| `N8N_BASE_URL` | execute/collect | Base URL of the n8n instance, e.g. `http://localhost:5678` (or the external/HTTPS URL). Do **not** include a trailing `/api/v1`. |
| `N8N_API_KEY` | execute/collect | n8n **Community** API key (n8n sidebar → Settings → API). Only the public API; keeps execution creation server-side. |
| `N8N_WORKFLOW_ID` | execute/collect | The numeric workflow id of the imported `Response-Interpretation V1` (see §4). |
| `N8N_WORKFLOW_NAME` | report identity | Defaults to `Lead Recovery Engine — Response Interpretation V1` when unset; set it if you imported under a different name. |
| `GOOGLE_SHEET_ID` | seed/verify/cleanup | **Must equal the pinned engine spreadsheet constant** (`SPREADSHEET_ID` in `src/response-interpretation-workflow-contract.js`) unless you pass `--allow-non-pinned-sheet` (that mode is **not** live-equivalent to the engine sheet). Tab is always the canonical **Response Log**. |
| `GOOGLE_ACCESS_TOKEN` | seed/verify/cleanup | Short-lived Google OAuth2 access token reading/writing the Response Log tab. Provide **either** this **or** `GOOGLE_SERVICE_ACCOUNT_JSON`. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | seed/verify/cleanup | Absolute path to a service-account JSON (rarely the right choice; access-token mode is simpler). |
| `RESP_INT_LIVE_RUN_TOKEN` | namespace (optional) | Deterministic hex namespace tag (8–32 chars) for `TEST-RESP-INT-LIVE-<tag>`. Defaults to a runtime hex time tag when unset. |
| `RUN_LIVE` | gate opt-in | When set truthy, live execution steps are permitted. When unset, the harness/runner stays gated (`NOT_CONFIGURED` / MANUAL). |

### PowerShell export without exposing secrets

```powershell
$env:N8N_BASE_URL   = "http://localhost:5678"
$env:N8N_API_KEY    = Read-Host -Prompt "n8n API key"        # NOT echoed as plaintext
$env:N8N_WORKFLOW_ID= "1234"
$env:GOOGLE_SHEET_ID= "1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890" # = pinned engine sheet
$env:GOOGLE_ACCESS_TOKEN = Read-Host -Prompt "Google OAuth access token"
$env:RUN_LIVE       = "1"
```

Alternatively copy `.env.example` to `.env` and fill it in locally; the runner reads env
variables, so if you use a `.env` you must export it into the process
(`$env:VAR = ...` in PowerShell, or your preferred dotenv loader — the runner performs no
`.env` parsing itself).

---

## 3. Provision n8n

1. **Install/start n8n** (Community edition is sufficient — the runner needs only its
   public API to create an execution).
   ```powershell
   npm install -g n8n
   n8n start
   ```
   Verify it listens on the expected port:
   ```powershell
   Get-NetTCPConnection -LocalPort 5678 -State Listen -ErrorAction SilentlyContinue
   ```
   Confirm the base URL: open the editor and check the address shown for your installation
   (local `http://localhost:5678`, or your configured external URL).
2. **Create an API key**: open n8n → your avatar → **Settings → API → Create API Key**.
   Scope: the key needs the public API (executions). Save the generated key directly into
   the environment — never into a committed file.
3. **Import the shipped workflow**: n8n → **Workflows → Import from File** →
   `Response-Interpretation V1.json` (the artifact root of this project). The import must
   preserve all 5 nodes and the existing connections; nothing in the file should need
   editing (the `Interpret Responses` Code node embeds the engine).
4. **Resolve the workflow id**: open the imported workflow → the URL carries
   `.../workflow/<id>` (or use the API key to call `GET /api/v1/workflows`). Put the
   numeric id in `N8N_WORKFLOW_ID`.
5. **Attach the Google Sheets OAuth2 credential** to the workflow's Sheets nodes if the
   import asks you to re-select them; execution of this workflow only reads the Response
   Log on the pinned sheet, so the credential must be authorized for that spreadsheet.

---

## 4. Provision the spreadsheet

1. Open the engine spreadsheet identified by the pinned `SPREADSHEET_ID` in
   `src/response-interpretation-workflow-contract.js`.
2. The canonical tab must exist with the exact header row the workflow writes/reads
   (contract-canonical; the Phase 1–5 suite validates workflow ↔ contract consistency —
   if a header is wrong, the workflow surfaces a read/write error; no data loss).
3. Obtain a short-lived Google OAuth access token (or service-account JSON path) and set
   it as `GOOGLE_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON`. The token must be scoped to
   `https://www.googleapis.com/auth/spreadsheets`.
4. Only use `--allow-non-pinned-sheet` with a **dedicated** test spreadsheet when you
   cannot grant the runner access to the engine sheet. Remember that mode is **not**
   live-equivalent — a PASS there is not a PASS on the engine sheet.

---

## 5. Re-run Phase 6 scenarios A–F

Runner entry point: `npm run response-interpret:live` (equiv.
`node scripts/run-response-interpretation-live.js`). Phases: `preflight, seed,
verify-seed, execute, collect, verify, cleanup, verify-cleanup` (`--all` / `--full` runs
everything; the default with **no phase flags** is a full run). Failure to pass
`--execute` leaves seeding/cleanup in DRY-RUN and prints warnings — nothing is written.

Scenario keys (`--scenario=<id>`):

| Scenario | Key |
| --- | --- |
| A. healthy populated Response Log | `TEST-RESP-INT-001` (any `TEST-RESP-INT-0xx` fixture id) |
| B. healthy empty Response Log | `empty` |
| C. Response Log read failure | `response-log-failure` |
| D. reconciliation read failure | `reconciliation-failure` |
| E. upstream INCOMPLETE reconciliation report | `upstream-incomplete` |
| F. double failure | `double-failure` |

Example full run for one scenario (real writes, no prompts):

```powershell
npm run response-interpret:live -- --execute --run-token=1a094f74f4a --scenario=TEST-RESP-INT-001
```

Example staged run (safer first pass):

```powershell
npm run response-interpret:live -- --preflight
npm run response-interpret:live -- --execute --run-token=1a094f74f4a --scenario=empty --seed --verify-seed
npm run response-interpret:live -- --execute --run-token=1a094f74f4a --scenario=empty --run        # execute-stage + collect
```

To collect a specific prior execution:

```powershell
npm run response-interpret:live -- --collect --execution-id=<n8n-execution-id>
```

Cleanup (namespace-guarded; only deletes `TEST-RESP-INT-LIVE-<hex8..32>-<digits>` rows):

```powershell
npm run response-interpret:live -- --execute --run-token=1a094f74f4a --cleanup --verify-cleanup
```

### Expected outcomes and exit codes

| Status | Exit code | Meaning |
| --- | --- | --- |
| `PASS` | 0 | Collected live output matched the canonical expected projection |
| `FAIL` | 1 | Collected output diverged (runner prints `failure_info`) |
| (unknown) | 2 | Other/unexpected runner status |
| `NOT_CONFIGURED` | 3 | Environment gate — required config missing/absent; MANUAL steps printed |
| `CLEANUP_NOT_PERFORMED` | 4 | Cleanup refused non-namespaced rows (safety; never deletes arbitrary rows) |

With the environment present, each scenario should print `RESULT: PASS` (or explicit
`FAIL` with mismatch detail) and persist a run report under `<repo>/reports/` (override
with `--reports-dir`). A scenario must never be silently skipped: the runner persists an
explicit outcome per run.

### Getting to the blocked-PASS note

The prior Phase 6 gate reports record all six scenarios as `NOT_CONFIGURED`
(`reports/RESPINT-LIVE-1a094f74{4f4a,4f97,4fd9,5019,5080,50ca}-response-interpretation-live.json`).
Re-running with this environment in place should convert those from `NOT_CONFIGURED`
(exit 3) to `PASS` (exit 0) — or `FAIL` (exit 1) with `failure_info` if a real discrepancy
appears. Do **not** edit the Phase 6 report retroactively; append a new Phase 6 re-run
report when the environment is live.

---

## 6. Security notes

- Never put `N8N_API_KEY`, `GOOGLE_ACCESS_TOKEN`, or service-account material into a
  committed file. `.gitignore` already excludes `.env*`.
- Seeding and cleanup write only to the `TEST-RESP-INT-LIVE-*` namespace; cleanup refuses
  arbitrary rows (`CLEANUP_NOT_PERFORMED`, exit 4).
- The runner redacts secret-shaped values from persisted reports. Run reports contain run
  ids and stage maps, not credentials.
- The Foursquare Places API node in the Prospect Finder workflow uses a named
  `httpHeaderAuth` n8n credential (`name: "Foursquare API"`) referencing
  `=Bearer {{$credentials.value}}` — the bare token lives in the n8n credential store, not
  in repo files (Hygiene H2).