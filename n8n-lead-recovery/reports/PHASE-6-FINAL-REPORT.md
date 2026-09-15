# Phase 6 Final Report — Response Interpretation V1 Live Validation

**Verdict: PARTIAL — PHASE 6 SCENARIOS INCOMPLETE**

**Date:** 2026-09-13
**Scope:** Documentation report only. No artifact was modified, no live execution was performed to produce this report.

---

## 1. Environment

| Item | Value | Source / verifiability |
| --- | --- | --- |
| n8n container | `serene_swartz` | run report `reports/RESPINT-LIVE-1a0990030-response-interpretation-live.json` `execution.container` |
| Workflow id (chain artifact, re-imported) | `VP3qw1h7hC4FVu9K` | same run report `execution.workflow_id`. Earlier reports reference the pre-5.4 id `gLzXBltBMeVcUIEN` (DRY_RUN report 2026-09-12, rerun report) |
| Workflow | `Lead Recovery Engine — Response Interpretation V1` (5 nodes, exact chain) | run report `workflow.nodes`; `assertShippedWorkflow` precondition gate |
| Execution backend | `cli` — `docker exec -u node -e N8N_RUNNERS_BROKER_PORT=<port> <container> n8n execute --id <id>` | run report `execution.backend`; `buildCliCommand()` |
| Broker port | `5677` (host server broker 5679 unused / no collision) | run report `execution.broker_port` |
| Google Sheet id | pinned `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ` (engine/fixture constant, not a credential) | run report `workflow.pinned_spreadsheet_id`; contract `SPREADSHEET_ID` |
| Tab | `Response Log` (the only tab the workflow may touch) | run report `workflow.tab`; contract `RESPONSE_LOG_SHEET` |
| Credential mode | Google API **access token** | per the runner runbook the Sheets client needs either `GOOGLE_ACCESS_TOKEN` (token mode) or `GOOGLE_SERVICE_ACCOUNT_JSON`. The live cycle required a working client for seed/cleanup; the exact mode is **not recorded in the persisted run report** [mode [UNVERIFIED from artifacts]; token itself never persisted] |
| Test namespace | `TEST-RESP-INT-LIVE-<hex>` — this cycle `TEST-RESP-INT-LIVE-1a0990030` | run report `test_namespace`; `RESP_INT_LIVE_NAMESPACE_REGEX` |
| n8n runtime | v2.38.7 (as recorded in the 2026-09-12 rerun report) | rerun report (unchanged runtime documented) |

---

## 2. Scenarios executed

Scenario keys per the runner: fixture ids `TEST-RESP-INT-001..027`, plus failure keys `empty`, `response-log-failure`, `reconciliation-failure`, `upstream-incomplete`, `double-failure` (`SCENARIO_FAILURE_KEYS`).

| # | Scenario (key) | Cycle result | Reason |
| --- | --- | --- | --- |
| A | healthy populated (`TEST-RESP-INT-001`) | executed 2026-09-13: **preflight=PASS, seed=PASS, verify_seed=PASS, execute=PASS, collect=PASS, verify_input=FAIL, cleanup=PASS, verify_cleanup=PASS** | end-to-end chain ran and produced Interpret output; verify_input failed on the reconciliation injection boundary (§4, §6) |
| B | healthy empty (`empty`) | executed in an earlier cycle; **execute=PASS, collect=PASS**, workflow completed with `coverage_rate=null` (fail-closed) | 0 response rows → engine `coverage_rate: rows.length > 0 ? … : null` (verified in `src/response-interpretation.js`); cycle stage details **not persisted in a distinct run-report file** [cycle [UNVERIFIED from artifacts]] |
| C | Response Log read failure (`response-log-failure`) | **NOT_CONFIGURED** | requires injecting `response_log_read_error` at the Manual Trigger boundary; cli has no injection channel |
| D | reconciliation read failure (`reconciliation-failure`) | **NOT_CONFIGURED** | requires injecting `reconciliation_read_error` at the Manual Trigger boundary; cli has no injection channel |
| E | upstream INCOMPLETE report (`upstream-incomplete`) | **NOT_CONFIGURED** | requires injecting `reconciliation_report: { status: 'INCOMPLETE', results: [] }` at the boundary; cli has no injection channel |
| F | double failure (`double-failure`) | **NOT_CONFIGURED** | requires injecting both read errors; cli has no injection channel |

