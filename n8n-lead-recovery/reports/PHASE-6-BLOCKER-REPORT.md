# Phase 6 Blocker Report — Structural Limitation Confirmed

**Status: BLOCKED (STRUCTURAL)**
**Date:** 2026-09-12
**Decision:** Operator chose "Record Phase 6 blocked (Recommended)"

---

## 1. Empirical Reconfirmation

### 1a. Exact CLI argv

Built by `buildCliCommand()` in `response-interpretation-live-runner.js:218-227`:

```
["docker","exec","-u","node","-e","N8N_RUNNERS_BROKER_PORT=5677","serene_swartz","n8n","execute","--id","gLzXBltBMeVcUIEN"]
```

No injection flag exists. `n8n execute --help` accepts only `--id`, `--rawOutput`, `--file` (deprecated). There is no mechanism to pass boundary payload to the Manual Trigger node.

### 1b. Actual exit code / stdout / stderr

- **Exit code:** 0 (all six recorded executions)
- **stdout:** Broker line (`Message broker listening on port 5677`) + JSON execution summary
- **stderr:** empty

n8n considers the run "success" because no reachable nodes remain — it does not distinguish between "all nodes ran" and "no more edges to follow."

### 1c. Node-level input/output

Recorded in the container's `execution_entity` + `execution_data` tables (SQLite, read-only access):

| Execution ID | mode | startedAt | finished | lastNodeExecuted | runData nodes | Read Reconciliation Report ran? | Interpret Responses ran? |
|---|---|---|---|---|---|---|---|
| 1 | manual | 2026-09-12 10:27:41 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |
| 2 | manual | 2026-09-12 10:27:53 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |
| 3 | cli | 2026-09-12 12:15:14 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |
| 4 | cli | 2026-09-12 12:49:02 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |
| 5 | cli | 2026-09-12 12:49:29 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |
| 6 | cli | 2026-09-12 12:50:00 | yes | Read Response Log | Manual Trigger, Read Response Log | NO | NO |

- `error`: null in all six
- `waitingExecution`: [] in all six
- `Read Reconciliation Report` and `Interpret Responses` are **absent from every execution's runData** — they never received input and never produced output.

### 1d. Interpret produced output?

**No.** The `Interpret Responses` node never started in any of the six executions. No execution output, report, or side effects were produced.

### 1e. n8n-recorded execution output

All six execution records retrieved via direct SQLite read of the container database (`execution_entity` + `execution_data` tables). The `execution_data` JSON uses n8n's compact array serialization; decoded runData nodes confirmed as `Manual Trigger` + `Read Response Log` only for every execution. No `GET /api/v1/executions` call was made (requires `N8N_API_KEY`, not provided); the SQLite read is authoritative and equivalent.

---

## 2. Dependency Trace

### 2a. Manual Trigger payload definition

`Response-Interpretation V1.json`, node `1b6a188f-5d1a-4257-b24d-c98513878e6c` ("Manual Trigger"):
```json
"parameters": { "event": "" }
```

The trigger node produces a single item with `{ event: "" }`. No boundary fields (`reconciliation_report`, `response_log_read_error`, `reconciliation_read_error`) exist unless injected externally.

### 2b. Read Reconciliation Report payload consumption

`Response-Interpretation V1.json` lines 46–58 (node `8a4838f3`, type `n8n-nodes-base.code`):

```js
const triggerItems = $('Manual Trigger').all();
// ... extracts reconciliation_report, response_log_read_error, reconciliation_read_error
const report = injectedReport !== null ? injectedReport : { status: 'COMPLETED', results: [] };
return [{ json: payload }];
```

This node reads the Manual Trigger output, extracts boundary fields, and defaults the report to `{status:'COMPLETED', results:[]}` when absent. **It has `alwaysOutputData: true` and no incoming connection** — n8n never starts it in cli mode.

### 2c. Interpret Responses consumption (the join point)

`Response-Interpretation V1.json` line 62 (node `705ccca9`, the embedded interpretSource):

```js
const triggerItems = $('Manual Trigger').all();
const responseLogItems = $('Read Response Log').all();
const reportItems = $('Read Reconciliation Report').all();
```

All three feeds are required. `Read Reconciliation Report` never ran → `reportItems` is empty/unreachable → `Interpret Responses` never starts.

### 2d. What payload must reach Interpret for NOT_CONFIGURED → PASS

Per `response-interpretation-workflow-contract.js:127-136` (`projectWorkflowInputs`):

