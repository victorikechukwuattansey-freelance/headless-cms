# Phase 6.5 Report — Test Harness: Webhook Payload Injection for the Frozen Response-Interpretation Chain

**Status:** PASS — PHASE 6.5 COMPLETE (mechanism proven, harness built, gates green)

**Date:** 2026-09-13

---

## 1. Objective

Give the live runner a **test-only** path to execute the frozen `Response-Interpretation V1` chain on a scenario payload without touching the shipped workflow, the engine, the production contract, or the frozen artifacts. Phase 5.4's `n8n execute --id` path invokes the shipped workflow's **Manual Trigger**, which has no data input — so compare-input live runs were impossible for real (non-empty) reconciliation reports. Phase 4 shipped an **embedded mirror** of the engine inside the workflow, and Phase 5 proved the engine (offline) is byte-equivalent to that embedded mirror; what remained for Phase 6.5 was a *runtime* injection surface: get user-shaped data (a reconciliation report + read-error carriers) into the chain that actually lives in the n8n container.

Approach: **Mechanism B — Webhook → Code bridge named "Manual Trigger"**. A dedicated harness workflow (a spliced copy of the frozen 4-node chain) exposed on an unauthenticated Webhook, whose flatten-body Code node produces exactly the trigger input that the canonical `injectedTriggerInputFor` produces. Passing the runner's `--inject-scenario` makes the runner POST the scenario's trigger input to that webhook and treats the `lastNode` response (the Interpret report) as the live collected output.

Current task scope: build the harness artifact (+ deterministic builder), the harness contract validator, the payload-parity source module, ADDITIVE runner support for a `harness` backend, tests, manifest re-baseline (v3), and all gates. **No Phase 6 re-run, no Phase 7** — the runner's live `harness` path is available for a future user-approved investigation. A live harness run is NOT performed here.

---

## 2. Mechanism Proof (§0 smoke test, 2026-09-13)

Proving the n8n 2.x webhook → Code bridge: a 2-node throwaway workflow (`Webhook` → `Code`) was imported into the running container (`serene_swartz`, n8n 2.38.7), activated, POSTed to, and executed. Evidence captured to `C:\Users\1040 G8\AppData\Local\Temp\opencode\bridge-smoke.json` + `bridge-smoke-evidence.md`:

- **`n8n execute --file` (Mechanism A) is dead**: the CLI prints `"--id" has to be set!` and exits 0 without reading the file — confirmed, abandoned.
- **Versioned webhook URL is the live endpoint**: `POST {base}/webhook/{workflowId}/webhook/{path}` executes the workflow and returns the **lastNode** response; the raw `/webhook/{path}` returns 404.
- **Flatten-body bridge works**: Webhook node (`path: test/bridge-smoke`, `httpMethod: POST`, `responseMode: lastNode`, `options: {}`, **typeVersion 2**) with Code node jsCode
  `"\nreturn [{ json: (($input.first().json.body) || {}) }];\n"`
  returned the POSTed JSON object verbatim.
- **Credential surface**: the container's `workflow_entity` holds exactly one Google Sheets credential — id `Q2J6wmozbkk3NCTM`, name `Google Sheets account` (`googleSheetsOAuth2Api`). The harness's Read Response Log retains **only that identity reference** (`{id, name}`) so the spliced node can authenticate to the pinned spreadsheet; no secret material is embedded.

---

## 3. What Was Built

### 3.1 Harness artifact — `Response-Interpretation V1 — Test Harness.json` (NEW, generated)

6-node strict linear chain, workflow-level id `harnessRespIntV10000001`, `active: false`:

```
Webhook ──▶ Manual Trigger ──▶ Read Reconciliation Report ──▶ Read Response Log
      ──▶ Interpret Responses ──▶ Response Interpretation Complete
```