Never fabricated: every non-executed scenario is explicitly `NOT_CONFIGURED`, never a PASS.

---

## 3. Live execution evidence

Evidence persisted in `reports/RESPINT-LIVE-1a0990030-response-interpretation-live.json` (mode `EXECUTE`) and the comparison artifact `reports/response-interpretation-live-output.json`.

| Item | Value | Producing stage / origin |
| --- | --- | --- |
| Per-run argv (scenario A) | `docker exec -u node -e N8N_RUNNERS_BROKER_PORT=5677 serene_swartz n8n execute --id VP3qw1h7hC4FVu9K` | `buildCliCommand()` (`src/response-interpretation-live-runner.js`); `execute` stage |
| n8n execution id (scenario A) | **not persisted** — the run report records `runner_run_id: ""` | `execute` stage (`executionIdFromPayload` found no id in the reporter payload) [execution id [UNVERIFIED from artifacts]] |
| lastNodeExecuted (scenario A) | `Response Interpretation Complete` | reported by the cycle [not persisted verbatim in the run report]; consistent with the collected Interpret output — `extractInterpretReport` lifts `runData['Interpret Responses']` from the CLI stdout, which exists only if the node ran, and `Response Interpretation Complete` is the chain's terminal node |
| Collected Interpret output | 1 / 1 row interpreted; `coverage_rate: 1` | `collect` stage: `parseExecuteStdout` → `extractInterpretReport` over the CLI stdout; written to `comparison_ready_output` |
| `intent_label=RESPOND, confidence_band=HIGH, reconciliation_status=NOT_VERIFIABLE`, exception `MISSING_RECONCILIATION_EVIDENCE` (WARNING) | live output `reports/response-interpretation-live-output.json` | `collect` stage artifact (redacted) |
| Pre/verify checks | namespace row count 1, header intact, rows outside namespace untouched | `seed` / `verify_seed` stages |
| Namespace cleared after run | 0 `TEST-RESP-INT-LIVE-1a0990030-*` rows remain | `cleanup` / `verify_cleanup` stages |
| Failure record | `failure_info: ["verify-input failed"]` (string, under-detailed — see §11) | `verify_input` stage |

The structural unblock vs pre-5.4 is directly evidenced: pre-5.4 probes stalled at `Read Response Log` (executions DB, rerun report); the 5.4 chain run produced `Interpret Responses` output in the CLI stdout — therefore the chain completed end-to-end and the `pairedItemNoConnectionCodeNode` failure class is gone.

---

## 4. Reconciliation injection — design boundary

- **Empirically confirmed (2026-09-12 probes, persisted in the blocker + rerun reports):** `n8n execute --help` exposes only `--id`, `--rawOutput`, and a deprecated `--file` — there is **no mechanism to pass a payload to a Manual Trigger**.
- The baseline evidence for this is on disk in `Response-Interpretation V1.json`: the `Read Reconciliation Report` code node reads `$('Manual Trigger').all()`, extracts `response_log_read_error` / `reconciliation_read_error` / `reconciliation_report`, and falls back to `const report = injectedReport !== null ? injectedReport : { status: 'COMPLETED', results: [] };` — so with only `{ event: '' }` at the boundary the node emits an empty completed report.
- `Interpret Responses` then produces `reconciliation_status: NOT_VERIFIABLE` for every row (engine path verified in `src/response-interpretation.js` and mirrored in `src/embedded-response-interpret.js`; live evidence §3 and §6).
- **This is correct fail-closed behavior, not a defect.** Phase 5.4 additionally fixed reachability (the node now has an incoming chain edge and actually runs under `n8n execute`); the remaining limitation is that the CLI boundary can still only default the report, never inject a real one. Injection exists only in the `http` backend (`executeHttp` posts `reconciliation_report` / `response_log_read_error` / `reconciliation_read_error` in the request `data`), which requires an n8n API key + active workflow — not available in this cycle.

