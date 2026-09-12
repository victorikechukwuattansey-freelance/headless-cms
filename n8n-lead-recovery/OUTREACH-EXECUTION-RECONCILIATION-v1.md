# Outreach Execution Reconciliation V1

**Version 1 — 2026-09-11**
**Workflow:** `Execution-Reconciliation V1.json`
**Artifact lineage:** Outreach Execution & Delivery V1 (execution) → **Outreach Execution Reconciliation V1** (read-only reconciliation)
**Execution status:** Read-only observability — zero provider calls, zero writes, zero side effects.

The read-only consistency checker between execution evidence (operator-supplied reports from Outreach Execution & Delivery V1) and the durable Outreach Log. It detects gaps, duplicates, and semantic violations; it never executes, sends, or repairs.

---

## 1. Purpose

Answer "was every provider-confirmed execution reflected in the durable Outreach Log, and was every log row traceable to a documented execution?" — honestly, not deceptively. This artifact never writes to any sheet, never calls a provider, and never auto-repairs. It reports what execution evidence and the Outreach Log together can prove, and it reports where they diverge.

---

## 2. Evidence Contract

Each execution report carries these per-record fields:

| Field | Values | Meaning |
|---|---|---|
| `status` | `EXECUTION_SUCCEEDED` \| `EXECUTION_FAILED` \| `EXECUTION_SKIPPED` \| `EXECUTION_REJECTED` \| `DUPLICATE_SUPPRESSED` | recorded outcome |
| `readiness_status` | `READY` \| `NOT_READY` \| `BLOCKED` | queue state at execution time |
| `mode` | `DRY_RUN` \| `REAL` | whether the run could have called a provider |
| `provider` | `SUCCESS` \| `FAILURE` \| `NOT_CONFIGURED` | provider adapter state |
| `provider_configured` | `true` \| `false` | `true` when adapter is `SUCCESS` or `FAILURE` |
| `provider_call` | `{ success, provider_status, provider_message_id }` | provider result (only when provider was called) |
| `sent_at` | ISO timestamp | when the attempt was recorded |

**Key semantics:**
- `EXECUTION_SUCCEEDED` = provider confirmed the attempt. Log row appended.
- `EXECUTION_FAILED` = provider was called and declined. No log row.
- `EXECUTION_SKIPPED` = queue gate (BLOCKED/NOT_READY/DRY_RUN). No provider called. No log row.
- `EXECUTION_REJECTED` = payload invalid or no valid channel. No provider called. No log row.
- `DUPLICATE_SUPPRESSED` = lead+channel already in Outreach Log. No call. No write.

A log row exists in the Outreach Log **only** when `EXECUTION_SUCCEEDED` on a `REAL` run. The log row's `lead_id`+`channel`+`sent_at`+`outreach_id`+`email`/`phone` are appended by the Write Outreach Log node.

**Canonical idempotency key:** `(lead_id, channel)` — used by the reconciliation to pair each confirmed execution with at most one log row.

---

## 3. Matching Semantics

Matching is greedy, index-free, and order-independent. Records are grouped by `(lead_id, channel)` bucket and sorted by `sent_at` before pairing.

| Execution state | Log present | Result |
|---|---|---|
| `EXECUTION_SUCCEEDED` + log row with same `sent_at` | Yes | matched |
| `EXECUTION_SUCCEEDED` + no matching `sent_at` log row | No | EXECUTION_WITHOUT_LOG (WARNING) |
| `EXECUTION_SUCCEEDED` + multiple `sent_at` log rows | Multiple | first matched, extras → DUPLICATE_LOG (ERROR) |
| `EXECUTION_SUCCEEDED` + first `DUPLICATE_LOG` | Extra | DUPLICATE_LOG |
| `EXECUTION_FAILED` / `EXECUTION_SKIPPED` / `EXECUTION_REJECTED` / `DUPLICATE_SUPPRESSED` | Any | not emitted — absence is expected |

A log row with no corresponding `EXECUTION_SUCCEEDED` record is classified by execution mode priority: DRY_RUN_PERSISTENCE (ERROR) > NOT_CONFIGURED_PERSISTENCE (ERROR) > FAILED_AS_SUCCESS (ERROR) > LOG_WITHOUT_EXECUTION (WARNING).

