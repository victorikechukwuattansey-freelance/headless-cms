# Run Reconciliation and Reporting V1

**Version 1 — 2026-09-11**
**Workflow:** `Run-Reconciliation-and-Reporting V1.json`
**Artifact lineage:** Prospecting + Validation V1 → Approved Outreach Handoff V1 → **Run Reconciliation and Reporting V1**

Read-first, deterministic reconciliation and reporting between the **Approved Outreach** approval ledger and the **Outreach Log** activity log. It detects inconsistencies, surfaces operational metrics, and emits a structured report plus a deterministic exception list. **It does not send outreach, enrich contacts, write to any source tab, or repair any record.**

---

## 1. Source of Truth

The following are authoritative; nothing may contradict them without a visible change request:

| Layer | Source |
|---|---|
| Approved Outreach schema (21 cols A–U) | `src/schema.js` → `APPROVED_COLUMNS` (shared with Approved Outreach Handoff V1) |
| Outreach Log schema (20 cols A–T) | **This artifact, spec §3.** No canonical schema exists in the repo or vault; this artifact adopts and documents the spec schema. Successors must reuse it, not invent another. |
| Status vocabulary | `src/reconcile.js` → `RECONCILE_STATUSES` (mirrors the `workflows/lead-recovery-engine/discovery/` state machine; production handoff currently only writes `not_ready`) |
| Business rules | Approved Outreach Handoff V1 / Prospecting + Validation V1 — **not modified by this artifact** |

**The Outreach Log schema (columns A–T):**

| # | Column | # | Column |
|---|---|---|---|
| A | `outreach_id` | K | `follow_up_number` |
| B | `lead_id` | L | `reply_status` |
| C | `business_name` | M | `reply_date` |
| D | `contact_name` | N | `pain_admitted` |
| E | `channel` | O | `call_booked` |
| F | `email` | P | `call_date` |
| G | `phone` | Q | `paid_pilot_interest` |
| H | `message_variant` | R | `objection` |
| I | `sent_at` | S | `outcome` |
| J | `follow_up_date` | T | `notes` |

---

## 2. Semantics and Classification

### 2.1 Status vocabulary

`'' · not_ready · queued · prepared` → pre-send
`contacted · follow_up_due · replied · qualified · demo · pilot · won · lost` → post-send
`suppressed` → neutral

### 2.2 Classification categories

| Category | Meaning | Handling |
|---|---|---|
| **A. APPROVED_NO_OUTREACH** | Approved, no confirmed outreach activity | **INFO/ACTIONABLE** — reported, not an exception |
| **B. APPROVED_WITH_OUTREACH** | Approved + exactly one log record, status consistent | **HEALTHY** |
| **C. MULTIPLE_OUTREACH** | Approved + more than one log record | Count + first/latest `sent_at` surfaced; **not auto-flagged as an error** |
| **D. OUTREACH_WITHOUT_APPROVAL** | Log records with no matching Approved row | **Orphan exception (ERROR)** — reported, **never deleted** |
| **E. MALFORMED_OUTREACH** | Log record missing `lead_id` or `sent_at` | **Exception (ERROR)** — reported, **never discarded** |
| **F. MALFORMED_APPROVAL** | Approved row missing `lead_id` or `approved_at` | **Exception (ERROR)** — reported, **never mutated** |

### 2.3 Status mismatch rules

A mismatch is one of two staleness/plausibility failures:

1. `outreach_status` is **post-send** (e.g. `contacted`) but **no outreach activity is logged** → phantom progress.
2. **Outreach activity is logged** while `outreach_status` is still **pre-send** (e.g. `not_ready` or `''`) → stale status.

`suppressed` never mismatches (neutral either way). Unknown/non-canonical statuses are tallied as `non_canonical_statuses` and surfaced without auto-repair.

> **Activity rule:** only a log record with a valid `lead_id` **and** a non-empty `sent_at` can imply confirmed activity. A malformed record (missing `sent_at`/`lead_id`) is an exception but can never confirm activity — so it never triggers a status mismatch on its own and never upgrades a lead to `APPROVED_WITH_OUTREACH`.

---

## 3. Workflow Design

```
Manual Trigger
   │
   ├──▶ Read Approved Outreach   (googleSheets, READ, tab 'Approved Outreach')
   └──▶ Read Outreach Log        (googleSheets, READ, tab 'Outreach Log')
                │
                ▼
        Reconcile Records        (Code — self-contained algorithm, refs both reads)
                │  output item 0: report JSON  (full v1 contract)
                │  output item 1: exceptions envelope { run_id, exception_count, exceptions }
                ▼
      Reconciliation Complete End (NoOp)
```

**Deliberate choices:**

