# Phase 6.5 REVISION — Live Harness URL Correction & Empty-Response Root Cause / Fix

**Status:** COMPLETE (approved scope; STOP after this revision).
**Date:** 2026-09-14
**Container under test:** `serene_swartz` (n8nio/n8n, v2.38.7)
**Frozen production artifact:** `Response-Interpretation V1.json` — hash UNCHANGED (`ae365cd3b98fce08b95ccea9fae7661e4d1bde7f655326a4ed13b7031adb4bac`).

---

## 1. Objective

Complete the Phase 6.5 REVISION on the approved scope:

1. **§1–§3** — Correct the harness webhook URL construction and env sourcing (already implemented, tested 49/49) and settle the discovered URL conflict with evidence.
2. **§4** — Empirically investigate and fix the live `empty-response` symptom (`{"code":0,"message":"No item to return was found"}`, HTTP 500 empty body).
3. **§5** — Re-baseline the integrity manifest (`frozen-artifacts.manifest.json`, v3).
4. **§6** — Re-run the frozen artifact hygiene gates and publish this report.

Constraints honoured throughout: no modification of the production workflow, no change to the frozen interpretation engine or the workflow contract, harness JSON + builder + runner MAY change, and the revision STOPS here (no Phase 7, no full scenario matrix, no unrelated hygiene).

---

## 2. URL settlement (the task's plain-path assumption is FALSE on this instance)

### 2.1 What the task assumed vs what the instance does

The task's §1–§3 instruction assumed the harness webhook is reachable at the plain single-segment path
`http://<host>:5678/webhook/test/resp-int-harness`.

Empirical evidence on `serene_swartz` (n8n 2.38.7) — POST with the identical canonical scenario payload:

| URL | Result | Evidence |
| --- | --- | --- |
| `http://localhost:5678/webhook/test/resp-int-harness` | **404** | before and after a clean container restart |
| `http://localhost:5678/webhook/harnessRespIntV10000001/webhook/test/resp-int-harness` | **500** (before fix) → **200 + full Interpret report** (after fix) | registered `webhookPath` on this instance |
| `http://localhost:5678/webhook-test/test/resp-int-harness` | 404 (test one-shot endpoints only exist while "Listen for test event" is active) | — |

The container's production webhook registration includes the workflow-id segment
(`harnessRespIntV10000001/webhook/test/resp-int-harness`). The plain path is not registered,
so the task's plain URL cannot reach the harness on this instance.

### 2.2 Decision (user-approved)

> **Accept evidence-corrected URL** — keep the code contract fix (`harnessWebhookUrl` NEVER embeds a workflow id), document that the operator MUST set `RESP_INT_HARNESS_WEBHOOK_PATH` to the exact live-registered path on this instance, and incorporate the 404/500 evidence into this report.

### 2.3 Code state (§1–§3, unchanged from the prior approved work)

- `harnessWebhookUrl(baseUrl, webhookPath=HARNESS_WEBHOOK_PATH, mode=HARNESS_WEBHOOK_MODE_PRODUCTION)`
  — production mounts at `/webhook/<path>`, test at `/webhook-test/<path>`; the workflow id is NEVER part of the URL (regression-locked by tests).
- Dedicated env block: `RESP_INT_HARNESS_BASE_URL || N8N_BASE_URL` (fallback only for baseUrl), `RESP_INT_HARNESS_WORKFLOW_ID` (required; `N8N_WORKFLOW_ID` alone never satisfies the harness → `NOT_CONFIGURED`), `RESP_INT_HARNESS_WEBHOOK_PATH` (default `test/resp-int-harness`), `RESP_INT_HARNESS_WEBHOOK_MODE` (default `production`). Documented in `.env.example`.

---

## 3. §4 — Empty-response root cause, evidence, and fix

### 3.1 What was producing the 500-empty

Executions 33/34/35 (harness, webhook mode) all logged `n8n.workflow.success` (`status: success`), yet returned HTTP 500 with an empty body. The chain did not fail — it terminated early:

1. **The live read yielded 0 rows.** Decoded `execution_data` for execution 35 (`runData`):
   - Executed: `Webhook → Manual Trigger → Read Reconciliation Report → Read Response Log`.
   - `Read Response Log` (googleSheets) `status: success`, **`data.main: [[]]`** (empty branch).
   - `lastNodeExecuted: "Read Response Log"`; `Interpret Responses` and `Response Interpretation Complete` **never executed** (absent from runData).
2. **An empty `main` terminates the branch in n8n** — downstream nodes don't run.
3. **`responseMode: lastNode` then 500s.** n8n source
   `/usr/local/lib/node_modules/n8n/dist/webhooks/webhook-last-node-response-extractor.js`:
   `extractFirstEntryJsonFromTaskData` walks the last executed node's `data.main`, finds no item, and throws
   `OperationalError('No item to return was found')` → HTTP 500 body (exactly what the live reports captured).
4. **Contrast — production CLI runs 30/31 (workflow `VP3qw1h7hC4FVu9K`)** executed the FULL 5-node chain:
   `Read Response Log` returned **1 row** and `lastNodeExecuted: "Response Interpretation Complete"` with the full report JSON. So the container's Google OAuth credential is valid and the pinned sheet readable; the harness's zero-row read is data/read-target-specific, not an auth failure.
5. **Why the difference:** the container's *imported* production workflow is an older import (sheet located by gid `427410930` + `returnFirstMatch`), while the harness (byte-identical splice of the repo frozen artifact, which locates the tab by NAME `Response Log` + `returnAllMatches: true`) returns 0 rows. Root data condition: the live `Response Log` sheet has no data rows that the harness's read resolves. This is a faithful transport artifact of a zero-row read, NOT an interpretation-engine defect. (Hypotheses — empty tab vs tab-name mismatch — cannot be separated without the spreadsheet; either is covered by the fix.)