---

## 4. Categories (11)

| Category | Severity | When |
|---|---|---|
| EXECUTION_WITHOUT_LOG | WARNING | succeeded execution not found in log (sent_at mismatch or absent) |
| LOG_WITHOUT_EXECUTION | WARNING | log row has no corresponding succeeded execution |
| DUPLICATE_EXECUTION | ERROR | first-succeeded in bucket marked unmatched; extras flagged |
| DUPLICATE_LOG | ERROR | first log row in bucket matched; extra log rows with different sent_at |
| FAILED_AS_SUCCESS | ERROR | provider failed but log row exists |
| NON_READY_EXECUTION | ERROR | NOT_READY/BLOCKED execution reached the provider boundary |
| INVALID_CHANNEL | WARNING | email/phone validation on outreach log row |
| DRY_RUN_PERSISTENCE | ERROR | log row present when execution mode is DRY_RUN |
| NOT_CONFIGURED_PERSISTENCE | ERROR | log row present when provider is NOT_CONFIGURED |
| MALFORMED_RECORD | WARNING | records missing required fields |
| SOURCE_READ_FAILURE | ERROR | execution evidence or outreach log read failed (entire run = FAILED) |

**Violation count:** DUPLICATE_EXECUTION + DUPLICATE_LOG + FAILED_AS_SUCCESS + NON_READY_EXECUTION + DRY_RUN_PERSISTENCE + NOT_CONFIGURED_PERSISTENCE — the six ERROR categories that indicate a integrity breach.

---

## 5. Report Shape

```
{
  run_id: 'EXECRECON-20260911090000',
  run_at: '2026-09-11T09:00:00.000Z',
  detected_at: '2026-09-11T09:00:00.000Z',
  evidence_available: true,
  status: 'COMPLETED' | 'INCOMPLETE' | 'FAILED',
  sources: {
    evidence_ok: true,
    outreach_ok: true,
    evidence_read_error: '',
    outreach_read_error: '',
    evidence_available: true
  },
  summary: {
    execution_records: 4,    // null when FAILED
    log_records: 4,          // null when FAILED
    matched: 3,
    unmatched_execution: 1,
    unmatched_log: 0,
    duplicate_execution: 0,
    duplicate_log: 0,
    invalid_execution: 0,
    invalid_log: 0,
    violations: 0,
    coverage_rate: 0.75,
    exception_count: 0
  },
  matched: [...],            // canonical idempotency keys
  unmatched_execution: [...], // succeeded but not in log
  unmatched_log: [...],       // in log but no succeeded execution
  exceptions: [...]           // envelope per exception
}
```

---

## 6. Exception Envelope

Every exception carries:

```
{
  category: 'SOURCE_READ_FAILURE',
  severity: 'ERROR',
  lead_id: '',
  execution_id: '',
  channel: '',
  outreach_id: '',
  reason: '',
  evidence: { source: 'outreach log', error: 'Sheet "Outreach Log" is unavailable' },
  detected_at: '2026-09-11T09:00:00.000Z',
  run_id: 'EXECRECON-20260911090000'
}
```

No `email`, `phone`, `message_variant`, or `provider_message_id` is ever included. Exceptions are sorted deterministically by `[category, lead_id, channel, reason]`.

---

## 7. Status Semantics

| Status | Meaning |
|---|---|
| `COMPLETED` | both sources read and reconciled; summary fully populated |
| `INCOMPLETE` | execution evidence not available (null metrics) |
| `FAILED` | one or both sources failed to read; all metrics null |

When `status = INCOMPLETE` or `FAILED`, every summary metric except `exception_count` is `null` — never zero. Coverage rate is null when execution records are null.

---

## 8. Null vs Zero Semantics

This artifact distinguishes:

- `null` = "this data was not available to me" (FAILED/INCOMPLETE)
- `0` = "I looked and found nothing" (COMPLETED with empty data)

