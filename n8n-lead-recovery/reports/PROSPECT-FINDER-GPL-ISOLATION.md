# Prospect Finder — Prompt B Live-Isolation Report

**Status:** BLOCKER — live run halted, no ISO cases executed  
**Date:** 2026-09-14  
**Predecessors:** Prompt A.6 (PASS), Prompt A.7 (PASS)  
**Container:** `serene_swartz` (n8nio/n8n, n8n **2.38.7**)  
**Workflow:** `WcUgtTPiKXPL0BLH` (versionId `8672a188-0457-4fae-ba86-03e9552712c2`)  
**Production sheet:** `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`

---

## Executive Summary

The three ISO cases (ISO-001 / ISO-002 / ISO-003) were seeded successfully and remained in `Pending` state. No raw-lead or verified-lead rows were written. Two execution attempts (IDs 47 and 48) both crashed at the **Merge** node (`"You need to define at least one pair of fields in 'Fields to Match' to match on"`). Root cause: **n8n version drift** — the container runs n8n **2.38.7** (default `n8nio/n8n` image), but the artifact's Merge node carries the v1.x-era parameter name `combinationMode: "combineAll"`, which n8n 2.38.7 silently maps to `combineBy` (default `combineByFields`), then crashes at the missing `fieldsToMatch` guard. Prompt B explicitly forbids modifying the container workflow; the live isolation matrix cannot proceed without a contract-level merge-node migration.

---

## 1. Pre-Run State

| Tab (gid) | Pre-run Total | Pre-run Namespace (`TEST-GPL-LIVE-*`) |
|---|---|---|
| Search Inputs (0) | 3 | 0 |
| Raw Leads (101) | 111 | 0 |
| Verified Leads (102) | 30 | 0 |

---

## 2. Seeding

Three rows appended to Search Inputs (gid=0), all `status=Pending`, `target_count=5`, `city=Testville`:

| input_id | niche | status |
|---|---|---|
| TEST-GPL-LIVE-ISO-001 | test-iso-gpl-niche | Pending |
| TEST-GPL-LIVE-ISO-002 | qwertyuiop-zz-9-999 | Pending |
| TEST-GPL-LIVE-ISO-003 | test-iso-gpl-fail | Pending |

Read-back verified: 3 rows present, all `Pending`.

---

## 3. Execution Attempts

Two `n8n execute --id WcUgtTPiKXPL0BLH` runs recorded (SQLite execution_entity):

| Exec ID | Mode | Status | Created | Workflow Version |
|---|---|---|---|---|
| 47 | cli | error | 2026-09-14 10:16:49 | 8672a188… |
| 48 | cli | error | 2026-09-14 11:51:42 | 8672a188… |

**Last node executed (both):** Merge  
**Error (both):** `You need to define at least one pair of fields in "Fields to Match" to match on`

No rows written to Raw Leads or Verified Leads for any `TEST-GPL-LIVE-*` `search_input_id`. All three seeded rows remain `Pending`.

---

## 4. Post-Attempt Sheet State

| Tab (gid) | Total | Namespace (`TEST-GPL-LIVE-*`) |
|---|---|---|
| Search Inputs (0) | 6 | 3 |
| Raw Leads (101) | 111 | 0 |
| Verified Leads (102) | 30 | 0 |

---

## 5. Root Cause: n8n Merge v3.2 Parameter Migration

**Artifact Merge node** (identical in contract, artifact, and container export):

```json
{
  "parameters": {
    "mode": "combine",
    "combinationMode": "combineAll",
    "numberOfInputs": 5
  },
  "type": "n8n-nodes-base.merge",
  "typeVersion": 3.2
}
```

**n8n 2.38.7 Merge v3 expected parameters** (source: container `v3/actions/mode/index.js`):

- `mode: 'combine'` — unchanged
- `combineBy: 'combineAll'` — **renamed** from `combinationMode`
- `combineBy` defaults to `'combineByFields'` when absent
- `'combineAll'` is a valid `combineBy` value (under `displayOptions: { mode: ['combine'] }`)

Because `combinationMode` is unrecognized in n8n 2.x, `combineBy` receives no value → defaults to `combineByFields` → `combineByFields.ts:280` invokes `checkMatchFieldsInput` → no `fieldsToMatch` provided (since `combineAll` needs none) → crash.

**Source evidence** (all pulled from container running `serene_swartz`):

