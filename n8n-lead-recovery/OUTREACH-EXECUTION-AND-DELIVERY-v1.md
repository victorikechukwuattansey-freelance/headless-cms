# Outreach Execution & Delivery V1

**Version 1 — 2026-09-11**
**Workflow:** `Outreach-Execution-and-Delivery V1.json`
**Artifact lineage:** Prospecting + Validation V1 → Approved Outreach Handoff V1 → Run Reconciliation and Reporting V1 → Outreach Queue & Planning V1 → **Outreach Execution & Delivery V1**

The conservative execution + delivery boundary between the **Approved Outreach** approval ledger / **Outreach Queue** planning projection and the **Outreach Log** activity log. It consumes only queue `READY` work, uses each lead's `available_channel` **as-is** (no channel invention, no re-ranking beyond queue priority), and writes a durable Outreach Log row **only for provider-confirmed attempts**. It ships in the safe default: **DRY_RUN mode, no provider configured** — nothing can be sent or recorded until an operator explicitly opts in.

---

## 1. Purpose

Answer "which `READY` queue work actually goes out, to whom, via which already-computed channel, and what the deliverable record is" — and make it impossible to fabricate a send or a log row. The workflow:

1. Re-derives the queue from the **outreach** sheet (read-only) exactly as the queue artifact does (queue, readiness, channel, priority, history, orphan/malformed exceptions).
2. Merges each queue item with contact data and an **explicit per-lead message variant** (configured, never invented).
3. Gates every item (blocked / not-ready / no-channel / duplicate) before any attempt.
4. Executes **only** with mode `REAL` + a configured provider; otherwise it skips or refuses.
5. Stages a log row **only** on a provider-confirmed `success` result and hands that staging to a separate append node (exactly one write surface: the Outreach Log).

---

## 2. Boundary

| In scope | Out of scope |
|---|---|
| Consume **README** queue-ready candidates from `Approved Outreach` + `Outreach Log` | Reactivation of `suppressed` leads, follow-ups, reply handling, cadences |
| Write **exactly one append target**: `Outreach Log` | Writes to `Approved Outreach`, `Verified Leads`, queue sheet (none exists) |
| Record only provider-confirmed attempts | Fabricating or back-dating sends, partial failures as successes |
| Respect `available_channel` as-is from the queue projection | Channel invention (`contact_form`, unverified email, short phones are never channels) |
| `EXECUTION_SKIPPED` / `EXECUTION_REJECTED` / `DUPLICATE_SUPPRESSED` are recorded as **zero-write** outcomes | Contact enrichment, scoring, re-ranking |

No `emailSend`, `twilio`, `whatsapp`, `slack`, `webhook`, or HTTP call-out nodes exist in the shipped JSON. Real provider delivery is out of scope of V1 (the provider boundary is a typed interface; see §18).

---

## 3. Inputs (consumed, never written)

| Source | Schema | How |
|---|---|---|
| `Approved Outreach` (col A–U) | `src/schema.js` → `APPROVED_COLUMNS` | Read node `Read Approved Outreach`; queue projection uses `lead_score`, `approved_at`, `outreach_status`, verified-email / phone, `business_name`, `niche`, `city`, `state`, `country`, `qualification_status`, `notes` |
| `Outreach Log` (col A–V) | Run Reconciliation and Reporting V1 §3 (`OUTREACH_COLUMNS`) | Read node `Read Outreach Log`; history + duplicate suppression by `lead_id`+`channel` with a non-empty `sent_at` |

Both reads run in parallel and are **read-only**. A read failure (single item carrying `_source_read_error`) produces `EXECUTION_INCOMPLETE` — every metric `null`, never a healthy empty result.

---

## 4. Source of Truth

- **Approved Outreach schema (21 cols):** `src/schema.js` → `APPROVED_COLUMNS`.
- **Outreach Log schema (22 cols):** Run Reconciliation and Reporting V1 §3 = `['outreach_id','lead_id','business_name','contact_name','channel','email','phone','message_variant','sent_at','follow_up_date','follow_up_number','reply_status','reply_date','pain_admitted','call_booked','call_date','paid_pilot_interest','objection','outcome','notes','status','provider_message_id']`.
- **Status vocabulary:** `src/reconcile.js` → `RECONCILE_STATUSES` + Outreach Queue & Planning V1 §2 readiness model (READY / NOT_READY / BLOCKED).
- **Channel vocabulary:** `email` | `call`. `contact_form` is **not** a supported channel.
- **Execution semantics + report contract:** `src/execution.js` (mirrored verbatim in the embedded node; sync-tested against every fixture).
- **Mode/provider policy:** this artifact (§7, §10). Workflow ships `active:false`, `DRY_RUN`, `NOT_CONFIGURED`.