### 3.2 Fix (user-approved: "Apply the single-exception fix")

The harness now sets `alwaysOutputData: true` on **Read Response Log** — the contract's single, documented, harness-side flag deviation on a spliced node (`HARNESS_CONTINUATION_FLAG_NODES`). An empty *successful* read passes the input item through, so the frozen `Interpret Responses → Response Interpretation Complete` chain always runs and the webhook returns a structured report. When data rows ARE present, the real (non-empty) output is used and behavior is byte-identical to the frozen node. The frozen artifact is untouched; all other spliced nodes keep the strict frozen-equal `alwaysOutputData` check.

**Change set:**
- `src/response-interpretation-test-harness-contract.js` — exception-aware splice identity + docs (header, hygiene block, constant).
- `scripts/build-response-interpretation-test-harness.js` — sets the flag on the harness RRL node.
- `Response-Interpretation V1 — Test Harness.json` — regenerated (deterministic; contracts asserted before write).
- `tests/response-interpretation-phase-6-5.test.js` — +2 tests (flag present; flag on a non-exception node rejected).

### 3.3 Live verification (container, after re-import + re-activate + clean restart)

POST to `http://localhost:5678/webhook/harnessRespIntV10000001/webhook/test/resp-int-harness`
with the canonical `TEST-RESP-INT-001` payload → **HTTP 200**, full Interpret report JSON:
`status: COMPLETED`, `summary: { response_records: 1, interpreted_records: 0, skipped_records: 1, ... }`
(the passthrough reconciliation item is flagged `INVALID_RESPONSE_RECORD` / skipped — exactly the designed empty-read behavior). Evidence saved at `reports/RESPINT-LIVE-RESPINT-REV-GATE-01-response-interpretation-live.json` (real runner output; `execute=PASS`, `collect=PASS`).

Re-import state verified in the container DB: harness workflow `active=1`, `Read Response Log: alwaysOutputData=true`.

### 3.4 §4 grade

- **Empty-response mechanism fix: PASS with evidence** — the exact POST that previously returned 500-empty now returns 200 + structured report through the real runner.
- **Scenario-level verification: PARTIAL** — the seeded-scenario expectation cannot be met while the live sheet has no data rows; seeding requires Google API credentials on the host (`GOOGLE_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON`), which are not present. Completion of this leg requires those creds; the mechanism itself is proven.

---

## 4. Integrity manifest (§5)

`frozen-artifacts.manifest.json` re-baselined (v3 → v3 with three 6.5.1 revision entries):

| path | previous sha | new sha |
| --- | --- | --- |
| `src/response-interpretation-live-runner.js` | `8b48a329…51a20` | `f921263b…f5eff9` |
| `Response-Interpretation V1 — Test Harness.json` | `62664c7c…30adfd` | `9a75ace5…56956e` |
| `src/response-interpretation-test-harness-contract.js` | `284b694c…39ff7a` | `3b050584…13b9` |

`scripts/build-response-interpretation-test-harness.js` is NOT a manifest artifact (by policy).
Frozen engines (`response-interpretation.js`, `embedded-response-interpret.js`, `response-capture.js`, `response-reconcile.js`), the workflow contract, the scenario payloads, and the shipped `Response-Interpretation V1.json` are byte-identical.

`npm run verify:frozen` → **PASS: 10 frozen artifact(s) verified (SHA-256 match)**.

---

## 5. Gates (§6)

| Gate | Result |
| --- | --- |
| `npm test` | **819/819 pass** (804 baseline + 13 URL/env tests + 2 new exception tests) |
| `npm run response-interpret:phase-6-5:test` | **51/51 pass** |
| `npm run verify:frozen` | PASS (10/10) |
| `node scripts/security-check.js` | exit 0 |

---

## 6. Operator instructions

To reach the live harness on this instance the webhook path MUST be the registered path:

```powershell
$env:RESP_INT_EXEC_BACKEND = 'harness'
$env:RESP_INT_HARNESS_BASE_URL = 'http://localhost:5678'       # or N8N_BASE_URL
$env:RESP_INT_HARNESS_WORKFLOW_ID = 'harnessRespIntV10000001'  # required; never N8N_WORKFLOW_ID
$env:RESP_INT_HARNESS_WEBHOOK_PATH = 'harnessRespIntV10000001/webhook/test/resp-int-harness'  # evidence-corrected
node scripts/run-response-interpretation-live.js --run --inject-scenario TEST-RESP-INT-001
```

Container hygiene note (ops, outside repo scope): the LIVE production workflow `VP3qw1h7hC4FVu9K`
is an older container import (gid/`returnFirstMatch` read params) than the repo frozen artifact
(name/`returnAllMatches`); it is inactive and was not modified. Manual verification POST with this
report: `reports/RESPINT-LIVE-RESPINT-REV-GATE-01-response-interpretation-live.json`;
DB/decoder evidence scripts kept in the session temp dir (`…\Temp\opencode\n8n-db-inspect2\`).

---

## 7. What remains open

- Full scenario verification leg (PARTIAL) — requires Google creds on the host to seed the live Response Log sheet, then a fresh `--run --verify` pass with data rows present.
- The tab-name-vs-gid read discrepancy (which specific cause yields the zero-row read) needs spreadsheet access to pin down; the fix makes it moot for the harness mechanism.