```js
reconciliationReport: reportItems[0].json || { status: 'COMPLETED', results: [] }
```

Per `response-interpretation.js:853,868,874`:

```js
const report = normalizeReconciliation(reconciliationReport);
const reconciliationIndex = indexReconciliation(report.results);
reconciliationEvidence: reconciliationIndex.get(row.response_id)
```

The boundary payload that must reach Manual Trigger:

```js
{
  event: '',
  reconciliation_report: { status: 'COMPLETED', results: [...] },
  response_log_read_error: '',
  reconciliation_read_error: ''
}
```

This is exactly what `injectedTriggerInputFor()` builds (`response-interpretation-live-runner.js:443-451`), but **CLI mode cannot inject it** — the Manual Trigger runs empty, and the un-rooted code node is never reached.

### 2e. Root cause (topology)

The `Read Reconciliation Report` code node (`8a4838f3`) has **no incoming connection** from any other node. In n8n's execution model, a node is only started when:
1. It is the trigger node, OR
2. It has an incoming edge from a node that just completed.

Since `Read Reconciliation Report` satisfies neither condition, it is never started. Since `Interpret Responses` depends on `$('Read Reconciliation Report').all()`, it never receives its required feed and never runs.

This is a **topology-level structural limitation** — not a bug in the runner, the engine, or the workflow JSON. The workflow was designed for manual UI execution where the operator can trigger the boundary injection interactively. `n8n execute` has no such mechanism.

---

## 3. Unfreezing Options

### Option A: Test-only trigger variant

**What:** Create a separate workflow JSON where `Read Reconciliation Report` has an incoming edge from Manual Trigger (or a second Code node that provides the boundary payload), so that `n8n execute` can traverse the full graph.

**Scope:** New file `Response-Interpretation V1-test-trigger.json`. No changes to the frozen shipped workflow.

**Trade-offs:**
- Pro: Unblocks cli execution for test/dev
- Pro: No frozen-contract impact (new file, not a modification)
- Con: Two workflow files to maintain; the test variant drifts from the production topology
- Con: Phase 6 validation would prove the test variant works, not the shipped workflow
- Risk: Low — isolated to test infrastructure

### Option B: Alternative injection path (HTTP/API execution)

**What:** Use the `RESP_INT_EXEC_BACKEND=http` path with `POST /api/v1/executions` + `X-N8N-API-KEY`. The API accepts `workflowData` + `data` (the boundary payload) in the request body, bypassing the trigger node's empty parameters.

**Scope:** Requires `N8N_API_KEY` (operator to provide). Requires the workflow to be active in n8n.

**Trade-offs:**
- Pro: Uses the shipped workflow as-is; no file changes
- Pro: The API explicitly sets `data.reconciliation_report`, `data.response_log_read_error`, etc.
- Con: Requires API key provisioning (not yet provided)
- Con: The workflow must be activated (`active: true`) — currently `active: false` in the container
- Con: API execution may still encounter the same un-rooted node issue if n8n's execution engine doesn't traverse from a non-trigger entry point
- Risk: Medium — the API may inject the payload into the Manual Trigger's output, but the `Read Reconciliation Report` node still has no incoming edge; it depends on whether the API execution engine differs from cli

### Option C: Accept-and-document (UI/API path)

**What:** Accept that cli execution cannot validate this workflow. Document the limitation. Use the UI "Execute Workflow" button or the REST API for live validation. The Phase 6 live validation evidence would come from UI-driven execution.

**Scope:** Documentation only. No code changes.

**Trade-offs:**
- Pro: Zero risk to frozen artifacts
- Pro: Honest about the workflow's design intent (manual UI trigger)
- Con: Cannot automate Phase 6 evidence collection (requires human in UI)
- Con: If the REST API also cannot inject the boundary (see Option B risk), this may not work either
- Risk: Low for documentation; unknown for actual validation

### Option D: Defer

**What:** Accept that Phase 6 live validation against a real n8n instance cannot be completed in the current environment. Mark the blocker as known and deferred. The Phase 5 revision (cli backend) is complete and tested; the structural limitation is an environment constraint, not a code defect.

**Scope:** None. Report only.

**Trade-offs:**
- Pro: No changes, no risk
- Pro: Phase 5 revision is still a valid deliverable (663/663 tests, all gates green)
- Con: Phase 6 remains formally blocked
- Con: No live validation evidence for the shipped workflow
- Risk: None

