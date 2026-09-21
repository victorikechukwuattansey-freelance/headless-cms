# Outreach Queue & Planning V1

**Version 1 — 2026-09-11**
**Workflow:** `Outreach-Queue-and-Planning V1.json`
**Artifact lineage:** Prospecting + Validation V1 → Approved Outreach Handoff V1 → Run Reconciliation and Reporting V1 → **Outreach Queue & Planning V1**

Read-first, deterministic planning projection between the **Approved Outreach** approval ledger and the **Outreach Log** activity log. It answers "which approved leads are actionable next, via which channel, and why", ranks them by priority, and attaches confirmed outreach history. **It does not send outreach, schedule follow-ups, enrich contacts, handle replies, mutate any source tab, or advance `outreach_status`.** It only consumes rows; it never writes.

---

## 1. Source of Truth

The following are authoritative; nothing may contradict them without a visible change request:

| Layer | Source |
|---|---|
| Approved Outreach schema (21 cols A–U) | `src/schema.js` → `APPROVED_COLUMNS` (shared with Approved Outreach Handoff V1) |
| Outreach Log schema (22 cols A–V) | Run Reconciliation and Reporting V1 (adopted, spec §3) |
| Status vocabulary | `src/reconcile.js` → `RECONCILE_STATUSES` (state machine in `workflows/lead-recovery-engine/discovery/`) |
| Channel vocabulary | Outreach Log `channel` = `email` \| `call` (from reconciliation fixtures/tests and log data; **`contact_form` is NOT a supported channel** — there is no evidence of it in this ledger) |
| Business rules | Approved Outreach Handoff V1 / Prospecting + Validation V1 — **not modified by this artifact** |
| No queue sheet | No "Outreach Queue" tab/schema exists in the repo, vault, or engine spreadsheet. The queue is a **structured projection**, not a new sheet. |

---

## 2. Queue Semantics

### 2.1 Readiness (`readiness_status` — queue-level, distinct from `outreach_status`)

| Status | Meaning | Condition |
|---|---|---|
| `READY` | Actionable; a verified contact channel exists | `email_verified` non-empty → channel `email`; else phone with ≥7 digits (`MIN_PHONE_DIGITS=7`) → channel `call` |
| `NOT_READY` | Needs contact data before outreach can be attempted | No verified email and no usable phone (`enrichment_required=true`) |
| `BLOCKED` | Must never be queued for outreach | Canonical `outreach_status` = `suppressed` (the only real blocking condition; `available_channel='none'`, `enrichment_required=false`) |

A row's canonical `outreach_status` (`not_ready`, `queued`, `contacted`, …) is **never changed** by this artifact. Readiness is a planning projection on top of it.

### 2.2 Channel precedence

1. `email` if `email_verified` is non-empty (verified means the handoff confirmed deliverability).
2. Else `call` if `phone` has ≥7 digits.
3. Else `none` (+ `NOT_READY`, `enrichment_required=true`).

`enrichment_required` is exactly `available_channel === 'none' && readiness_status === 'NOT_READY'`.

### 2.3 Priority ranking

One row per approved `lead_id`. Order is deterministic and independent of sheet row order:

1. `lead_score` **descending** (missing/non-numeric scores sort as `0`)
2. `approved_at` **ascending** (earliest approval first)
3. `lead_id` ascending (stable tiebreak)

`priority` is the 1-based rank. Duplicate Approved rows for one `lead_id` do **not** create duplicates — the first row is canonical and the duplicate is counted in `duplicate_approval_ids` (no new exception type; rule matches reconciliation).

### 2.4 Confirmed history

Only Outreach Log rows with **both** `lead_id` and `sent_at` count as confirmed activity, sorted oldest → newest:

- `outreach_count` — number of confirmed records
- `last_outreach_at` — latest `sent_at`
- `latest_channel` / `latest_outcome` — channel and outcome of the newest record
- `history_attached` — report count of queue rows with `outreach_count > 0`

Malformed log rows (missing `lead_id`/`sent_at`) go to exceptions (`MALFORMED_OUTREACH`), never into history. Log rows with no matching approved lead are orphan exceptions (`OUTREACH_WITHOUT_APPROVAL`), never silently dropped.

### 2.5 Exception types (report + envelope)