---

## 5. Live output origin and comparison method

- **Live output origin:** captured from the CLI's stdout — the `n8n execute` reporter prints the execution's run data; `parseExecuteStdout` (with the non-empty-JSON extraction path) + `extractInterpretReport` lift the `Interpret Responses` node output; the `collect` stage reuses it (`args._cliCollected`) and the report is persisted `redact(...)`-ed to `reports/response-interpretation-live-output.json`.
- **Expected output origin:** the canonical Phase 3/4 engine at `FIXED_NOW` (`2026-09-12T09:00:00.000Z`): `engineBehaviorFor` derives the frozen reconcile artifact for the fixture (`reconcileResponses`) and runs `interpretResponses` through `projectWorkflowInputs`; `expectedReportFor(resolved, ns)` applies the namespace projection `projectedFixtureFor` and `stripRuntime` (drops `run_id`, `run_at`, `detected_at`). The fixture loader supplies reconciliation rows for all 27 fixtures (verified 27/27), so the canonical expectation for `TEST-RESP-INT-001` is **VERIFIED** with a matched reconciliation card.
- **Comparison performed by:** the `verify_input` stage — `compareCollected` = `stripRuntime(scopeCollectedToNamespace(collected))` deep-equal against the canonical expected JSON.

---

## 6. Comparison result

Verified by reproducing the runner's own comparison offline (canonical projected at `FIXED_NOW` vs the persisted live output):

| Field | Canonical expected | Live collected | Match |
| --- | --- | --- | --- |
| `reconciliation_status` | `VERIFIED` | `NOT_VERIFIABLE` | **MISMATCH (root cause)** |
| `exceptions` | `[]` | `[MISSING_RECONCILIATION_EVIDENCE (WARNING)]` | mismatch — **consequential** of reconciliation_status |
| `actionability` | `AUTO_REPLY` | `MANUAL_REVIEW` | derived from reconciliation_status (engine: NOT_VERIFIABLE → MANUAL_REVIEW) |
| `recommended_action` | `auto-draft reply permitted; send owned by a later stage` | `manual review required` | derived from reconciliation_status |
| `priority` | `LOW` | `MEDIUM` | derived from reconciliation_status |
| `notes` | `""` | `no reconciliation evidence for response_id; treated as NOT_VERIFIABLE` | derived from reconciliation_status |
| `intent_label` | `RESPOND` | `RESPOND` | identical |
| `confidence_band` | `HIGH` | `HIGH` | identical |
| `coverage_rate` (summary) | `1` | `1` | identical |
| `interpretation_id` (derivation) | `INTERP-fb5be935` | `INTERP-fb5be935` | identical (namespace-projected) |
| response / lead / outreach id projection | `RESPI-TEST-RESP-INT-LIVE-1a0990030-001` … | same | identical |
| evidence (phrases) | `please send`, `send me`, `yes` | same, **same order** | identical |
| `clause_hits`, `matched_terms_total`, `deciding_clause`, `conflict_detected` | `RESPOND`×3 | same | identical |
| `channel`, `response_status`, `interpretation_version`, `stop_contact`, `actionable` | email / CAPTURED / RESP-INT-V1 / false / true | same | identical |
| `sources` (both ok, both read errors empty) | identical | identical | identical |
| summary `by_intent`, `by_confidence_band` | identical | identical | identical |

**Explicit statement:** the only root divergence is `reconciliation_status` (`NOT_VERIFIABLE` vs `VERIFIED`). Aside from that single field, **no other field diverged independently** — the five additional differing items (the `MISSING_RECONCILIATION_EVIDENCE` exception entry and the four derived fields `actionability` / `recommended_action` / `priority` / `notes`, plus `summary.exception_count` 0 vs 1) are all direct consequences of the reconciliation pair. Everything the workflow is supposed to compute for an empty reconciliation input was produced exactly; only the reconciliation evidence (which the CLI boundary cannot supply) distinguishes the live run from canonical.