---

## 5. Workflow Design

```
Manual Trigger
   │
   ├──▶ Initialize Execution Mode      (Code — { mode, provider, message_variants })
   ├──▶ Read Approved Outreach         (googleSheets, READ, tab 'Approved Outreach')
   └──▶ Read Outreach Log              (googleSheets, READ, tab 'Outreach Log')
                │
                ▼
        Execute Ready Queue            (Code — synchronous mirror of src/queue.js + src/execution.js)
                │  output item 0: execution report JSON  (full v1 contract)
                │  output item 1: { run_id, log_rows, log_rows_written }  (handoff to append)
                ▼
        Prepare Outreach Log Write     (Code — projection of log_rows onto the 22-col schema)
                ▼
        Write Outreach Log             (googleSheets, APPEND to tab 'Outreach Log', one write)
                ▼
        Execution Complete             (NoOp)
```

**Deliberate choices:**

- **One append surface.** The only googleSheets **write** node in the whole workflow is `Write Outreach Log`. Everything else is read-only or pure projection.
- **Two output items** from the execute node decouple the `<report>` (contract item 0) from the rows to append (item 1). The workflow test suite asserts the two-item shape and that item 1's `log_rows_written` === report `log_rows_written`.
- **Append-only projection node.** `Prepare Outreach Log Write` maps each staged log row onto the exact 22-column Outreach Log schema with `''` normalization — no formulas, no headers, no row surgery.
- **Only `READY` work is attempted.** Items that are `BLOCKED`, `NOT_READY`, channel-less, duplicate, or payload-invalid are counted and surfaced but **never** reach the provider.
- **Manual Trigger only, `active: false`.** No scheduling is added silently; real execution is an explicit, per-run operator decision.
- **One Code node** keeps the offline test surface small and single-sourced (`src/queue.js` + `src/execution.js` mirrored in `src/embedded-execution.js`; a parity test asserts they never drift).

---

## 6. Node Inventory (8 nodes)

| Node | Type | Role |
|---|---|---|
| Manual Trigger | n8n-nodes-base.manualTrigger | start |
| Initialize Execution Mode | n8n-nodes-base.code | emit `{ mode, provider, message_variants }` |
| Read Approved Outreach | n8n-nodes-base.googleSheets | READ `Approved Outreach` |
| Read Outreach Log | n8n-nodes-base.googleSheets | READ `Outreach Log` |
| Execute Ready Queue | n8n-nodes-base.code | queue fold + execution boundary + inline mock provider |
| Prepare Outreach Log Write | n8n-nodes-base.code | project staged log rows onto 22-col schema |
| Write Outreach Log | n8n-nodes-base.googleSheets | APPEND (the only write) |
| Execution Complete | n8n-nodes-base.noOp | terminal |

All googleSheets nodes target the artifact spreadsheet (meta `spreadsheetId`). No node stores credentials, `staticData`, or environment variables.

---

## 7. Initialize Execution Mode — mode & provider gating

The mode node emits `{ mode, provider, message_variants }` (all normalized; any missing field falls back to the safe default).

| Field | Allowed | Default | Effect |
|---|---|---|---|
| `mode` | `DRY_RUN` \| `REAL` | `DRY_RUN` | `DRY_RUN` never calls the provider and never writes; `REAL` requires a configured provider |
| `provider` | `SUCCESS` \| `FAILURE` \| `NOT_CONFIGURED` | `NOT_CONFIGURED` | inline mock adapter; `NOT_CONFIGURED` = no adapter |
| `message_variants` | object `{ [lead_id]: variant }` | `{}` | **required** per email lead; never invented |

`provider_configured = provider ∈ { SUCCESS, FAILURE }`. In `REAL` mode with `NOT_CONFIGURED`, every attempt is `EXECUTION_FAILED (PROVIDER_NOT_CONFIGURED)` and **zero** rows are staged — the refuse is honest, explicit, and recorded. To run a REAL execution, an operator edits this node to set `mode='REAL'`, `provider` to a configured adapter id, and fills `message_variants`; a workflow test asserts the shipped JSON still carries the safe defaults.