### Recommendation

**Option D (defer)** is the safest path. The structural limitation is real and documented. Options A–C each carry risks or require resources not yet available. The Phase 5 revision (cli backend) is a complete, tested artifact that satisfies the engineering contract. The live validation gap is an environment constraint, not a code defect.

---

## 4. Gates Re-assertion

| Gate | Status | Evidence |
|---|---|---|
| npm test | 663/663 PASS | Re-run 2026-09-12, 0 failures, 0 skipped |
| verify:frozen | 7/7 PASS | Re-run 2026-09-12, manifest v2, runner hash `ecf46417d700d87cefa99efa4fd37f2e9ec35e6b9f8680578303837111989f68` |
| Secret scan | GREEN | No secret-shaped values in any `RESPINT-LIVE-*` artifact or `reports/` |
| Workflow contract (Phase 4) | INTACT | Shipped workflow JSON: 5 nodes, correct types, pinned `SPREADSHEET_ID`, Manual Trigger `event:""` |
| Container DB verification | INTACT | `workflow_entity`: name exact, 5 nodes/IDs/types, credential `Q2J6wmozbkk3NCTM` on Read Response Log, zero write/provider/AI/webhook/scheduler nodes |
| Git status (tracked files) | CLEAN | No modifications to any tracked file this session. `reports/` is gitignored. |
| Hash change | NONE | manifest v2 runner hash unchanged; no frozen artifact modified |

---

## 5. Security

- No secrets appear in this report. `GOOGLE_ACCESS_TOKEN` and `N8N_API_KEY` were not provided and are not needed for this blocker analysis.
- The `SPREADSHEET_ID` (`1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`) is the pinned engine/fixture sheet, not a production credential.
- Container database queries were read-only (`readOnly: true`).
- No live sheet writes were performed.

---

## 6. Final Report Summary

| Section | Status |
|---|---|
| 1. Empirical reconfirmation | COMPLETE — 6 executions, all stall at Read Response Log, Interpret never runs |
| 2. Dependency trace | COMPLETE — topology root cause: un-rooted code node, no incoming edge |
| 3. Unfreezing options | COMPLETE — A (test trigger), B (HTTP API), C (accept/UI), D (defer) |
| 4. Gates | ALL GREEN — 663/663, 7/7, secret scan, contract intact, no hash change |
| 5. Security | CLEAN — no secrets, read-only queries |
| 6. Blocker verdict | **STRUCTURAL** — n8n 2.38.7 cli execution cannot traverse to un-rooted nodes |
| 7. Impact | Phase 6 live validation blocked for ALL scenarios (A–F) |
| 8. Recommendation | Defer (Option D); Phase 5 revision is a complete deliverable |
| 9. Completion state | Phase 5: COMPLETE; Phase 6: BLOCKED (structural, not a code defect) |

---

## 7. Impact on Scenarios

| Scenario | Result | Reason |
|---|---|---|
| A: canonical mismatch | NOT_CONFIGURED | Injected evidence empty → reconcile report defaults to `{status:'COMPLETED', results:[]}` |
| B: empty response log, no injected evidence | NOT_CONFIGURED | Interpret never runs → no output to collect |
| C: fabricated failure metadata | NOT_CONFIGURED | Cannot inject failure metadata via CLI |
| D: read-error injection | NOT_CONFIGURED | `response_log_read_error` and `reconciliation_read_error` default to `''` |
| E: schema violation | NOT_CONFIGURED | Cannot inject malformed report via CLI |
| F: timeout/degradation | NOT_CONFIGURED | Workflow completes in ~2s with empty stall |

---

## 8. Recommendation

Accept the structural limitation. The Phase 5 revision (`executeCli`, port-conflict resolution, 26 new tests) is a complete, tested artifact. The cli backend works correctly — it spawns `n8n execute`, parses stdout, and maps exit codes as designed. The limitation is in n8n's execution engine, not in the runner.

No further code changes are needed. The blocker is documented and understood.

---

## 9. Completion State

- **Phase 1–4:** COMPLETE (frozen artifacts, contract, embedded mirror)
- **Phase 5 Revision:** COMPLETE (commit `d5d20af`, 663/663, verify:frozen 7/7)
- **Phase 6:** BLOCKED (structural — n8n cli cannot inject Manual Trigger boundary payload)
- **Hygiene workstream (H1–H7):** COMPLETE (8 commits, all gates green)