---

## 7. Cleanup results

- Namespace-guarded deletion worked: `cleanup` deletes only rows whose `lead_id` fully matches `RESP_INT_LIVE_LEAD_REGEX` (`^TEST-RESP-INT-LIVE-[0-9a-f]{8,32}-\d+$`) and the cycle namespace; any non-namespaced row found aborts to `CLEANUP_NOT_PERFORMED` (verified guard in source, §cleanup).
- Cycle result: `cleanup=PASS`, `verify_cleanup=PASS` (0 namespace rows remain, Response Log header unchanged — the header check is part of `verifyCleanup`).
- No non-namespaced rows were touched: seeded rows are namespace-projected (`RESPI-TEST-RESP-INT-LIVE-1a0990030-001`, `lead_id TEST-RESP-INT-LIVE-1a0990030-001`); the pre/post outside-namespace row comparison passed in `verify_seed`.

---

## 8. Security results

- Secret scan (`scripts/security-check.js`): **GREEN** (exit 0; its `true` findings are the legitimate env-var credential references in the untouched Prospect Finder workflow, no hardcoded key).
- Scanned every `reports/*.json` (all run reports + the comparison output): **no secret-shaped values** (no `sk-`, `AKIA`, `AIza`, `ya29.`, private-key blocks, Bearer tokens, JWTs) and **no token-name keys** (`access_token`, `api_key`, `response_text`, `provider_message_id`, …).
- `redact()` verified active on run reports: `buildRunReport` → `redact(report)` and `fullRun` writes the comparison file via `redact(outcomes.collect.collected)`; `SENSITIVE_KEY_RE` masks token-name keys, `SECRET_PATTERNS` (incl. the Phase 5.4 Bearer/JWT patterns) mask secret-shaped values. No tokens, keys, response_text, provider ids, or PII appear anywhere in this report or the persisted evidence.

---

## 9. Frozen integrity

Manifest v2 re-baseline (Phase 5.4) is intact. `node scripts/verify-frozen.js` → **PASS — 7/7 artifacts SHA-256 verified**. No frozen artifact changed during Phase 6; none was modified to produce this report.

| Frozen artifact | SHA-256 (manifest v2, post-5.4) |
| --- | --- |
| `src/response-interpretation.js` | `1e3341dbeb02800d21cc69ea1a4648ef196f0982ce2ee98e11fde2c3c6afe401` |
| `src/response-interpretation-workflow-contract.js` | `8bb58c9beb51931af6d64811b8dc30daa6774917bcd85ed428dc80cd68792168` |
| `src/embedded-response-interpret.js` | `8d56121734094e3e9f14d0a8ab1f82db76d7b7b45f81e115753535acf0d7894c` |
| `src/response-interpretation-live-runner.js` | `7cffb808ca6480268fb8d5b1e0a0e220bcb63334a24f9a6354bead2c7bcc7dae` |
| `Response-Interpretation V1.json` | `ae365cd3b98fce08b95ccea9fae7661e4d1bde7f655326a4ed13b7031adb4bac` |
| `src/response-capture.js` | `83407df33c2f5b9f88185162480bb7abda600c9d43b79e345007ab1b8ab0f779` |
| `src/response-reconcile.js` | `7554973cbab19f7e68cdf363833bd34f6518843b05ce46d597a6a16dad0a6131` |

Reference: `frozen-artifacts.manifest.json` revision entries — the three Phase 5.4 revisions (JSON `57b80b94… → ae365cd3…`, contract `7bfb4715… → 8bb58c9b…`, runner `ecf46417… → 7cffb808…`) plus the preserved Phase 5 / 5.1 / 5.2 history. Phase 6 added no revisions.

---

## 10. Baseline preservation

- `npm test`: **768/768 PASS, 0 fail** (46 suites) — the Phase 5.4 baseline, re-run for this report. Zero regressions.
- `node scripts/verify-frozen.js`: **PASS — 7/7** (also re-run).