---

## 8. Execution Semantics

For each queue item, in order:

| Step | Outcome / Result status |
|---|---|
| `readiness_status === BLOCKED` | `EXECUTION_SKIPPED` (reason `BLOCKED`) — no call |
| `readiness_status === NOT_READY` | `EXECUTION_SKIPPED` (reason `NOT_READY`) — no call |
| `available_channel` ∉ {email, call} | `EXECUTION_REJECTED` (reason `NO_CHANNEL`) |
| existing log row for `lead_id`+`channel` with `sent_at` | `DUPLICATE_SUPPRESSED` — no call, no write |
| `validatePayload` fails (email needs non-empty `email` + `message_variant`; call needs non-empty `phone`) | `EXECUTION_REJECTED` (reason `INVALID_PAYLOAD`) |
| `DRY_RUN` mode | `EXECUTION_SKIPPED` (reason `DRY_RUN`) — provider not called |
| `REAL` mode, configured provider | provider attempt → success / failure result |

`outreach_id = 'EX-' + lead_id + '-' + channel` (deterministic); `execution_id` and `sent_at` come from the run. Contact data is merged from the approved row; the channel is copied from the queue projection untouched.

---

## 9. Payload Validation

`validatePayload` (embedded mirror of `src/execution.js`):

- EMAIL: requires non-empty `email` **and** a non-empty explicit `message_variant`.
- CALL: requires non-empty `phone`.

A missing variant is a **rejection**, never a silent default or template guess. The built payload contains `{ execution_id, outreach_id, lead_id, business_name, contact_name, channel, message_variant, email | phone }` — nothing else is fabricated.

---

## 10. Provider Results & Failure Behavior

The provider boundary (`src/provider.js`) returns `{ success, provider_status, provider_message_id, error_code, error_message }`. Outcome mapping is exact:

| Provider result | Result status | Log row staged? |
|---|---|---|
| `success: true` | `EXECUTION_SUCCEEDED` (detail: provider confirmed the attempt) | **yes** (`sent_at` = run time, `outcome=''`) |
| `success: false`, `PROVIDER_NOT_CONFIGURED` | `EXECUTION_FAILED` / reason `PROVIDER_NOT_CONFIGURED` | no |
| `success: false`, other | `EXECUTION_FAILED` / reason `PROVIDER_FAILURE` (+ `error_code`/`error_message` in `provider_call`) | no |

Read failures are distinct from provider failures: any `_source_read_error` → `EXECUTION_INCOMPLETE` with all metrics `null`. Empty successful reads are `COMPLETED` with explicit zeros. Nothing other than a provider-confirmed success can produce a log row.

---

## 11. Outreach Log Write Rules

- **Single write surface:** only `Write Outreach Log` (APPEND). No updates, deletes, or header writes.
- **Staged-only:** `Execute Ready Queue` output item 1 carries `{ run_id, log_rows, log_rows_written }`; `Prepare Outreach Log Write` projects each row to the 22-column schema (undefined/null → `''`).
- **Confirmed-only:** `log_rows` contains exactly the `EXECUTION_SUCCEEDED` items. Nothing else.
- **Idempotent by construction:** a re-run over the same sheet sees committed rows and suppresses them (`DUPLICATE_SUPPRESSED`, `log_rows_written=0`). Duplicate suppression is by `lead_id`+`channel` with a real `sent_at`.
- **No cross-write:** `outreach_status` on Approved Outreach is never advanced here (reconciliation owns status reporting).

---

## 12. Report Contract (output item 0)

| Field | Type | Meaning |
|---|---|---|
| `run_id` | string | `EXECUTION-<timestamp>` (injectable for tests) |
| `status` | `COMPLETED` \| `EXECUTION_INCOMPLETE` | run state |
| `run_at`, `mode`, `provider`, `provider_configured` | string / bool | run metadata |
| `approved_total`, `queue_total`, `ready_candidates` | int | reads + queue shape (null on incomplete) |
| `executed_attempted`, `executed_succeeded`, `executed_failed`, `executed_skipped`, `executed_rejected`, `duplicate_suppressed` | int | results by status |
| `log_rows_written` | int | `log_rows.length` (always 0 in DRY_RUN / failures / incomplete) |
| `provider_calls` | int | attempts |
| `results` | array | per-item cards (status/reason/detail/payload/provider_call/sent_at) |
| `log_rows` | array | staged confirmed rows (22-col contract) |
| `exceptions` | array | orphan/malformed ledger exceptions (match queue artifact rules) |
| `sources` | object | `approved_ok`, `outreach_ok`, `approved_read_error`, `outreach_read_error` |