| Type | Severity | Meaning |
|---|---|---|
| `MALFORMED_APPROVAL` | ERROR | Approved row missing `lead_id` or `approved_at` |
| `MALFORMED_OUTREACH` | ERROR | Log row missing `lead_id` or `sent_at` |
| `OUTREACH_WITHOUT_APPROVAL` | ERROR | Log record, no matching Approved row |

Exceptions are sorted by type → lead_id → details for determinism, and are identical in the report and the second output item.

---

## 3. Workflow Design

```
Manual Trigger
   │
   ├──▶ Read Approved Outreach   (googleSheets, READ, tab 'Approved Outreach')
   └──▶ Read Outreach Log        (googleSheets, READ, tab 'Outreach Log')
                │
                ▼
        Build Queue              (Code — self-contained algorithm, refs both reads)
                │  output item 0: queue report JSON  (full v1 contract)
                │  output item 1: exceptions envelope { run_id, exception_count, exceptions }
                ▼
     Outreach Queue Complete      (NoOp)
```

**Deliberate choices:**

- **Manual Trigger only.** The repo has no scheduling convention; automated scheduling is not added silently.
- **No queue sheet.** Nothing in the repo or vault defines one and the spec does not require persisting a sheet; the queue is **structured workflow output** and the live harness writes a **deterministic JSON artifact** under `reports/<run_id>-outreach-queue.json`.
- **One Code node** keeps the offline test surface small and the algorithm single-sourced (`src/queue.js` is mirrored in the workflow; a sync test asserts they never drift).
- **`active: false`** by default, matching repo convention.
- **No writes, no webhooks, no credentials inside nodes.** Read-only `googleSheets` reads on the engine spreadsheet only.

---

## 4. Queue Schema (output item 0 → `queue[]`)

| Field | Type | Meaning |
|---|---|---|
| `queue_id` | string | `= lead_id` (queue identity) |
| `lead_id` | string | approved lead id |
| `business_name`, `niche`, `city`, `state`, `country` | string | display context from the Approved row |
| `lead_score` | string | raw score as stored |
| `qualification_status` | string | as stored |
| `available_channel` | `email` \| `call` \| `none` | computed channel |
| `readiness_status` | `READY` \| `NOT_READY` \| `BLOCKED` | computed readiness |
| `priority` | int | 1-based rank (see §2.3) |
| `approved_at` | string | approval timestamp |
| `queued_at` | string (ISO) | when this projection ran |
| `last_outreach_at` | string \| `''` | latest confirmed `sent_at` |
| `outreach_count` | int | confirmed records |
| `latest_channel` / `latest_outcome` | string | newest record's channel/outcome |
| `enrichment_required` | bool | `none` + `NOT_READY` |
| `reason` | string | `verified email available` \| `phone available` \| `no available channel` \| `suppressed` |
| `notes` | string | as stored |

## 5. Report Contract (output item 0)

| Field | Type | Meaning |
|---|---|---|
| `run_id` | string | `QUEUE-<timestamp>` (injectable for tests) |
| `status` | string | `COMPLETED` \| `QUEUE_INCOMPLETE` |
| `run_at`, `queued_at` | string (ISO) | run timestamps |
| `approved_total`, `outreach_total` | int | rows read (incl. malformed/orphans) |
| `queue_total` | int | queue length (distinct approved leads) |
| `ready_count` / `not_ready_count` / `blocked_count` | int | by readiness |
| `email_ready_count` / `call_ready_count` | int | by channel |
| `duplicate_approval_ids` | int | duplicate Approved rows (first is canonical) |
| `malformed_approvals` / `malformed_outreach` / `orphan_outreach` | int | exception tallies |
| `history_attached` | int | queue rows with confirmed history |
| `exception_count` | int | `malformed_approvals + malformed_outreach + orphan_outreach` |
| `queue` | array | §4 schema, priority-ordered |
| `exceptions` | array | §2.5, sorted |
| `sources` | object | `approved_ok`, `outreach_ok`, `approved_read_error`, `outreach_read_error` |

### 5.1 Failure behavior

If either read fails (a single item carrying `_source_read_error`), the run is **`QUEUE_INCOMPLETE`**: every metric field is `null` (never a false zero), `queue`/`exceptions` are `[]`, and the source error is preserved in `sources`. A read failure can never present as a healthy empty queue. An empty successful read is `COMPLETED` with explicit zeros.

