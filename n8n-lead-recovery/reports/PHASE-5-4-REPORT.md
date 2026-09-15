# Phase 5.4 Report — Workflow Topology Fix (Diamond → Chain) + Runner Error Surfacing

**Status:** PASS — PHASE 5.4 COMPLETE, PHASE 6 RE-READY

**Date:** 2026-09-13

---

## 1. Objective

Execute Phase 5.4: rewire `Response-Interpretation V1` from the diamond topology (Manual Trigger → `[Read Reconciliation Report, Read Response Log]` → Interpret Responses) to a strict linear chain so every `$('…')` reference inside the Interpret Responses Code node resolves via n8n pairedItem ancestry, harden `assertWorkflowContract` to reject the entire defect class, extend the live runner to surface raw n8n execution errors in `failure_info`, re-baseline the frozen manifest for the three touched artifacts, re-run all gates, and **stop after Phase 5.4** (no live n8n, no Phase 6, no Phase 7).

No fix was attempted by changing node code — the engine, embedded mirror, capture, and reconcile sources are frozen and remain byte-identical.

---

## 2. Defects Confirmed (Before)

### Defect class 1 — the diamond is fatally unreachable under n8n pairedItem semantics

Empirical evidence on 2026-09-13 (`docker exec -u node … n8n execute --id …`, 1 seeded row; exit code 1):

```
ExpressionError
message:        "Node 'Read Reconciliation Report' hasn't been executed"
descriptionKey: "pairedItemNoConnectionCodeNode"
nodeCause:      "Read Reconciliation Report"
```

Root cause: n8n pairs every input item to **one** parent item. `Interpret Responses` is downstream of `Read Response Log`, whose item ancestry is `Manual Trigger` → `Read Response Log` — the sibling branch (`Read Reconciliation Report`) is provably absent from the item's ancestry chain, so `$('Read Reconciliation Report')` can never resolve. The defect is **invisible with zero seeded rows**: no items → no pairing check → the run "completes" healthy.

### Defect class 2 — the live runner discarded the raw execution error

The pre-5.4 runner reported only `execute failed (exit code 1)`. The CLI's stdout (containing the full ExpressionError) was parsed solely for an execution id; the diagnostic died in the console tail. `failure_info` could never carry the actual failure.

---

## 3. The Correction

### 3.1 Artifact — connection rewire to the strict chain

`Response-Interpretation V1.json` `connections` is now the linear chain (only this block changed):

```
Manual Trigger → Read Reconciliation Report → Read Response Log → Interpret Responses → Response Interpretation Complete
```

Embedded code references verified against the shipped artifact: `interpretCode` refs exactly `["Manual Trigger","Read Response Log","Read Reconciliation Report"]` — all three are transitive chain ancestors, so the new ancestor check passes on the valid artifact.

### 3.2 Contract — `src/response-interpretation-workflow-contract.js`