Item 1 = `{ run_id, log_rows, log_rows_written }` (handoff for the append). The two items are contract-tested.

---

## 13. Determinism & Idempotency

- Queue ordering (score desc → approved_at asc → lead_id asc) is the same as the queue artifact; execution iterates that order (fixtures assert the multi-email order).
- `run_id` / `sent_at` are single `Date.now()`-derived values per run and injectable in tests for byte-identical parity.
- Results, exceptions, and log rows are sorted deterministically; report JSON is stable.
- Re-running against the committed sheet suppresses exactly the succeeded leaders (`expectedPostRun`: `executed_attempted = attempted − succeeded`, `duplicate_suppressed = succeeded`, `log_rows_written = 0`).
- The embedded code and `src/execution.js` are parity-tested across all 15 fixtures with run/payload/sent fields stripped.

---

## 14. Fixtures (`fixtures/execution-fixtures.json`, namespace `TEST-EXEC-\d+`)

| ID | Name | Covers |
|---|---|---|
| `TEST-EXEC-001` | EMAIL_REAL_SUCCESS | one email, REAL+SUCCESS → 1 confirmed log row |
| `TEST-EXEC-002` | CALL_REAL_SUCCESS | call channel, REAL+SUCCESS → confirmed row |
| `TEST-EXEC-003` | EMAIL_DRY_RUN | DRY_RUN → skipped, 0 provider calls, 0 writes |
| `TEST-EXEC-004` | CALL_DRY_RUN | call DRY_RUN → skipped |
| `TEST-EXEC-005` | EMPTY_REAL | empty reads → COMPLETED with zeros |
| `TEST-EXEC-006` | MIXED_READINESS | READY + NOT_READY + BLOCKED mix |
| `TEST-EXEC-007` | INVALID_PAYLOAD_EMAIL | missing variant → REJECTED, no call |
| `TEST-EXEC-008` | DUPLICATE_SUPPRESSED | committed history suppresses re-run |
| `TEST-EXEC-009` | PROVIDER_FAILURE | provider failure → FAILED, nothing staged |
| `TEST-EXEC-010` | PROVIDER_NOT_CONFIGURED | safe default refuses honestly, zero writes |
| `TEST-EXEC-011` | EXECUTION_INCOMPLETE_APPROVED | approved read error → null metrics |
| `TEST-EXEC-012` | EXECUTION_INCOMPLETE_OUTREACH | outreach read error → null metrics |
| `TEST-EXEC-013` | MULTI_EMAIL_ORDER | multiple emails in deterministic order |
| `TEST-EXEC-014` | DIFFERENT_CHANNEL_HISTORY | other-channel history does not suppress current channel |
| `TEST-EXEC-015` | DRY_RUN_DUPLICATE | dry run duplicates are skipped, zero writes |

Fixtures carry `{ id, name, approvedRows, outreachRows, message_variants, run, expected }`; `expected` metrics are asserted exactly by engine, workflow-parity, and live-verify suites.

---

## 15. Offline Test Suite

| Suite | File | Coverage |
|---|---|---|
| Engine | `tests/execution-engine.test.js` | 25 tests — gate order, payload validation, dry-run, provider outcomes, duplicate suppression, incomplete path, determinism, report contract |
| Workflow sync | `tests/execution-workflow.test.js` | 18 tests — structure, 8 nodes, connections, single-write, no secrets/env, safe defaults, two-item output, embedded↔engine parity on every fixture, prepare-node projection |
| Live harness | `tests/execution-harness.test.js` | 18 tests — MockSheets e2e SEED→RUN→VERIFY→CLEANUP→VERIFY-FINAL, dry-run no-ops, production-row survival, read-error refusal |

Run: `npm test` (all suites), `npm run execution:test` (execution trio), `npm run execution:build` (re-emit the JSON from the builder).

**Verification status (offline):** engine 25/25, workflow 18/18, harness 18/18 = **61/61 PASS**.

---

## 16. Live Harness

`scripts/run-execution-live.js` (+ `run-execution-live.ps1`, `npm run execution:live`), mirroring the reconcile/queue runners: lifecycle **SEED → RUN → VERIFY → CLEANUP → VERIFY-FINAL**, manually in phases (`--seed --run --verify --cleanup --verify-final`) or together with `--all`.