Never confuse the two. A COMPLETED run with zero execution records means "both sources were read successfully and no execution evidence or log rows were found." A FAILED run means "the read itself failed; I cannot say anything about the data."

---

## 9. Workflow Structure

```
Manual Trigger
   │
   ├──▶ Initialize Execution Evidence   (Code — { execution_reports, evidence_available })
   ├──▶ Read Outreach Log              (googleSheets, READ, tab 'Outreach Log')
                │
                ▼
        Reconcile Execution Records    (Code — src/execution-reconcile.js mirror)
                │
                ▼
        Execution Reconciliation Complete  (NoOp)
```

**Zero write nodes.** This artifact never writes to any sheet, never sends to a provider, never creates, updates, or deletes any record. The only write-like action is the reports/ artifact JSON produced by the live harness for audit purposes.

---

## 10. Fixture Suite (`fixtures/execution-recon-fixtures.json`, 18 fixtures)

| ID | Name | Covers |
|---|---|---|
| `TEST-EXEC-RECON-001` | PERFECT_MATCH | 1 succeeded + 1 log row = 1 match |
| `TEST-EXEC-RECON-002` | EXECUTION_WITHOUT_LOG | 1 succeeded, 0 log rows |
| `TEST-EXEC-RECON-003` | LOG_WITHOUT_EXECUTION | 0 execution, 1 log row with valid timestamp |
| `TEST-EXEC-RECON-004` | DUPLICATE_EXECUTION | 2 identical succeeded records, 1 log row |
| `TEST-EXEC-RECON-005` | EMPTY_SOURCES | empty evidence + empty log = COMPLETED |
| `TEST-EXEC-RECON-006` | INCOMPLETE_NO_EVIDENCE | evidence_available=false = INCOMPLETE |
| `TEST-EXEC-RECON-007` | SOURCE_READ_FAILURE | evidence read failure = FAILED |
| `TEST-EXEC-RECON-008` | REORDER_INDEPENDENCE | same events, different order = same outcome |
| `TEST-EXEC-RECON-009` | FAILED_AS_SUCCESS | provider failure + log row present |
| `TEST-EXEC-RECON-010` | NON_READY_EXECUTION | NOT_READY status reached provider boundary |
| `TEST-EXEC-RECON-011` | MALFORMED_RECORD | missing lead_id / channel |
| `TEST-EXEC-RECON-012` | MULTI_CHANNEL_SPLIT | email vs call are independent buckets |
| `TEST-EXEC-RECON-013` | HISTORICAL_UNAVAILABLE | succeeded but evidence unavailable (skipped in available mode) |
| `TEST-EXEC-RECON-014` | DRY_RUN_PERSISTENCE | DRY_RUN mode + log row present |
| `TEST-EXEC-RECON-015` | NOT_CONFIGURED_PERSISTENCE | NOT_CONFIGURED provider + log row present |
| `TEST-EXEC-RECON-016` | DUPLICATE_LOG | 1 succeeded + 2 log rows with different sent_at |
| `TEST-EXEC-RECON-017` | PARTIAL_READ_FAILURE | outreach read failure + evidence OK |
| `TEST-EXEC-RECON-018` | PROVIDER_FAILURE_SEMANTICS | NOT_CONFIGURED/DRY_RUN never stage |

Fixtures carry `{ id, name, evidence, evidence_available, read_errors, outreachRows, outreach, expected }`. The engine test asserts all expected metrics; the workflow parity test asserts identical output from the embedded code; the harness test runs a full SEED→RUN→VERIFY→CLEANUP→VERIFY-FINAL lifecycle using fixture 001.

---

## 11. Run Lifecycle (Live Harness)

`scripts/run-execution-reconciliation-live.js` (+ `run-execution-reconciliation-live.ps1`, `npm run execution-recon:live`):

| Phase | Action |
|---|---|
| SEED | append `TEST-EXEC-RECON-*` Outreach Log rows from the chosen fixture (idempotent by lead_id) |
| RUN | reconcile the fixture's recorded evidence against the Outreach Log rows; write `reports/<run_id>-execution-reconciliation.json` |
| VERIFY | read the live Outreach Log, reconcile against the fixture's evidence, assert all `expected` metrics, write artifact |
| CLEANUP | delete only `TEST-EXEC-RECON-*` rows from the Outreach Log |
| VERIFY-FINAL | confirm zero `TEST-EXEC-RECON-*` rows remain |