---

## 11. Known limitations

1. **CLI cannot inject the Manual-Trigger payload.** `n8n execute --id` has no input-payload flag; the boundary always produces `{ event: '' }`, so `Read Reconciliation Report` defaults to `{ status: 'COMPLETED', results: [] }` (verified in the shipped node code) and reconciliation can never be supplied — scenario A's only divergence and the blocker for C–F.
2. **Scenarios C–F require a non-CLI execution primitive.** A `response_log_read_error` / `reconciliation_read_error` / INCOMPLETE-report / double-failure input cannot be induced through the cli backend. The in-repo `http` backend (`executeHttp`) does carry the injection fields but needs `N8N_API_KEY` + an active workflow and was not provisioned for this cycle.
3. **`verify_input` failure detail is under-detailed.** The persisted run report records `failure_info: ["verify-input failed"]` — a string pushed by `fullRun`; the comparison's detailed per-field diagnostics (`failureInfoFor`, which enumerates differing keys) are not surfaced into `failure_info`. Phase 5.4 hardened the **execute** error path (`executeFailureInfo`); the **verify** path still records this coarse string.
4. **Execution id and `lastNodeExecuted` are not persisted** in the runner's run report (`runner_run_id: ""`); scenario-A `lastNodeExecuted = Response Interpretation Complete` is cycle-reported and artifact-consistent but not stored verbatim.

---

## 12. Recommended next step (design decision — NOT implementation)

Both options keep the frozen production workflow untouched.

- **Option 1 (Recommended) — test-only trigger variant that accepts input payloads.** Add a separate test-only variant (e.g. `Response-Interpretation V1-test-trigger.json`) where the Manual Trigger carries an input parameter, or a dedicated entry Code node injects `reconciliation_report` / `response_log_read_error` / `reconciliation_read_error`, wired so a plain `n8n execute --id` traverses the full graph. This unblocks C–F and produces canonical scenario-A evidence (real reconciliation card → `VERIFIED`), completing Phase 6, while the frozen production artifact is never modified. Trade-off: the test variant is a second file that must track the production topology (chain invariant enforced by re-running `assertWorkflowContract` against it).
- **Option 2 — accept deferred full-comparison status.** Document partial live validation as the current honest state (this report): the chain runs end-to-end, produces byte-correct fail-closed output, and only the reconciliation-injection boundary remains uncovered. Zero changes; Phase 6 stays formally PARTIAL.

Recommendation: **Option 1** — it is the only path that completes scenarios C–F and canonical scenario A while leaving every frozen artifact byte-identical; Option 2 remains the acceptable fallback if no further live-validation resources are available.

---

## 13. Completion state

**PARTIAL — PHASE 6 SCENARIOS INCOMPLETE**

Scenarios that **passed infrastructure gates**:
- **A** — passed `preflight`, `seed`, `verify_seed`, `execute`, `collect`, `cleanup`, `verify_cleanup`; only `verify_input` FAILed, on the single reconciliation-status divergence caused by the CLI injection boundary (§6). The full execution path and fail-closed computation are thereby validated live end-to-end.
- **B** — executed in an earlier cycle (`execute` / `collect` PASS per operator; not persisted); fail-closed empty output (`coverage_rate=null`) is engine-confirmed.

Scenarios **blocked by the injection boundary** (all `NOT_CONFIGURED`, nothing fabricated):
- **C** (Response Log read failure), **D** (reconciliation read failure), **E** (upstream INCOMPLETE report), **F** (double failure) — each requires boundary payload that `n8n execute` cannot deliver; unblockable only via a non-CLI primitive (§12, Option 1) or deferred (Option 2).

Phase 6 remains formally **PARTIAL**: live validation proved the chain end-to-end on a non-empty Response Log, byte-correct fail-closed behaviour, namespace-safe cleanup, and clean gates (768/768, 7/7, secret scan GREEN, no frozen change) — but the reconciliation-injection scenarios (A canonical form and C–F) are incomplete until a payload-accepting execution primitive is adopted.