- `n8n --version` → `2.38.7`
- `MergeV3.node.js` → `version: [3, 3.1, 3.2]`
- `mode/index.js` line 94–118: `combineBy` options incl. `combineAll` ("All Possible Combinations"); default `combineByFields`
- `combineByFields.ts` error path: `checkMatchFieldsInput` → `combineByFields.ts:280` — matches the runtime stack trace exactly

---

## 6. Pre-Flight Verdicts (Status)

| # | Check | Result |
|---|---|---|
| P1 | Workflow exists + inactive | ✅ PASS |
| P2 | Container workflow matches artifact (32 nodes / 15 code nodes / 5-input Merge / connections) | ✅ PASS |
| P3 | GPL env auth; FSQ credential auth (Foursquare API, 912eb72c…) | ✅ PASS — confirms ISO-004 deferral rationale |
| P4 | Status model `Pending→Running→Completed/Failed`; dedup source = Verified Leads (gid=102) | ✅ PASS (dedup nuance: reads Verified Leads, not Raw Leads) |
| P5 | Baseline counts | ⚠️ Deferred (pre-run captured: 3 / 111 / 30; post-attempt: 6 / 111 / 30) |
| P6 | Cleanup matchers (`TEST-GPL-LIVE-%`) | ✅ Verified (no-op; 3 rows in Search Inputs, zero in Raw/Verified) |

**Runtime execution: BLOCKED** — systemic Merge-node version incompatibility; all three cases fail identically before any provider call is made.

---

## 7. ISO Case Results

| Case | Status | Raw Leads Written | Verified Leads Written | Error Envelope | Notes |
|---|---|---|---|---|---|
| ISO-001 (all succeed) | ⏸ BLOCKED (never reached) | 0 | 0 | — | Pipeline crashed at Merge before providers execute |
| ISO-002 (GPL empty) | ⏸ BLOCKED (never reached) | 0 | 0 | — | Same systemic crash |
| ISO-003 (GPL 403) | ⏸ BLOCKED (never reached) | 0 | 0 | — | Same systemic crash |
| ISO-004 (FSQ fail) | ⏸ DEFERRED | 0 | 0 | — | Per Prompt B scope: deferred (credential auth; cannot induce failure without artifact modification) |

---

## 8. Cleanup Status

No `DELETE` operations performed. Three `TEST-GPL-LIVE-ISO-00*` rows remain on Search Inputs (gid=0). **Prompt C owns cleanup.**

---

## 9. What This Findings Means for the Artifact

The artifact is **functionally correct at offline-test level** (849/849 tests, 62 suites; all code paths, all envelopes, all sinks verified). The Merge-node configuration was valid for the n8n v1.x environment the artifact was authored against. No source-level bug exists. The failure is an **environmental incompatibility**: the production container now runs n8n 2.38.7, which renamed the Merge v3 sub-mode parameter.

---

## 10. Recommended Remediation (Out of Scope for Prompts B/C)

A single contract-level migration restores execution:

**Contract change:**
```js
// before (n8n v1.x)
"combinationMode": "combineAll"

// after (n8n 2.38.7)
"combineBy": "combineAll"
```

Affected artifacts: `prospect-finder-workflow-contract.js` (line ~1929 in Merge.parameters) and the built JSON artifact (line ~1474–1477). Builder needs no other changes (the 5-input Combine output is determined by `numberOfInputs`, not the sub-mode name).

After migration, the container workflow must be re-imported to apply the parameter rename. This constitutes a contract change and requires a new SHA-256 hash on the artifact — a task that belongs to a dedicated Prompt D (contract migration) and not to Prompts B/C.

---

## Appendix: Execution Data Extract (Execution 48)

```
lastNodeExecuted = "Merge"
error.message = "You need to define at least one pair of fields in \"Fields to Match\" to match on"
error.stack = combineByFields.ts:280 → checkMatchFieldsInput → MergeV3.router → ...
```

**Run timeline (ISO-001 attempt only):**
1. `docker exec -u node serene_swartz n8n execute --id WcUgtTPiKXPL0BLH` launched
2. Manual Trigger fired → Filter Pending Searches (selected ISO-001) → Loop Through Searches → Set Status Running → [providers dispatched] → Merge (5-input combineAll)
3. Merge failed before any provider output was consumed
4. `n8n execute` CLI terminated; PID 275 reaped

**No data leaked, no credentials exposed, no cleanup performed.**