Read-error fixtures (017) are **refused live** — they model sheet read failures that cannot occur against a live spreadsheet. Covered by unit tests only.

---

## 12. Test Suites

| Suite | File | Tests |
|---|---|---|
| Engine | `tests/execution-reconcile-engine.test.js` | 25 — all categories, matching, determinism, envelope hygiene, null semantics |
| Workflow sync | `tests/execution-reconcile-workflow.test.js` | 13 — structure, 5 nodes, zero writes, no secrets, embedded↔engine parity |
| Live harness | `tests/execution-reconcile-harness.test.js` | 17 — e2e lifecycle, MockSheets, namespace guards, read-error refusal |

Run: `npm run execution-recon:test` (trio), `npm run execution-recon:build` (re-emit the JSON), `npm test` (full suite).

**Verification status (offline):** engine 25/25, workflow 13/13, harness 17/17 = **55/55 PASS**.

---

## 13. Manual Run (n8n)

1. Import `Execution-Reconciliation V1.json` into n8n (same spreadsheet credentials as other lead-recovery workflows).
2. The workflow ships `active:false`. Inspect the `Initialize Execution Evidence` node — `execution_reports` is empty, `evidence_available` is `true` (safe defaults).
3. **To run a local reconciliation:** load evidence from a prior execution's `reports/*-execution.json` artifact into the `Initialize Execution Evidence` code node, execute once, read the report on `Execution Reconciliation Complete`.
4. **To run a live reconciliation against the actual Outreach Log:** pass real evidence in the Initialize node; the workflow reads the Outreach Log and reports.

---

## 14. Summary Counts

| Metric | Value |
|---|---|
| Engine tests | 25 |
| Workflow parity tests | 13 |
| Live harness tests | 17 |
| **Total** | **55** |
| Verdict | **55/55 PASS** |
| Live verification | **NOT RUN** (no live spreadsheet creds or real provider in this environment) |

---

## 15. Verification Status (Offline)

| Area | Status | Note |
|---|---|---|
| Engine: all 18 fixture scenarios + determinism + envelope hygiene | **PASS** | 25/25 |
| Workflow structural + embedded↔engine parity | **PASS** | 13/13 |
| Live harness: MockSheets e2e SEED→RUN→VERIFY→CLEANUP→VERIFY-FINAL | **PASS** | 17/17 |
| n8n live execution of the shipped JSON | **NOT RUN** | no n8n endpoint available |
| Live Google Sheets boundary | **NOT RUN** | no live spreadsheet creds available |

**Overall: PASS WITH LIMITATIONS** — all offline validation green; live boundary cannot be validated in this environment and is documented as NOT RUN rather than claimed.

---

## 16. Known Limitations

- This artifact never executes, sends, calls a provider, or auto-repairs. Any discrepancy in the report requires manual investigation and manual correction.
- The execution evidence supplied to the `Initialize Execution Evidence` node is operator-provided; the engine cannot verify evidence authenticity.
- When `evidence_available` is false, the report is honest (INCOMPLETE) but can provide no coverage metrics.
- Source read failures produce a FAILED report with all metrics null — a deliberate false-positive-avoidance choice. A zero-value summary from a read failure would be dishonest.
- The fixture builder mirrors the reconciliation logic; it is NOT an independent reference. The 25 engine tests are the authoritative validation.

---

## 17. Lineage

```
Approved Outreach Handoff V1
   └──▶ Run Reconciliation and Reporting V1
            └──▶ Outreach Queue & Planning V1
                     └──▶ Outreach Execution & Delivery V1
                              ├──▶ [execution reports]
                              └──▶ [outreach log rows]
                                       └──▶ Outreach Execution Reconciliation V1
```

---

## 18. Changelog

- **2026-09-11:** V1 complete — engine 25/25, workflow 13/13, harness 17/17 = 55/55 PASS (OFFLINE). Live NOT RUN.
