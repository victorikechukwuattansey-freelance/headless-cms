# Phase 5.2 Report — Connection Output-Slot Correction

**Status:** PASS — PHASE 5.2 COMPLETE, PHASE 6 RE-READY

**Date:** 2026-09-13

---

## 1. Objective

Implement Phase 5.2 — correct the repo artifact's `Manual Trigger` connection defect (a single-output node wired across two output slots), fix the builder so both fan-out targets share `main[0]`, harden `assertWorkflowContract` against this defect class, update Phase 5.1 regression tests that encoded the malformed layout as correct, add an output-slot regression test file, re-baseline frozen manifest v2, re-run all gates, and stop after Phase 5.2 (no Phase 6 live scenarios, no Phase 7).

---

## 2. Defect Confirmed (Before)

The shipped `Response-Interpretation V1.json` `Manual Trigger` connections were:

```json
"Manual Trigger": { "main": [
  [{ "node": "Read Response Log", "type": "main", "index": 0 }],
  [{ "node": "Read Reconciliation Report", "type": "main", "index": 0 }]
] }
```

`n8n-nodes-base.manualTrigger` exposes **exactly one output**. Connections are indexed `main[outputIndex][connectionIndex]`, so targets on `main[1]` are **silently discarded at runtime**. Every execution stopped at `lastNodeExecuted = "Read Response Log"`; `Read Reconciliation Report` and `Interpret Responses` never ran. When the container imported the artifact, n8n normalized the invalid `main[1]` slot away, producing the divergent stored copy — the blocker was never the container, it was the repo artifact.

### Per-node output-slot audit (shipped workflow)

| Node | Type | Outputs | main slots | Slot contents (each edge `-> target`) |
| --- | --- | --- | --- | --- |
| Manual Trigger | `n8n-nodes-base.manualTrigger` | 1 | 1 | `main[0] -> Read Response Log`; `main[0] -> Read Reconciliation Report` |
| Read Response Log | `n8n-nodes-base.googleSheets` | 1 | 1 | `main[0] -> Interpret Responses` |
| Read Reconciliation Report | `n8n-nodes-base.code` | 1 | 1 | `main[0] -> Interpret Responses` |
| Interpret Responses | `n8n-nodes-base.code` | 1 | 1 | `main[0] -> Response Interpretation Complete` |
| Response Interpretation Complete | `n8n-nodes-base.noOp` | 1 | 0 | (terminal node — no outbound edges) |

Edge-validity audit: every edge's `index` field (0) `<` its source output count (1) — **valid**; branch index 0 `<` output count 1 — **valid**; number of branches (1) `<=` output count (1) — **valid** after the correction.

---

## 3. The Correction (After)

```json
"Manual Trigger": { "main": [
  [
    { "node": "Read Response Log", "type": "main", "index": 0 },
    { "node": "Read Reconciliation Report", "type": "main", "index": 0 }
  ]
] }
```

Both fan-out targets live in the single valid output slot `main[0]`. Per the n8n runtime rule — a node with N outputs must have exactly N `main` arrays, and every edge to output index `i` lives in `main[i]` — this topology now reaches all five nodes from the trigger.

---

## 4. Builder Change

`scripts/build-response-interpretation-workflow.js` (in `responseInterpretationWorkflow()`) now overrides the Manual Trigger connections before injecting the embedded jsCode, replacing the two-slot array with the single-slot `main[0]` holding both targets. The builder is **not** part of the frozen manifest set (7 frozen artifacts; builder not among them), so no manifest entry applies.

---

## 5. Regeneration & Determinism Evidence

- Ran the builder **twice** — outputs byte-identical (`a === b`).
- Shipped file `== built + '\n'` (trailing newline retained as before).
- New shipped SHA-256: `57b80b947fe0d08054285590ffe8ea2d5ef225bdc8e8daad79c0eae7470e2dce` (was `6b0c6a006d4d745f3e89702a7af8d2100f87132d5cd9b29b84e932aa7c564c03`).
- Structural checks: 5 nodes present, workflow `active: false`, `meta.generatedBy` intact, exactly 2 jsCode code nodes, `alwaysOutputData` on the two read-consumers preserved.
- Defect marker check: `"], ["` absent from the Manual Trigger connections block (`false`).
- **Diff confinement:** `git diff` vs the committed shipped JSON shows the change is **exactly** the Manual Trigger connections block (4 lines: two-slot array → single slot with both targets). Nothing else changed.

---

## 6. Contract Hardening (`src/response-interpretation-workflow-contract.js`)

Added to `assertWorkflowContract` (pure, offline, names the offending edge/node):

- `NODE_OUTPUT_COUNTS` table: the 5 node types (manualTrigger/googleSheets/code/noOp) each have exactly 1 output.
- Branch-index check: a connection `main[i]` where `i >= outputCount` fails with `main[i] exceeds output count (N) for source "..."`.
- Branch-count check: a `main` array with more slots than the source's output count fails with `main array has M branch(es) but "..." has only N output(s)`.
- Per-edge `index` check: an edge whose own output `index >= outputCount` fails with `edge S -> T references output index I but "S" has only N output(s)`.
- Reachability under n8n runtime semantics: confirmed via the existing `reachableNodes` BFS over the exact edge set (all 5 nodes reachable from the trigger).
- `referenceWorkflow()` connection layout corrected to the single-output-slot fan-out (matches the builder + shipped JSON); all Phase 5.1 assertions preserved.
- The prior fanout check now validates the single-branch arrangement (`numBranches === 1` with both read targets present).

The validator **PASSES** on the regenerated shipped workflow.

---