- **SEED** appends the chosen `TEST-EXEC-*` fixture (Approved keyed lead_id col A; Outreach keyed col B). Idempotent by id. Read-error scenarios (011/012) are **refused live** (they model a sheet read failure that cannot occur against a live spreadsheet).
- **RUN** = `--local` runs the engine offline and appends confirmed rows to `Outreach Log` when `status === COMPLETED`, `log_rows.length > 0`, and `--execute` is passed; otherwise n8n via `N8N_BASE_URL`/`N8N_API_KEY`/`N8N_WORKFLOW_ID` → manual prompt fallback. `--no-interactive` without credits fails the run (exit 3). **No live pass is ever claimed without confirmed execution.**
- **VERIFY** reads both tabs, scopes to `TEST-EXEC-*`, compares the posted run against the fixture's `expected` (item 0) and the committed sheet against the clean `log_rows` / `expectedPostRun` (item 1), and writes `reports/<run_id>-execution.json`.
- **CLEANUP** deletes only `TEST-EXEC-*` rows (namespace-guarded `/^TEST-EXEC-\d+$/`); **nothing else is ever deleted.**
- **VERIFY-FINAL** confirms zero `TEST-EXEC-*` rows remain.

Dry-run by default — pass `--execute` to actually write/delete. Mode defaults `DRY_RUN`/`NOT_CONFIGURED`; a REAL harness run must explicitly pass `--mode=REAL --provider=SUCCESS` (or `--provider=FAILURE`).

**Verification status (live):** **NOT RUN.** No live creds (`GOOGLE_SHEET_ID`, Google token/service-account) and no n8n endpoint / real provider adapter were available in this environment. Live execution, the live Google Sheets boundary, and real provider delivery are each **NOT RUN** below.

---

## 17. Manual Run (n8n)

1. Import `Outreach-Execution-and-Delivery V1.json` into n8n (same spreadsheet credentials as the existing lead-recovery workflows; `meta.spreadsheetId` is fixed to the artifact spreadsheet).
2. The workflow ships `active:false`. Inspect `Initialize Execution Mode`: mode `DRY_RUN`, provider `NOT_CONFIGURED` is the safe default.
3. For a monitored dry run, execute once and read the report on `Execution Complete` — `executed_skipped` for every READY candidate, `log_rows_written: 0`.
4. For a REAL run, edit the mode node: `mode='REAL'`, provider adapter configured, all email `message_variants` filled. **No variant may be left unset.** Execute and confirm the appended rows on `Outreach Log`.
5. Re-run to confirm suppression (`DUPLICATE_SUPPRESSED`, zero new rows).

---

## 18. Risks / Limitations / Notes (incl. §27 verification status)

| Area | Status | Note |
|---|---|---|
| Engine parity (embedded ↔ `src/execution.js`) | **PASS** | 25/25 engine + 18/18 workflow parity, all fixtures |
| Structure / single-write / no-secrets / safe defaults | **PASS** | 18/18 workflow structural + contract |
| Live harness offline behavior | **PASS** | 18/18 (MockSheets e2e for REAL+SUCCESS / FAILURE / NOT_CONFIGURED / dry-run double-run / cleanup isolation) |
| n8n live execution of the shipped JSON | **NOT RUN** | no n8n endpoint / API key available |
| Live Google Sheets boundary | **NOT RUN** | no live spreadsheet creds available |
| Real external provider delivery | **NOT RUN** | V1 ships an inline mock adapter; real adapters are future work (typed `src/provider.js` boundary exists) |

**Overall: PASS WITH LIMITATIONS** — all offline validation green (61/61 across engine, workflow, harness plus the repo-wide suite); live execution and the external delivery edge cannot be validated in this environment and are documented as NOT RUN rather than claimed.

Known deltas, all deliberate:
- `sent_at` / `run_id` share second-granularity (14-digit run ids per the queue/reconcile convention) — two runs in the same second reuse the same id; committed rows are still distinguished by `sent_at` + `outreach_id`. Noted, not a correctness issue for the boundary.
- Verify's artifact and the run artifact share a filename when produced in the same second (last-write-wins is the authoritative post-state report).
- Real providers (email/twilio/whatsapp/sms adapters) are intentionally out of V1; wiring them in requires a code change to the provider boundary plus the node swap, and then a live validation pass.