- **Manual Trigger only.** The repo has no scheduling convention; automated scheduling is not added silently (spec §16).
- **No report sheet tab.** No Reporting/Reconciliation tab exists in the engine spreadsheet (grep of repo + vault found none; spec §23). The report is returned as **structured workflow output** and the live harness writes a **deterministic JSON artifact** under `reports/<run_id>-reconciliation.json`. A persistent report sheet is deferred until the repo architecture explicitly includes one.
- **One Code node** keeps the offline test surface small and the algorithm single-sourced.
- **`active: false`** by default, matching repo convention: workflows are enabled manually after import.

---

## 4. Report Contract

`Reconcile Records` output item 0:

| Field | Type | Meaning |
|---|---|---|
| `run_id` | string | `RECONCILIATION-<timestamp>` (injectable for tests) |
| `status` | string | `COMPLETED` \| `RECONCILIATION_INCOMPLETE` |
| `run_at`, `detected_at` | string (ISO) | run timestamps |
| `approved_total` | int | Approved Outreach rows read (incl. malformed) |
| `approved_with_outreach` | int | approved leads with confirmed activity |
| `approved_no_outreach` | int | approved leads with no confirmed activity |
| `approval_duplicates` | int | duplicate Approved rows for one lead id (first is canonical) |
| `coverage_rate` | number \| `null` | `approved_with_outreach / (with + without)`. **Never presented when denominator is 0** (reported as `null`). Excludes malformed approvals from the base. |
| `outreach_total` | int | Outreach Log rows read (incl. malformed/orphans) |
| `unique_leads_with_outreach` | int | distinct lead ids with confirmed activity |
| `multiple_outreach_leads` | int | approved leads with > 1 record |
| `orphan_outreach` | int | orphan exception count |
| `malformed_approvals` | int | malformed approval rows |
| `malformed_outreach` | int | malformed outreach rows |
| `status_mismatches` | int | mismatch exception count |
| `non_canonical_statuses` | int | approved rows with unknown statuses |
| `healthy_records` | int | `with-outreach` leads with no mismatch |
| `exception_count` | int | orphans + malformed approvals + malformed outreach + mismatches |
| `approvals` | array | per-lead classification card (category, counts, first/latest `sent_at`, channels, status) |
| `exceptions` | array | full exception rows (see §5) |
| `sources` | object | read-ok flags + read errors per source |

`coverage_rate` is rounded to 4 decimal places. `approved_no_outreach` is an informational category (A) — it is **not** part of `exception_count`.

---

## 5. Exceptions

Output item 1 carries `{ run_id, exception_count, exceptions }`. Each exception:

| Field | Meaning |
|---|---|
| `run_id` | run that surfaced it |
| `lead_id`, `business_name` | identity (may be empty for malformed rows without a lead id) |
| `exception_type` | `STATUS_MISMATCH` \| `OUTREACH_WITHOUT_APPROVAL` \| `MALFORMED_OUTREACH` \| `MALFORMED_APPROVAL` |
| `severity` | `WARNING` (mismatch) \| `ERROR` (orphan/malformed) |
| `approved_status` | approval status at detection |
| `outreach_count` | confirmed records for the lead |
| `first_sent_at`, `latest_sent_at` | activity window |
| `outreach_id`, `details` | extra identity + human-readable reason |

Exceptions are sorted by `(exception_type, lead_id, details)` so the list is stable across runs.

---

## 6. Failure Behavior

- A source read failure → `status: RECONCILIATION_INCOMPLETE` with every metric field `null`, empty `exceptions`, and the error in `sources`. **A failed read never produces a false zero/healthy report.**
- Empty **successful** reads → `COMPLETED` with zero totals and `coverage_rate: null`.
- In n8n, a failed Google Sheets read node stops the workflow before `Reconcile Records`; the engine's `reconcileFromSheets` and the embedded node both implement the INCOMPLETE path so offline and live behavior match.

---

## 7. Determinism and Idempotency

- Identical sheet contents → identical classification, metrics, and exception order (only `run_id` / `run_at` / `detected_at` vary). Tests prove bit-identical output with injected clock/run id, plus order-independence when approved/outreach row order is shuffled within the same content.
- Read-only: the engine never mutates its inputs (verified under deep-frozen inputs) and the workflow has **zero sheet writes**.
- Re-running is safe and produces a fresh report; no state is persisted in the workflow.

---

## 8. Fixtures — `TEST-RECON-*`

`fixtures/recon-fixtures.json` (loaded by `src/recon-fixtures.js`), each id matches `/^TEST-RECON-\d+$/`:

| Fixture | Coverage |
|---|---|
| 001 `APPROVED_NO_OUTREACH` | Category A |
| 002 `APPROVED_WITH_OUTREACH` | Category B, healthy |
| 003 `MULTIPLE_OUTREACH` | Category C, timestamps/channels |
| 004 `OUTREACH_WITHOUT_APPROVAL` | Category D, orphan |
| 005 `MALFORMED_APPROVAL` | Category F, missing `approved_at` |
| 006 `MALFORMED_OUTREACH` | Category E, missing `sent_at` (no activity implied) |
| 007 `STATUS_MISMATCH_PHANTOM` | post-send status, no activity |
| 008 `STATUS_MISMATCH_STALE` | activity while pre-send status |
| 009 `EMPTY_SOURCES` | completed empty run, coverage `null` |
| 010 `MIXED_ALL` | combined surface with full metric contract |

Each fixture carries its **expected metrics inline** so tests validate the contract, not hand-scripted constants.

---

## 9. Offline Test Suite

Run: `npm test` (glob `tests/*.test.js`, zero dependencies).

- `tests/reconcile-engine.test.js` — engine unit tests: schema contract, fixture integrity, every category A–F, coverage zero-denominator rule, determinism, order independence, read-only (frozen inputs), incomplete/failed-read semantics, suppressed/unknown statuses, duplicate approvals, index/malformed handling.
- `tests/reconcile-workflow.test.js` — workflow importability (node set, connections, provider-independence, read-only sheets, zero writes, no banned nodes, no scheduling, no secrets/`$env`/`staticData`), embedded-code behavior on fixtures, INCOMPLETE path, and a **sync test** asserting the embedded `Reconcile Records` node and `src/reconcile.js` produce identical output on every fixture and the failure path.

**Result: 70/70 PASS** (18 handoff + 13 harness + 39 reconciliation).

---

## 10. Live Harness

`scripts/run-reconciliation-live.js` (+ `run-reconcile-live.ps1`, `npm run reconcile:live`). Phases in fixed order — **SEED → RUN → VERIFY → CLEANUP → VERIFY-FINAL** — all default to **dry-run**; pass `--execute` to mutate.

| Phase | Behavior |
|---|---|
| `--seed` | Appends `TEST-RECON-*` rows to **Approved Outreach** and **Outreach Log** for the selected scenario (`--scenario=TEST-RECON-010` default). Idempotent by id. |
| `--run` | Attempts the n8n execution via API if `N8N_*` creds exist; otherwise prints **MANUAL** steps. **No live PASS is ever claimed unless an execution is confirmed.** |
| `--verify` | Reads both tabs, filters to `TEST-RECON-*` rows only, reconciles via `src/reconcile.js`, compares to the scenario's expected metrics, and writes the JSON artifact to `reports/<run_id>-reconciliation.json` (structured output; never a sheet write). |
| `--cleanup` | Deletes only `TEST-RECON-*` rows from both tabs. **Cleanup refuses any non-namespaced row** and re-reads to confirm zero remain. |
| `--verify-final` | Confirms zero `TEST-RECON-*` rows remain (post-cleanup isolation). |

Secrets: no credentials in files; `.env.example` documents `GOOGLE_SHEET_ID`, `GOOGLE_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON`, `N8N_BASE_URL` / `N8N_API_KEY` / `N8N_WORKFLOW_ID`.

---

## 11. Manual Run (n8n)

1. Import `Run-Reconciliation-and-Reporting V1.json`.
2. Attach the existing Google Sheets OAuth2 credential to both read nodes (they already target the engine spreadsheet, tabs `Approved Outreach` and `Outreach Log`).
3. Enable the workflow (it imports `active: false`).
4. Execute. Confirm `Reconcile Records` output:
   - item 0: report object (`status: COMPLETED` or `RECONCILIATION_INCOMPLETE`),
   - item 1: exceptions envelope.
5. Review `exceptions`; address per category (do **not** auto-repair from the workflow).

---

## 12. Verification Summary (this artifact)

- Automated (offline): **39 reconciliation tests PASS**; full suite **70/70 PASS**. Covers all 6 categories, both mismatch directions, coverage-zero rule, failure semantics, determinism, no-mutation, fixture/embedding/engine sync.
- Live Google Sheets + n8n execution: **NOT RUN** (no credentials in this environment). No live PASS is claimed.

---

## 13. Risks / Limitations / Notes

- The Outreach Log schema is **canonical to this artifact** (spec §3). If the sheet ever defines a different header set, this artifact's read column mapping diverges until updated.
- Production handoff currently writes only `not_ready`; a healthy ledger therefore requires a downstream update step (out of scope here) to advance statuses as outreach happens.
- `coverage_rate` uses the classifiable base (`with + without`), excluding malformed approvals and duplicate rows — documented behavior.
- n8n Community edition public API cannot trigger executions on its own; `run-reconcile-live.ps1` therefore prompts for manual execution in the UI.