- **Webhook** (`n8n-nodes-base.webhook`, typeVersion 2, id `b619c17c-h000-4b2e-9a3c-000000000001`): `path: test/resp-int-harness`, `httpMethod: POST`, `responseMode: lastNode`, `options: {}`. Unauthenticated by design (webhook has no API key).
- **Manual Trigger** (Code bridge, id `b619c17c-h000-4b2e-9a3c-000000000002`): the proven flattens-body snippet, reproducing the frozen chain's trigger symbol.
- **Spliced nodes 3–6** are **byte-identical** to `Response-Interpretation V1.json` (type, typeVersion, id, alwaysOutputData, parameters — including the long embedded Interpret jsCode, which the builder reads from file and **never hardcodes**). The frozen node ids are preserved (`resp-int-read-recon-0001`, `resp-int-read-response-0001`, `resp-int-interpret-0000001`, `resp-int-complete-0000001`) so pairedItem ancestry semantics match the shipped chain exactly.
- **Read Response Log** additionally carries the reference-only credential block `{"googleSheetsOAuth2Api":{"id":"Q2J6wmozbkk3NCTM","name":"Google Sheets account"}}` — the single structural delta of the entire harness.

sha256 `62664c7c…30adfd`. The builder (`scripts/build-response-interpretation-test-harness.js`) is deterministic and runs `assertHarnessContract` before writing; it is **not** a manifest artifact. The shipped `Response-Interpretation V1.json` is untouched (`ae365cd3…adb4bac` re-verified).

### 3.2 Harness contract — `src/response-interpretation-test-harness-contract.js` (NEW)

`checkHarnessContract(wf)` / `assertHarnessContract(wf)` plus constants. 64 checks, including: workflow id + `active:false`; exact 6-node name set/order; Webhook node shape (POST, lastNode, test path, typeVersion 2); bridge jsCode byte-exact; **splice identity** vs the frozen artifact for all four nodes; exact 5-chain wiring with fan-in/fan-out; exactly one credentials-bearing node (Read Response Log) and that block is `{id,name}` reference-only; hygiene scans run on the serialized workflow **after removing the allowed block** — no embedded-secret keys (`access_token|refresh_token|apiKey|api_key|password|authorization|private_key|oauthTokenData|token_secret`), no second `credentials` key, no secret value patterns (`sk-…`, `AKIA…`, `AIza…`, `ya29.…`, PEM headers, `xox…`, Bearer tokens, JWTs), no `$env`/`process.env`; exactly one Google Sheets node (read-only, targeting `SPREADSHEET_ID`); banned node types rejected (Webhook is the permitted exception); every `$('X')` code reference is a transitive pairedItem ancestor; `assertCleanSource` on every code node.

> Note: the *production* `assertWorkflowContract` rejects the word `credentials` anywhere — correct for the shipped artifact, but the harness is precisely the ONE surface that must reference the n8n-resolved credential identity, so the harness gets its own contract instead of weakening the production one.

### 3.3 Payload parity source — `src/response-interpretation-scenario-payloads.js` (NEW)

Self-contained, pure module, imports only `response-reconcile`, the fixtures loader, and the contract module (`FIXED_NOW`). Mirrors the runner's projection helpers so that `buildScenarioPayload(scenarioId, ns)` is **structurally equal** to `runner.injectedTriggerInputFor(runner.resolveScenario(scenarioId), ns)` for every scenario and failure key — including the empty-namespace deterministic case. Payload shape = the Manual Trigger contract: `{ event:'', reconciliation_report, response_log_read_error, reconciliation_read_error }`. Report cards come from `reconcileResponses` (fixed `now`/`runId`), which already excludes `response_text`/`provider_message_id`/sender/recipient — payloads are hygiene-clean by construction.

### 3.4 Runner — `src/response-interpretation-live-runner.js` (ADDITIVE, re-baselined)