## 7. Regression Tests

### `tests/response-interpretation-workflow-edges.test.js` (updated; 14/14 PASS)
Phase 5.1 tests that encoded the two-branch `[[a],[b]]` layout as correct were updated to the corrected single-slot `main[0]` structure: missing-target mutations now remove one target from the combined slot; wrong-target and orphan/unreachable/reference scenarios build the mutated single-slot form instead of `main[1]`. All 14 edge tests pass.

### `tests/response-interpretation-output-slots.test.js` (new; 6/6 PASS)
1. shipped Manual Trigger has exactly one output slot holding both fan-out targets;
2. no connection in the shipped JSON references an output index beyond its source's output count;
3. contract fails when a single-output node uses a second `main` output slot;
4. contract fails when a target edge references an out-of-range output index;
5. reachable-node computation reaches all 5 nodes from the trigger;
6. builder output is byte-for-byte reproducible across two runs.

### `tests/response-interpretation-workflow.test.js` (updated; 1 line)
Reference-workflow fanout expectation corrected from `[[RRL], [RRR]]` to `[[RRL, RRR]]`.

---

## 8. Full Test Gate

`npm test`: **734/734 PASS, 0 fail** (46 suites). Includes the 6 new output-slot tests, the updated 14 edge tests, and the corrected reference-workflow fanout test; no regressions against the Phase 5.1 baseline.

---

## 9. Frozen Integrity Gate

`node scripts/verify-frozen.js`: **PASS — 7/7** artifacts SHA-256 verified.

Only the two intentionally changed artifacts moved:
- `Response-Interpretation V1.json`: `6b0c6a00…` → `57b80b94…`
- `src/response-interpretation-workflow-contract.js`: `dbc45212…` → `7bfb4715ab9ba2d340e5a01a3d5383044a549c1ee2d8d7dace2e060618218115`

Confirmed byte-identical to their manifest baselines (unchanged):
- `src/response-interpretation-live-runner.js` → `ecf46417d700d87cefa99efa4fd37f2e9ec35e6b9f8680578303837111989f68`
- `src/response-interpretation.js` → `1e3341dbeb02800d21cc69ea1a4648ef196f0982ce2ee98e11fde2c3c6afe401`
- `src/embedded-response-interpret.js` → `8d56121734094e3e9f14d0a8ab1f82db76d7b7b45f81e115753535acf0d7894c`
- `src/response-capture.js` → `83407df33c2f5b9f88185162480bb7abda600c9d43b79e345007ab1b8ab0f779`
- `src/response-reconcile.js` → `7554973cbab19f7e68cdf363833bd34f6518843b05ce46d597a6a16dad0a6131`

---

## 10. Manifest Re-baseline (`frozen-artifacts.manifest.json`)

- `about` amended: Phase 5.2 re-baselines JSON + contract; **Phase 5.1's claim that the repo artifact was structurally correct is superseded** — the artifact itself carried the invalid `main[1]` output slot.
- Two artifact entries updated (contract `7bfb4715…`, JSON `57b80b94…`).
- Two new revision entries:
  - `Response-Interpretation V1.json` (previous `6b0c6a00…` → `57b80b94…`), referencing `reports/PHASE-6-BLOCKER-REPORT.md` and the invalidated Phase 5.1 determination.
  - `src/response-interpretation-workflow-contract.js` (previous `dbc45212…` → `7bfb4715…`), referencing this report.
- No other artifact entry or revision was touched; manifest parses as valid JSON; verify:frozen 7/7 PASS.

---

## 11. Secret Scan

Scanned the modified/new files (contract, builder, both test files, manifest) for credential material: `sk-*`, Google `AIza*`, `Authorization`, `Bearer`, private keys, API keys, passwords, tokens — **no matches** (contract's `Authorization` occurrence is its own banned-pattern detector, not a credential). No credentials introduced in code or tests.

---

## 12. Unchanged Surfaces (Constraints Honored)

- Engine, embedded mirror, Capture, Reconcile, and live runner are **byte-identical** to their manifest baselines.
- No node parameter values, embedded code bodies, node ids, node names, or type versions were changed (only the Manual Trigger connections block).
- Shipped JSON is **builder-derived only** — never hand-edited.
- No live n8n was invoked; no Phase 6 scenarios ran; no Phase 7 work started.

---

## 13. Next Move / Phase 6 Readiness

Phase 5.2 is complete and the corrected artifact (`57b80b94…`) passes every gate. Phase 6 is **RE-READY** pending operator actions only:

1. **Re-import** `Response-Interpretation V1.json` (hash `57b80b94…`) into container `serene_swartz` workflow `gLzXBltBMeVcUIEN` (the prior container copy's missing edge now has a correct single-slot source).
2. Provide `GOOGLE_ACCESS_TOKEN` and `N8N_API_KEY` to close environment gates E3/REST.
3. Re-run Phase 6 live scenarios (A–F) with `RESP_INT_EXEC_BACKEND=cli`, `RESP_INT_EXEC_CONTAINER=serene_swartz`, `RESP_INT_EXEC_BROKER_PORT=5677`, evidence capture, redaction, and `TEST-RESP-INT-LIVE-*` cleanup.

## Completion Verdicts

- `PASS — PHASE 5.2 COMPLETE, PHASE 6 RE-READY` — defect corrected, contract hardened, tests green (734/734), verify:frozen 7/7, secret scan clean.
- `PARTIAL — PHASE 5.2 INCOMPLETE` — not applicable; all deliverables done.
- `FAIL — PHASE 5.2 BLOCKED` — not applicable; no blockers within Phase 5.2 scope.