---

## 6. Fixtures (`fixtures/queue-fixtures.json`, namespace `TEST-QUEUE-\d+`)

| ID | Name | Covers |
|---|---|---|
| `TEST-QUEUE-001` | EMAIL_READY | verified email → email, READY, priority 1 |
| `TEST-QUEUE-002` | CALL_READY | phone only → call, READY |
| `TEST-QUEUE-003` | NO_CHANNEL | no verified email/phone → none, NOT_READY, enrichment_required |
| `TEST-QUEUE-004` | CONTACT_FORM_ONLY | contact-form field alone is **not** a channel |
| `TEST-QUEUE-005` | HISTORY | one confirmed record attaches count/last/outcome |
| `TEST-QUEUE-006` | MULTIPLE_HISTORY | newest record wins latest_channel/outcome |
| `TEST-QUEUE-007` | ORPHAN_OUTREACH | log without approval → orphan exception |
| `TEST-QUEUE-008` | TIE_PRIORITY | equal scores → approved_at asc → lead_id asc |
| `TEST-QUEUE-009` | DUPLICATE_APPROVAL | duplicate lead id → first canonical, `duplicate_approval_ids=1` |
| `TEST-QUEUE-010` | TRANSITION | stage A NOT_READY → stage B READY/email (lead data change) |
| `TEST-QUEUE-011` | SUPPRESSED_BLOCKED | `suppressed` → BLOCKED, no channel, no enrichment |
| `TEST-QUEUE-012` | EMPTY_SOURCES | both reads empty → COMPLETED with zeros |

---

## 7. Offline Tests

| Suite | File | Coverage |
|---|---|---|
| Engine | `tests/queue-engine.test.js` | 26 tests — readiness, channels, priority, history, exceptions, dedupe, incomplete path, idempotency |
| Workflow sync | `tests/queue-workflow.test.js` | 16 tests — structure/read-only/no-secrets + embedded code ↔ `src/queue.js` parity on every fixture + transitions |
| Live harness | `tests/queue-harness.test.js` | 11 tests — MockSheets e2e SEED→VERIFY→CLEANUP→VERIFY-FINAL, dry-run no-ops, production-row survival |

Run: `npm test` (all suites) or `npm run queue:test`.

---

## 8. Live Harness

`scripts/run-outreach-queue-live.js` (+ `run-outreach-queue-live.ps1`, `npm run queue:live`), mirroring the reconciliation live runner: lifecycle **SEED → RUN → VERIFY → CLEANUP → VERIFY-FINAL**, manually in phases or together with `--all`.

- **SEED** appends the chosen `TEST-QUEUE-*` fixture (Approved rows keyed by `lead_id` col A; Outreach rows keyed by `lead_id` col B). Idempotent by id.
- **RUN** attempts an n8n execution via `N8N_BASE_URL`/`N8N_API_KEY`/`N8N_WORKFLOW_ID`; without them it prints manual steps and **never claims a live pass**. `--no-interactive` fails the run phase instead.
- **VERIFY** reads both tabs, scopes to `TEST-QUEUE-*`, builds the queue, checks every metric (and per-lead readiness/channel/priority/enrichment) against the fixture's expected values, and writes `reports/<run_id>-outreach-queue.json`.
- **CLEANUP** deletes only `TEST-QUEUE-*` rows from both tabs; ids are namespace-guarded (`/^TEST-QUEUE-\d+$/`). **Nothing else is ever deleted.**
- **VERIFY-FINAL** confirms zero `TEST-QUEUE-*` rows remain.

Dry-run by default; pass `--execute` to actually write/delete. No credentials are stored in files. Live runs report `LIVE NOT RUN` unless real execution confirmed.

---

## 9. Non-Goals / Boundaries

- No outreach is sent, scheduled, or drafted. No `emailSend`, `twilio`, `whatsapp`, `slack`, `webhook`, or HTTP nodes exist.
- No follow-ups, reply handling, or cadence logic.
- No contact enrichment — `enrichment_required` is an **output flag**, not an action.
- No writes to `Approved Outreach`, `Outreach Log`, or `Verified Leads`; `outreach_status` and `outreach_channel` are never modified.
- No new sheets or tabs are created by the workflow.
- `contact_form` and unverified emails are **not** channels.