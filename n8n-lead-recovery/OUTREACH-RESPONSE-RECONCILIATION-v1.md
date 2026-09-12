# Outreach Response Reconciliation V1

**Version 1 — 2026-09-11**
**Workflow:** `Response-Reconciliation V1.json`
**Artifact lineage:** Outreach Execution & Delivery V1 → Outreach Execution Reconciliation V1 → Outreach Response Capture V1 → **Outreach Response Reconciliation V1** (read-only evidence layer)
**Execution status:** Read-only observability — zero provider calls, zero writes to either sheet, zero side effects.

The deterministic CAPTURE→RECONCILE evidence layer. It classifies every durable Response Log row (written by Outreach Response Capture V1) as `VERIFIED` / `VIOLATION` / `NOT_VERIFIABLE` against the confirmed Outreach Log history. It never interprets response text, never sends a reply, and never repairs either sheet.

---

## 1. Purpose

Answer "is every captured response traceable to a confirmed outbound attempt, and is the trace honest?" — for each Response Log row, the first question is **was there a confirmed outreach attempt this response can reference?** (Outreach Log row with a non-empty `sent_at`), and the second is **does the response's own identity make that reference provable?** (`outreach_id`, `lead_id`, `channel`). Whatever cannot be proven is marked `NOT_VERIFIABLE` — never guessed.

---

## 2. Evidence Contract

**Inbound evidence source — Response Log (12 columns, from Response Capture V1):**

| Column | Meaning |
|---|---|
| `response_id` | durable unique id |
| `idempotency_key` | canonical inbound dedupe key |
| `lead_id` | lead identity |
| `outreach_id` | echoed `EX-<lead_id>-<channel>` reference (when matched) |
| `channel` | `email` \| `call` |
| `provider_message_id` | provider-side id (echoed, not verified here) |
| `received_at` | inbound timestamp |
| `response_text` | the inbound payload text — **never interpreted** |
| `response_status` | `CAPTURED` \| `UNMATCHED` \| `INVALID` \| `DUPLICATE` from capture |
| `source` | inbound origin (unspecified → treated as empty) |
| `matched` | capture attempt flag (unspecified → treated as false) |
| `notes` | operator notes |

**History source — Outreach Log (20 columns, from Run Reconciliation and Reporting V1):** `OUTREACH_COLUMNS` in `src/reconcile.js` — only `outreach_id`, `lead_id`, `channel`, `sent_at` participate in reconciliation.

**Canonical id:** `outreach_id` must match `^EX-(.+)-(email|call)$`. The echoed response `outreach_id` is the primary identity; when it is present the second captured `email`/`call` channel segment must agree with the durable response `channel`.

**Proof gates (locked semantics):**
- **Outreach proof** = Outreach Log row with a **non-empty `sent_at`**. `reply_status` is never proof of a send.
- **capture proof** never exists for a durable row without an `outreach_id`; `UNMATCHED` is a legitimate inbound outcome, not proof of anything.

---

## 3. Reconciliation Semantics

Matching is deterministic, greedy, and order-independent. Canonical-first duplicate handling applies (see §5).

| Relationship | Outreach Log state | Result |
|---|---|---|
| canonical `outreach_id` resolves to exactly one confirmed row | one row with `sent_at` non-empty | **VERIFIED** |
| `outreach_id` valid format but no such row | none / not confirmed | **VIOLATION** (RESPONSE_OUTREACH_NOT_FOUND) |
| `outreach_id` not canonical format | n/a — identity cannot be attempted | **NOT_VERIFIABLE** (OUTREACH_ID_FORMAT_INVALID) |
| no `outreach_id`, but `lead_id` has other confirmed history | lead trace exists | **VERIFIED** (RESPONSE_WITH_VALID_OUTREACH, lead-level link) |
| no `outreach_id`, no traceable lead identity | `UNMATCHED`/`INVALID` at capture | **NOT_VERIFIABLE** (RESPONSE_WITHOUT_OUTREACH_ID) |
| channel parsed from canonical `outreach_id` contradicts durable `channel` | contradiction | **VIOLATION** (CHANNEL_MISMATCH) |
| row invalid (missing identity fields / non-canonical `response_status`) | — | **NOT_VERIFIABLE** (INVALID_RESPONSE_RECORD) |

There is **no timestamp-causality** rule: `received_at` is never compared against `sent_at`, and `response_text` is never read.

---

## 4. Categories (11)