- `RESP_INT_EXEC_BACKEND=harness` and `--inject-scenario` (forces harness) → `effectiveExecBackend(args, config)`.
- `executeHarness(env, args, deps, config)`: contract-gate the artifact (fail → FAIL), build the scenario payload, **POST** to `harnessWebhookUrl(base, workflowId)` (no API key), capture the response via `normalizeHarnessResponse` (bare object or single-item array unwrap; anything else → NOT_CONFIGURED). Non-ok response / transport throw → FAIL. Never claims a live comparison it didn't capture.
- `collectExecution` harness branch reuses the execute-phase capture (`args._harnessCollected`); without it → NOT_CONFIGURED.
- `readConfig.exec.harness = { baseUrl, workflowId, ready }` (ready = baseUrl && workflowId — no API key required); `buildRunReport.execution` now carries `base_url` + `webhook_path`; preflight adds informational harness-artifact checks under harness mode; `parseArgs`/`usage` document the flag and backend.
- **Fix**: `executeFailureInfo` now strips n8n banner/noise lines via `parseExecuteStdout` before extracting the error — the CLI path previously failed to parse an error payload wrapped in launch noise.
- cli/http behavior unchanged.

### 3.5 Manifest — `frozen-artifacts.manifest.json` (v2 → v3)

Runner re-baselined (`8b48a329…`); three test-surface artifacts ADDED to the tracked set (harness JSON, scenario-payloads, harness contract). All frozen hashes unchanged (e.g. shipped workflow `ae365cd3…adb4bac`, reconcile engine `7554973c…a0a6131`). The `harness` builder script stays untracked (same rule as the production workflow builder).

---

## 4. Gates (all green)

| Gate | Result |
|---|---|
| `npm test` (`node --test "tests/*.test.js"`) | **804/804 pass** (768 baseline + 36 new Phase 6.5) |
| `scripts/verify-frozen.js` | **10/10** SHA-256 verified (7 frozen + 3 Phase 6.5) |
| `scripts/security-check.js` | **exit 0** |

New suite `tests/response-interpretation-phase-6-5.test.js` covers: payload parity (27 fixtures + 5 failure keys + empty-ns), payload hygiene, harness contract positive + 10 mutation negatives, builder determinism + on-disk byte fidelity, frozen-hash pin, harness backend selection/reading, execute/collect/verify wiring with a mocked transport (PASS/FAIL/NOT_CONFIGURED incl. array-unwrap), `executeFailureInfo` banner-strip regression, and an offline full-run (seed → execute(harness) → collect → verify → cleanup) against `MockSheets`.

---

## 5. Hygiene

- No secrets, tokens, PII, or `response_text` values in code, tests, build output, or this report.
- `HARNESS_PROVIDER_CREDENTIAL` is an n8n **identity reference** (`{id, name}`) — the actual OAuth material lives in the container and is never serialized.
- The credential block is removed before the hygiene scan; the scan rejects any *other* `credentials` key or secret pattern.
- The runner's `redact` continues to mask any residual secret families.
- Frozen artifacts byte-identical; harness is a NEW file; no writes to sheets performed in this phase.

---

## 6. How to Run a Live Harness Investigation (user-approved only)

```
node scripts/build-response-interpretation-test-harness.js
# import Response-Interpretation V1 — Test Harness.json into the running n8n,
# then activate it (the webhook only registers while active)
$env:RESP_INT_EXEC_BACKEND = "harness"
$env:N8N_BASE_URL = "http://localhost:5678"
$env:N8N_WORKFLOW_ID = "harnessRespIntV10000001"   # harness workflow id
node scripts/run-response-interpretation-live.js --scenario=TEST-RESP-INT-001 --inject-scenario --run --execute
```

`--inject-scenario` avoids touching the env; `RESP_INT_EXEC_BACKEND=harness` is the persistent equivalent. The harness webhook is unauthenticated and the workflow should be left **inactive** between runs. Unparseable/missing webhook responses report NOT_CONFIGURED with MANUAL steps — never a fabricated PASS.

---

## 7. What Was NOT Done (explicitly out of scope)

- No execution of the shipped production workflow; no Phase 6 re-run; no Phase 7.
- No change to the engine (`response-interpretation.js`), embedded mirror, capture, or reconcile sources; no change to the shipped workflow JSON or the production contract module.
- No live webhook call against the container in THIS phase (requires activation + a live container, deferred to a user-approved investigation).