- `TOPOLOGY.chain` and `EXPECTED_EDGES` = the four chain edges; `referenceWorkflow()` emits the chain (now the single source of truth for wiring).
- Fan-in/fan-out validation: every non-terminal node has exactly one outgoing edge and every non-trigger node has exactly one incoming edge. **The fan-in check is what catches a diamond** (the union-based ancestry check alone cannot — both diamond reads are reachable, yet only the item's own ancestry matters).
- Terminal check: `Response Interpretation Complete` must have 0 outgoing edges.
- Derived connection-key check: the edge-source key set must equal the four chain sources.
- New pure exported helpers: `incomingCounts`, `outgoingCounts`, `pairedItemAncestors`.
- New code-reference check: any `$('X')` reference must be a **transitive pairedItem ancestor** — the exact failure class of the empirical bug.
- Phase 5.1 reachability/orphan checks and Phase 5.2 output-slot validity checks retained.

Verified live: contract PASS on the chain reference; a synthetic diamond is rejected with `"Manual Trigger" has 2 outgoing edge(s), expected exactly 1 (chain)` and `"Interpret Responses" has 2 incoming edge(s), expected exactly 1 (chain)`; `$('Response Interpretation Complete')` referenced from Interpret Responses fails the ancestor check.

### 3.3 Builder — `scripts/build-response-interpretation-workflow.js`

Doc comment updated to the chain; the Phase 5.2 Manual Trigger connection override removed — `referenceWorkflow()` owns the wiring. Determinism re-verified: two builds byte-identical AND deep-equal to the shipped JSON.

### 3.4 Runner — `src/response-interpretation-live-runner.js`

- `SECRET_PATTERNS` extended with `/Bearer\s+[A-Za-z0-9._~+/=-]{6,}/i` and a JWT shape `/eyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/` so `redact` masks them even inside extracted error text.
- New pure `executeFailureInfo(stdout)`: returns `null` for empty stdout; for a CLI error payload returns `{ stage:'execute', name, message (≤300 chars), nodeCause, lastNodeExecuted }` (from `resultData.error`, incl. `error.context.nodeCause` / `lastNodeExecuted`, name preserved when the engine reports one, e.g. `ExpressionError`); for non-empty non-JSON stdout returns `{ stage:'execute', name:'UnparseableOutput', message: <first 300 chars> }`. Never persists stack traces or `runData`.
- `executeCli` FAIL now attaches `failure`; `fullRun` and `runSelectedPhases` push `ex.failure` (falling back to the string detail) into `outcomes.failures`, which flows into the redacted `failure_info` via `buildRunReport`. `printSummary` JSON-stringifies object failures.

---

## 4. Diff Confinement

`git diff` for this phase (n8n-lead-recovery scope) is exactly:

- `src/response-interpretation-workflow-contract.js` — `TOPOLOGY.chain`, `EXPECTED_EDGES` chain, chain fan-in/fan-out checks, `pairedItemAncestors`/`incomingCounts`/`outgoingCounts` helpers, transitive-ancestor code-reference check, exports (+ the earlier complete set of edits shown in §3.2).
- `scripts/build-response-interpretation-workflow.js` — doc note + removal of the Manual Trigger override (build script is **not** a manifest artifact).
- `Response-Interpretation V1.json` — **only** the `connections` block (3 insertions / 10 deletions in previous-session diff of the regenerated file vs git); node names, ids, types, parameters, and positions are byte-identical.
- `src/response-interpretation-live-runner.js` — `SECRET_PATTERNS`, `executeFailureInfo`, FAIL-branch wiring, `printSummary` (all additive listed in §3.4).
- `tests/response-interpretation-topology.test.js` — new file (9 tests).
- `tests/response-interpretation-error-extraction.test.js` — new file (11 tests).
- `tests/response-interpretation-workflow.test.js`, `-workflow-edges.test.js`, `-workflow-build.test.js`, `-output-slots.test.js` — updated to the chain.
- `frozen-artifacts.manifest.json` — v2 re-baseline (see §8).

Frozen-by-task engine sources were NOT touched: `src/response-interpretation.js`, `src/embedded-response-interpret.js`, `src/response-capture.js`, `src/response-reconcile.js`.

---

## 5. Regression Tests

### `tests/response-interpretation-topology.test.js` (new; 9/9 PASS)

Uses shipped-artifact and synthetic topology only — no real sheet id or credentials.

| # | Test | What it proves |
| --- | --- | --- |
| 1 | shipped chain traverses all five nodes exactly once | the artifact is the strict chain |
| 2 | `chain` / `EXPECTED_EDGES` match | contract and artifact agree |
| 3 | every `$()` ref resolves to a transitive ancestor | Defect class 1 fix on the artifact |
| 4 | embedded refs are exactly the three chain ancestors; relay mirror refs only `Manual Trigger` | mirrors stay valid |
| 5 | contract rejects the synthetic diamond (outgoing + incoming over-fan) | the fan-in/fan-out checks catch diamonds |
| 6 | contract rejects a code ref to a non-ancestor (`Response Interpretation Complete` from Interpret) | the ancestor check catches the exact failure class even when the node exists |
| 7 | builder determinism — two builds byte-identical AND deep-equal to shipped JSON | no drift, no hand-editing |
| 8 | offline pairedItem lineage resolves all three refs along the chain | the chain is fully reachable |
| 9 | the diamond leaves the sibling branch unresolvable offline | the reason the empirical run died |

### `tests/response-interpretation-error-extraction.test.js` (new; 11/11 PASS)

| # | Test | What it proves |
| --- | --- | --- |
| 1 | `executeFailureInfo` null on empty stdout | no error → no failure entry |
| 2 | extracts name/message/nodeCause/lastNodeExecuted from an n8n execution error | Defect class 2 fix — the empirical payload shape |
| 3 | preserves the engine-reported name (`ExpressionError`) | raw name survives |
| 4 | null on success-shaped stdout | never fabricates a failure |
| 5 | maps malformed stdout to `UnparseableOutput`, truncated ≤300 chars | bounded diagnostics |
| 6 | `redact` masks a Bearer token inside extracted failure text | secrets never persist |
| 7 | `redact` masks JWT-shaped secrets | redaction extended |
| 8 | `executeCli` FAIL carries the structured failure | orchestrator receives it |
| 9 | spawn failure → detail only, no fabricated failure | nothing invented on infra errors |
| 10 | buildRunReport records structured failures into `failure_info` unchanged | report path |
| 11 | `failure_info` stays empty when execute passes | no phantom failures |

### Updated existing interpretation suites

`workflow.test.js` (chain-walk + terminal-no-outgoing + `topology.chain` deepEqual), `workflow-edges.test.js` (missing edge / wrong target / orphaned node, now chain-shaped), `workflow-build.test.js` (chain topology), `output-slots.test.js` (single chain target + out-of-range index). All interpretation suites green.

---

## 6. Full Test Gate

`npm test`: **768/768 PASS, 0 fail** (46 suites) — the 748-test Phase 5.3 baseline plus 20 new tests (9 topology + 11 error-extraction). No regressions across engine, contract, embedded mirrors, capture/reconcile suites, or the live-runner suite (including its source-literal scan, which passes against the new runner code).

---

## 7. Frozen Integrity Gate

`node scripts/verify-frozen.js`: **PASS — 7/7** artifacts SHA-256 verified against the re-baselined manifest.

| Frozen artifact | SHA-256 (after Phase 5.4) |
| --- | --- |
| `src/response-interpretation.js` | `1e3341dbeb02800d21cc69ea1a4648ef196f0982ce2ee98e11fde2c3c6afe401` (unchanged) |
| `src/response-interpretation-workflow-contract.js` | `8bb58c9beb51931af6d64811b8dc30daa6774917bcd85ed428dc80cd68792168` |
| `src/embedded-response-interpret.js` | `8d56121734094e3e9f14d0a8ab1f82db76d7b7b45f81e115753535acf0d7894c` (unchanged) |
| `src/response-interpretation-live-runner.js` | `7cffb808ca6480268fb8d5b1e0a0e220bcb63334a24f9a6354bead2c7bcc7dae` |
| `Response-Interpretation V1.json` | `ae365cd3b98fce08b95ccea9fae7661e4d1bde7f655326a4ed13b7031adb4bac` |
| `src/response-capture.js` | `83407df33c2f5b9f88185162480bb7abda600c9d43b79e345007ab1b8ab0f779` (unchanged) |
| `src/response-reconcile.js` | `7554973cbab19f7e68cdf363833bd34f6518843b05ce46d597a6a16dad0a6131` (unchanged) |

The four frozen-by-task sources are byte-identical to the Phase 6 baseline hashes (plan §7).

---

## 8. Manifest Decision (`frozen-artifacts.manifest.json`)

**v2 re-baselined — three artifacts re-pinned, changes recorded explicitly:**

- `Response-Interpretation V1.json`: `57b80b94…` → `ae365cd3…` (new revision entry — diamond→chain rewire, reason cites ExpressionError / `pairedItemNoConnectionCodeNode` and the 1-seeded-row empirical run).
- `src/response-interpretation-workflow-contract.js`: `7bfb4715…` → `8bb58c9b…` (new revision entry — chain rewiring + fan-in/fan-out checks + `pairedItemAncestors` + transitive-ancestor check).
- `src/response-interpretation-live-runner.js`: `ecf46417…` → `7cffb808…` (new revision entry — error surfacing + redaction extension).
- `about` updated with the Phase 5.4 note (chain, pairedItem defect class, and the explicit statement that builder `scripts/build-response-interpretation-workflow.js` is not a manifest artifact and carries no revision entry).
- Previous-phase revision history preserved.

Legitimate non-frozen changes that required **no** manifest action: `src/google-sheets-client.js` (not a manifest artifact — current hash recomputed: `c1850715…`, unchanged by this phase) and the build script.

---

## 9. Secret Scan

- `scripts/security-check.js`: exit 0. Its findings are pre-existing and legitimate — `GOOGLE_PLACES_API_KEY`, `Bearer`, `$env` are n8n env-var references in the untouched `Lead Recovery Engine - Prospect Finder & Validation V1.json`; no hardcoded Foursquare key.
- Targeted scan of every file changed by this phase (both new test files, the runner, the contract, the manifest): **no** real spreadsheet id (`1KN-mAYQ…` appears only as the frozen contract constant and pre-existing tests), no `AIza*`, `AKIA*`, `ya29.*`, `sk-*` literals, no PEM/private-key blocks, no `ghp_*`. All tests use synthetic ids and synthetic secret shapes fed to `redact` as negative assertions.

---

## 10. Unchanged Surfaces (Constraints Honored)

- Engine, embedded mirror, Capture, and Reconcile sources are byte-identical to their Phase 6 baselines (verified, §7).
- No node code, parameters, ids, types, names, or positions changed in the shipped workflow — only `connections` (§4).
- Preflight gates (A–E), execution backend (cli/http), exit-code contract, namespace/cleanup logic, and the `_request`/URL construction are untouched.
- No hand-editing of generated artifacts; the JSON was regenerated through the builder and cross-checked byte-identical via double build.
- No live n8n invoked in this phase; no Phase 6 scenarios ran; no Phase 7 work started; the Foursquare key surface (Prospect Finder, pre-existing) was not touched.

---

## 11. Next Move / Phase 6 Readiness

Phase 5.4 is complete and Phase 6 is re-ready. On **already-configured** containers the previous serialized workflow must be replaced:

1. **Re-import the chain artifact** `Response-Interpretation V1.json` (`ae365cd3…`) into the existing container/`workflowId` (replacing the serialized diamond so the pairing defect cannot survive from the old import).
2. `npm run response-interpret:test` and `npm run verify:frozen` both green before the live run (768/768, 7/7 already verified this phase).
3. Re-run Phase 6 live scenarios (A–F) with `RESP_INT_EXEC_BACKEND=cli`, `RESP_INT_EXEC_CONTAINER=…`, `RESP_INT_EXEC_BROKER_PORT=5677`. The interpret node now `$()`-reads only its own ancestry chain, so the seeded-row run must no longer produce `pairedItemNoConnectionCodeNode`; and if a future execution fails, the runner now records the structured ExpressionError in `failure_info` instead of a bare exit code.

## Completion Verdicts

- `PASS — PHASE 5.4 COMPLETE, PHASE 6 RE-READY` — chain rewire + contract hardening + runner error surfacing all landed; suite 768/768, verify:frozen 7/7, secret scan clean, manifest re-baselined with explicit revision entries, frozen-by-task sources untouched.
- `PARTIAL — PHASE 5.4 INCOMPLETE` — not applicable; all deliverables done.
- `FAIL — PHASE 5.4 BLOCKED` — not applicable; no blockers within Phase 5.4 scope.