| Category | Severity | When |
|---|---|---|
| RESPONSE_WITH_VALID_OUTREACH | WARNING | response provably references the lead's confirmed outreach (lead-level link) |
| RESPONSE_OUTREACH_NOT_FOUND | ERROR | canonical `outreach_id` does not resolve to confirmed history |
| RESPONSE_LEAD_NOT_FOUND | ERROR | response's lead has no confirmed outreach history at all |
| RESPONSE_WITHOUT_OUTREACH_ID | WARNING | durable response carries no `outreach_id`, so neither channel nor send can be proven |
| CHANNEL_MISMATCH | ERROR | channel encoded in canonical `outreach_id` contradicts durable `channel` |
| OUTREACH_ID_FORMAT_INVALID | WARNING | `outreach_id` not in `EX-<lead_id>-<channel>` format |
| DUPLICATE_RESPONSE | ERROR | a later durable row shares the canonical `idempotency_key` (canonically-first kept) |
| DUPLICATE_OUTREACH_ID | ERROR | two confirmed log rows share the same canonical `outreach_id` — the echo is ambiguous |
| INVALID_RESPONSE_RECORD | WARNING | response row missing identity fields or non-canonical `response_status` |
| INVALID_OUTREACH_RECORD | WARNING | outreach row malformed/missing identity fields |
| READ_FAILURE | ERROR | a source read failed (entire run → INCOMPLETE, metrics null) |

**Violation count:** RESPONSE_OUTREACH_NOT_FOUND + RESPONSE_LEAD_NOT_FOUND + CHANNEL_MISMATCH + DUPLICATE_RESPONSE + DUPLICATE_OUTREACH_ID — the five ERROR categories that indicate an integrity breach.

---

## 5. Duplicate Handling

- **Duplicate response:** two durable Response Log rows sharing the canonical `idempotency_key`; the canonically-first row is kept, the later row → `DUPLICATE_RESPONSE`. Duplicates are excluded from `eligible` and `linked`.
- **Duplicate outreach:** two confirmed `outreach_id`s in the Outreach Log; the referenced row is ambiguous → `NOT_VERIFIABLE` (DUPLICATE_OUTREACH_ID).
- **UNMATCHED ≠ INVALID:** an `UNMATCHED` capture row is a legitimate `NOT_VERIFIABLE` with no identity, never an integrity violation.

---

## 6. Report Shape

```
{
  run_id: 'RESPRECON-<digits14>',
  run_at: '<iso>',
  detected_at: '<iso>',
  status: 'COMPLETED' | 'INCOMPLETE',
  sources: {
    response_log_ok: true,
    response_log_read_error: '',
    outreach_log_ok: true,
    outreach_log_read_error: ''
  },
  summary: {
    response_records: 3,     // null when INCOMPLETE
    matched_records: 2,
    unmatched_records: 0,
    linked_records: 2,       // eligible = matched + unmatched
    not_verifiable: 1,
    invalid_records: 0,
    duplicate_records: 0,
    violations: 0,
    coverage_rate: 1.0,      // linked / eligible, null when eligible === 0
    exception_count: 0
  },
  results: [...],            // per-row classification
  exceptions: [...]          // envelope per exception
}
```

`eligible` is engine-internal; the report surface exposes only the fields above. When `status = INCOMPLETE`, `results` is `[]` and every summary metric except `exception_count` is `null` — never zero.

---

## 7. Exception Envelope

```
{
  category: 'READ_FAILURE',
  severity: 'ERROR',
  response_id: '',
  lead_id: '',
  outreach_id: '',
  channel: '',
  reason: '...',
  evidence: { source: 'outreach log', error: '...' },
  detected_at: '<iso>',
  run_id: 'RESPRECON-<digits14>'
}
```

No `email`, `phone`, `response_text`, or `provider_message_id` is ever included. Exceptions sort deterministically by `[category, lead_id, outreach_id, reason]`. Exactly **one** READ_FAILURE exception is emitted per failed source (two for a double failure).

---

## 8. Status Semantics

| Status | Meaning |
|---|---|
| `COMPLETED` | both logs read and reconciled; summary fully populated |
| `INCOMPLETE` | one or both reads failed; metrics null, `results` empty |

The engine exposes no FAILED status: a read failure yields INCOMPLETE. `null` = "not available to me"; `0` = "read happened, found nothing". A COMPLETED run over two empty logs reports zero response records with `coverage_rate` null (no eligible rows) — this is honest, not a failure.

---

## 9. Workflow Structure — exactly 5 nodes, no initialization node

```
Manual Trigger
   │
   ├──▶ Read Response Log        (googleSheets, READ, tab 'Response Log')
   ├──▶ Read Outreach Log        (googleSheets, READ, tab 'Outreach Log')
                │
                ▼
        Reconcile Responses      (Code — src/response-reconcile.js mirror)
                │
                ▼
        Response Reconciliation Complete  (NoOp)
```

- **No Initialize node** — the response log is the durable input; there is no operator-supplied evidence envelope to seed.
- The **Manual Trigger** carries the operator metadata `response_log_read_error` / `outreach_log_read_error` when a read could not be performed; the Reconcile node reads them via the trigger items so a failed read produces an honest INCOMPLETE report instead of a fabricated healthy one.
- The Reconcile node consumes `$('Manual Trigger').all()`, `$('Read Response Log').all()`, `$('Read Outreach Log').all()`.
- **Zero write nodes.** No row is ever written, updated, or deleted on either sheet. The only artifacts produced are the `reports/<run_id>-response-reconciliation.json` outputs of the live harness, for audit.

---

## 10. Fixture Suite (`fixtures/response-reconcile-fixtures.json`, 18 fixtures)

| ID | Name | Covers |
|---|---|---|
| `TEST-RESP-RECON-001` | PERFECT_MATCH | exactly one confirmed row referenced; VERIFIED |
| `TEST-RESP-RECON-002` | OUTREACH_ID_FORMAT_INVALID | non-canonical `outreach_id`; identity not attempted |
| `TEST-RESP-RECON-003` | NONEXISTENT_OUTREACH_ID | valid format, identity absent; lead has other history |
| `TEST-RESP-RECON-004` | MATCHED_LEAD_NO_OUTREACH_ID | no `outreach_id` but lead-level link provable |
| `TEST-RESP-RECON-005` | UNMATCHED | `UNMATCHED` capture with no reconcilable identity |
| `TEST-RESP-RECON-006` | CHANNEL_MISMATCH | channel in canonical id contradicts durable channel |
| `TEST-RESP-RECON-007` | INVALID_RESPONSE | missing required `idempotency_key` |
| `TEST-RESP-RECON-008` | DUPLICATE_RESPONSE | two rows share canonical `idempotency_key` |
| `TEST-RESP-RECON-009` | DUPLICATE_OUTREACH_ID | two confirmed rows share canonical `outreach_id` |
| `TEST-RESP-RECON-010` | EMPTY_RESPONSE_LOG | zero response records, outreach populated |
| `TEST-RESP-RECON-011` | EMPTY_OUTREACH_LOG | response present, no outbound history |
| `TEST-RESP-RECON-012` | BOTH_EMPTY | COMPLETED with zero records, null coverage |
| `TEST-RESP-RECON-013` | RESPONSE_POPULATED_OUTREACH_READ_ERROR | outreach read fails → INCOMPLETE |
| `TEST-RESP-RECON-014` | RESPONSE_READ_ERROR_OUTREACH_POPULATED | response read fails → INCOMPLETE |
| `TEST-RESP-RECON-015` | BOTH_READ_ERRORS | two READ_FAILURE exceptions, metrics null |
| `TEST-RESP-RECON-016` | REORDERED_IDENTICAL | fixture 001 re-sorted; order independence |
| `TEST-RESP-RECON-017` | MULTIPLE_RESPONSES_SAME_LEAD_DISTINCT_OUTREACH | two responses, two distinct confirmed rows, 100% coverage |
| `TEST-RESP-RECON-018` | VALID_LEAD_UNPROVABLE_RELATIONSHIP | referenced row lacks `sent_at` → referenced NOT_VERIFIABLE; lead still linked via another confirmed row |

Fixtures carry `{ id, name, note, response_read_error, outreach_read_error, initialResponseRows, initialOutreachRows, expected }`. Limit: a durable row whose lead cannot be namespaced as `TEST-RESP-RECON-*` (fixtures 005, 009, 010) or a read-error fixture (013–015) is **refused by the live runner** — those scenarios are unit-tested only.

---

## 11. Run Lifecycle (Live Harness)

`scripts/run-response-reconciliation-live.js` (+ `run-response-reconciliation-live.ps1`, `npm run response-recon:live`), phases `--seed --run --verify --repeat --verify-idempotency --cleanup --verify-cleanup`:

| Phase | Action |
|---|---|
| SEED | append `TEST-RESP-RECON-*` rows to **both** tabs (Response Log + Outreach Log) from the fixture (idempotent; dry-run without `--execute`) |
| RUN | read both live tabs, reconcile, write `reports/<run_id>-response-reconciliation.json` |
| VERIFY | read both live tabs, reconcile, assert every `expected` summary metric, write artifact |
| REPEAT | reconcile again — artifact must be byte-identical (minus `run_id`/timestamps) |
| VERIFY-IDEMPOTENCY | two reconciles over the same live rows produce identical reports |
| CLEANUP | delete **only** `TEST-RESP-RECON-*` rows from both tabs; production rows survive |
| VERIFY-CLEANUP | confirm zero `TEST-RESP-RECON-*` rows remain in both tabs |

Fixed now = `2026-09-11T09:00:00.000Z` for deterministic run ids. Cleanup is namespace-guarded by lead_id on both tabs.

---

## 12. Test Suites

| Suite | File | Tests |
|---|---|---|
| Engine | `tests/response-reconcile-engine.test.js` | 21 — all fixtures, determinism, envelope hygiene, null semantics, read failures |
| Workflow sync | `tests/response-reconcile-workflow.test.js` | 18 — structure (exactly 5 nodes, no init node), zero writes, no secrets, read-error metadata, embedded↔engine parity over all fixtures |
| Live harness | `tests/response-reconcile-harness.test.js` | 26 — MockSheets e2e lifecycle, namespace guards, duplicate-response seed dedupe, cleanup survival, spawn guard |

Run: `npm run response-recon:test` (trio), `npm run response-recon:build` (re-emit `Response-Reconciliation V1.json`, must be deterministic — NO DIFF), `npm test` (whole suite).

**Verification status (offline):** engine 21/21, workflow 18/18, harness 26/26 = **65/65 PASS**.

---

## 13. Manual Run (n8n)

1. Import `Response-Reconciliation V1.json` into n8n (same spreadsheet credentials as the other lead-recovery workflows).
2. The workflow ships `active:false`. Execute manually from the Manual Trigger.
3. Read the classification report on `Response Reconciliation Complete`.
4. When a read genuinely cannot be performed, set the corresponding `response_log_read_error` / `outreach_log_read_error` metadata on the Manual Trigger so the report is INCOMPLETE — never let the workflow fabricate an empty read.

---

## 14. Summary Counts

| Metric | Value |
|---|---|
| Engine tests | 21 |
| Workflow parity tests | 18 |
| Live harness tests | 26 |
| **Total** | **65** |
| Verdict | **65/65 PASS** |
| Live verification | **NOT RUN** (no live spreadsheet creds in this environment) |

---

## 15. Verification Status (Offline)

| Area | Status | Note |
|---|---|---|
| Engine: all 18 fixture scenarios + determinism + envelope hygiene | **PASS** | 21/21 |
| Workflow structural + embedded↔engine parity | **PASS** | 18/18 |
| Live harness: MockSheets e2e SEED→RUN→VERIFY→REPEAT→VERIFY-IDEMPOTENCY→CLEANUP→VERIFY-CLEANUP | **PASS** | 26/26 |
| n8n live execution of the shipped JSON | **NOT RUN** | no n8n endpoint available |
| Live Google Sheets boundary | **NOT RUN** | no live spreadsheet creds available |

**Overall: PASS WITH LIMITATIONS** — all offline validation green; the live boundary cannot be validated in this environment and is documented as NOT RUN rather than claimed.

---

## 16. Known Limitations

- This artifact never sends, replies, interprets response text, or repairs either sheet. Any violation requires manual investigation and manual correction.
- Reconciliation proves **that** an outbound attempt was recorded with `sent_at`; it cannot prove provider-side delivery, and it never reads `response_text`.
- A response carrying no `outreach_id` can only be linked at lead level (fixture 004) or not at all — honest `NOT_VERIFIABLE`, never guessed.
- Read failures produce INCOMPLETE with null metrics. A zero-value summary from a failed read would be dishonest, so the artifact never produces one.
- The embedded jsCode mirrors `src/response-reconcile.js`; it is NOT an independent reference. The 21 engine tests are the authoritative validation.
- Client-side compatibility is with the **Response Capture V1** schema only; a row from another producer is classified honestly (INVALID_RESPONSE_RECORD / NOT_VERIFIABLE), not force-fitted.

---

## 17. Non-Goals

Response Interpretation V1 (reading `response_text` for intent, objections, reply routing, or auto-action) is **out of scope** for this artifact and untouched in this version.

---

## 18. Lineage

```
Approved Outreach Handoff V1
   └──▶ Run Reconciliation and Reporting V1
            └──▶ Outreach Queue & Planning V1
                     └──▶ Outreach Execution & Delivery V1
                              └──▶ Outreach Execution Reconciliation V1
                                       └──▶ Outreach Response Capture V1
                                                └──▶ Outreach Response Reconciliation V1  (this artifact)
```

Inbound sequence after capture: **Capture → Reconcile → Interpret → Plan → Execute**. Response Reconciliation V1 is the second step; Response Interpretation V1 is the next (separate) artifact.

---

## 19. Changelog

- **2026-09-11:** V1 complete — engine 21/21, workflow 18/18, harness 26/26 = 65/65 PASS (OFFLINE). Live NOT RUN.