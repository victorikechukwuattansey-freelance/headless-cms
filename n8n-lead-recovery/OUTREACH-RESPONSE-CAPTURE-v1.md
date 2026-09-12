# Outreach Response Capture V1

**Version 1 — 2026-09-11**
**Workflow:** `Response-Capture V1.json`
**Artifact lineage:** Outreach Execution & Delivery V1 (execution) → Outreach Execution Reconciliation V1 (read-only reconciliation) → **Outreach Response Capture V1** (capture-only inbound boundary)
**Execution status:** Capture-only — the single durable write surface in the workflow is the Response Log append, gated behind an explicit REAL-mode branch. DRY_RUN is the default and writes nothing.

The inbound-response ingestion boundary of the Lead Recovery Engine. It takes operator-supplied inbound events (email replies, call callbacks), resolves them to a lead identity non-fuzzily, deduplicates against the durable Response Log, and produces a report plus — only in REAL mode — durable Response Log rows. It **captures** responses only. It never interprets intent, never replies, never schedules follow-ups, never qualifies, never syncs to a CRM, and never calls a provider.

The engine sequence this artifact belongs to is **Capture → Reconcile → Interpret → Plan → Execute**.

---

## 1. Purpose

Answer "what inbound responses actually came back, for which leads, with which idempotency guarantees?" — honestly, not deceptively. The engine turns raw provider webhook/ingest events into normalized, deduplicated Response Log rows, and it refuses to guess identities: if no lead identity can be proven for an event, the event is captured as an `UNMATCHED` durable row with an empty `lead_id`, never silently dropped and never assigned to a guessed lead.

---

## 2. Input: The Normalized Inbound Event

The engine accepts a batched array of raw events. Each event is normalized (trimmed, stringified) into this shape:

| Field | Required | Meaning |
|---|---|---|
| `event_id` | yes | unique event identifier; used for dedupe when `provider_message_id` is absent |
| `source` | yes | provider/source label (e.g. `mock-provider`); joins the idempotency key namespace |
| `channel` | yes | `email` \| `call` (the only supported response channels in this repo) |
| `provider_message_id` | no | provider's own message id; preferred dedupe basis when present |
| `lead_id` | no | explicit lead id — highest-priority identity, when supplied |
| `outreach_id` | no | outbound id of form `EX-<lead_id>-<channel>`; resolves identity when present |
| `sender` | no | contact identity (email or phone string) |
| `recipient` | no | contact identity (email or phone string) |
| `received_at` | yes | ISO timestamp; must be parseable |
| `response_text` | yes | the response body; must be non-empty |
| `raw_reference` | no | passthrough reference (e.g. thread id), never used for identity |

Nothing is fabricated: missing fields normalize to `''`, and identity is never synthesized.

---

## 3. Validation Gates (Inline Override Path Order)

Each event is checked in this exact order; the first failing gate marks the event `INVALID`:

1. `event_id` missing → `MISSING_EVENT_ID` (ERROR)
2. `channel` missing → `MISSING_CHANNEL` (ERROR)
3. `channel` not in `{email, call}` → `INVALID_CHANNEL` (ERROR)
4. `received_at` not parseable → `INVALID_TIMESTAMP` (ERROR)
5. `response_text` empty → `MISSING_RESPONSE` (ERROR)

Only events that pass all five gates are eligible for identity resolution, dedupe, and staging.

---

## 4. Identity Resolution (No Fuzzy Matching)

Identity is resolved in strict priority order — the first proven match wins, exact matches only:

1. **Explicit `lead_id`** — non-empty wins outright.
2. **`outreach_id` parse** — must match `/^EX-(.+)-(email|call)$/` (greedy, so multi-dash lead ids are fine) **and** the parsed channel must equal the event channel.
3. **`sender` exact** — contacts in `identity_lookup` matched verbatim.
4. **`sender` phone digits** — only when `sender` looks like a phone (`/^\+?[\d\s\-().]+$/`); digits-only comparison against the lookup's digit keys.
5. **`recipient` exact** — same exact rule as sender.
6. **`recipient` phone digits** — phone-gated, same as sender.

If none resolve → the event is captured as a durable `UNMATCHED` row (`lead_id: ''`, `matched: false`, `response_status: UNMATCHED`, WARNING). Unmatched rows are deliberately empty-lead so nobody silently owns them.

---

## 5. Idempotency

- **Idempotency key = `(provider_message_id || event_id)::source`** — provider id preferred, event id as fallback, source namespaces the key.
- **`response_id = 'RESP-' + fnv1a32Hex(key)`** — deterministic 32-bit FNV-1a over the key, fixed 8 hex digits (`/^RESP-[0-9a-f]{8}$/`).
- Keys are checked against the **pre-existing ledger** (current Response Log rows) AND the in-batch seen set; re-staging is impossible for a key already present.
- In-batch duplicates: the first occurrence stages, subsequent ones become `DUPLICATE` (WARNING) rows carrying the same key.
- Re-ingestion of an already-persisted event is a `DUPLICATE` — never a second durable row.

---

## 6. Response Log Schema (`RESPONSE_COLUMNS`, 12 columns)

| # | Column | Notes |
|---|---|---|
| 1 | `response_id` | `RESP-<hex>` deterministic id |
| 2 | `idempotency_key` | dedupe basis; unique in the log |
| 3 | `lead_id` | resolved lead, or `''` when unmatched |
| 4 | `outreach_id` | `EX-<lead_id>-<channel>` (derived, or `''` when unmatched) |
| 5 | `channel` | `email` \| `call` |
| 6 | `provider_message_id` | **persisted here** — this is the capture boundary; the "never in sheets" rule is outbound-only |
| 7 | `received_at` | normalized ISO UTC timestamp |
| 8 | `response_text` | the response body |
| 9 | `response_status` | `CAPTURED` \| `UNMATCHED` \| `INVALID` \| `DUPLICATE` |
| 10 | `source` | provider/source label |
| 11 | `matched` | `true` \| `false` |
| 12 | `notes` | always `''` in the engine |

The prepare-write node projects exactly these 12 columns, stringified, in order.

---

## 7. Vocabulary

| Status | Meaning |
|---|---|
| `CAPTURED` | valid event, identity resolved, staged/persisted |
| `UNMATCHED` | valid event, identity not resolvable, staged/persisted with empty lead |
| `INVALID` | failed a validation gate; never staged |
| `DUPLICATE` | idempotency key already present; never re-staged |

---

## 8. Error Codes, Severity, Reasons

| Code | Severity |
|---|---|
| `MISSING_EVENT_ID` | ERROR |
| `MISSING_CHANNEL` | ERROR |
| `INVALID_CHANNEL` | ERROR |
| `INVALID_TIMESTAMP` | ERROR |
| `MISSING_RESPONSE` | ERROR |
| `UNMATCHED_IDENTITY` | WARNING |
| `DUPLICATE_EVENT` | WARNING |
| `SOURCE_READ_FAILURE` | ERROR |

Only `UNMATCHED_IDENTITY` and `DUPLICATE_EVENT` are warnings — the two cases that are normal, continuing conditions rather than malformed input.

---

## 9. Report Shape

```
{
  run_id: 'RESPCAP-<digits14(now)>',       // /^RESPCAP-\d{14}$/
  run_at: ISO,
  mode: 'DRY_RUN' | 'REAL' | null,          // null on read failure
  status: 'COMPLETED' | 'FAILED',
  sources: { response_log_ok, response_log_read_error },
  summary: {
    events_processed, captured, unmatched, invalid, duplicate,
    staged, persisted, exception_count          // null-valued on read failure
  },
  results: [...],                              // one card per input event
  response_rows: [...],                        // only in REAL mode
  exceptions: [...]
}
```

Semantics:
- `staged = captured + unmatched`
- `persisted = REAL ? staged : 0`
- `response_rows` is `[]` in DRY_RUN mode (writes are simulation-only).
- Each **result card** carries `event_id, source, channel, status, status_reason, matched, idempotency_key, response_id, lead_id, outreach_id, would_persist` — and never leaks `response_text`, `sender`, `recipient`, `raw_reference`, or `provider_message_id`.
- Sorts: results by `[event_id, source, channel]`; rows by `[idempotency_key]`; exceptions by `[category, event_id, channel, lead_id, reason]` with an exact-evidence JSON tiebreak — deterministic output invariant.

---

## 10. Exception Envelope

Each exception carries exactly: `category, severity, event_id, channel, lead_id, outreach_id, response_id, reason, evidence, detected_at, run_id`.

`evidence` is intentionally minimal (e.g. `{ source, error_code }`). It never embeds response text, contact addresses, provider message ids, or anything else that would leak PII into logs.

---

## 11. Status Semantics

- `COMPLETED` — the engine ran to completion; summary metrics are real numbers (possibly all zero for an empty batch).
- `FAILED` — the Response Log could not be read (`response_log_read_error` non-empty). Capture is **refused entirely**: an empty ledger would silently turn every re-ingested event into a dup-unaware stage, so the engine reports `FAILED`, nulls every summary metric, emits `results: []`, `response_rows: []`, and exactly one `SOURCE_READ_FAILURE` (ERROR) exception. A false zero is never reported.

---

## 12. Null vs Zero Semantics

`FAILED` → `null` for all seven summary metrics + `NULL`-like `mode`. `COMPLETED` with zero events → zeros. The two states are not interchangeable in the report and are asserted separately in tests.

---

## 13. Workflow Structure (`Response-Capture V1.json`)

Nine nodes, shipped **inactive** (`active: false`):

```
Manual Trigger
  ├─ Initialize Response Capture      (code — emits single-mode envelope)
  ├─ Read Response Log                (Google Sheets read — 'Response Log')
  └─ Capture Inbound Responses        (code — single-item report)
       └─ DRY_RUN?                    (IF — leftValue '={{ $json.mode }}', rightValue 'DRY_RUN', string equals)
            ├─ true  → Build Capture Result (noOp) → Response Capture Complete
            └─ false → Prepare Response Log Write (code) → Write Response Log (Google Sheets append) → Response Capture Complete
```

- **Initialize Response Capture** normalizes the input to `{ mode, events, identity_lookup, response_log_read_error }`; `mode` is coerced to `REAL` only when the input says `REAL` (case-insensitive), else `DRY_RUN`.
- **Capture Inbound Responses** embeds a synchronous mirror of `src/response-capture.js` and always emits exactly one report item (the always-output pattern), so the IF node always has `$json.mode`.
- **DRY_RUN?** true branch routes to a no-op completion (**cannot reach the write**); only the false (REAL) branch reaches the single **Write Response Log** append node. There is exactly one durable write surface in the workflow.
- **Prepare Response Log Write** maps `report.response_rows` through the 12 `RESPONSE_COLUMNS`, stringified, in order.
- No send/scheduling/webhook/provider/enrichment nodes exist in the file; no credentials, secrets, bearer tokens, or env interpolation are embedded; code nodes use no `staticData`, no `process.env`, no `$env`.
- `meta.spreadsheetId` = `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`; `meta.defaultMode = 'DRY_RUN'`.

The workflow is generated by `scripts/build-response-capture-workflow.js` (deterministic; the shipped JSON equals its output byte-for-byte).

---

## 14. Fixture Suite (`fixtures/response-capture-fixtures.json`, 18 fixtures)

Namespace `TEST-RESP`, ids `/^TEST-RESP-\d+$/`. Covers:

- **001** `VALID_MATCHED_EMAIL` — outlet `EX-<lead>-<channel>` → CAPTURED, REAL persists one row.
- **002** `SAME_EVENT_TWICE_DUPLICATE` — one durable row + one `DUPLICATE_EVENT`.
- **003** `DIFFERENT_PROVIDER_MESSAGE_IDS` — two provider messages = two distinct captures.
- **004** `VALID_MATCHED_CALL` — `call` channel via outreach parse.
- **005** `UNKNOWN_SENDER_UNMATCHED` — persists an `UNMATCHED` durable row (empty lead). *(repurposes the spec's unused `whatsapp` slot)*
- **006** `EXPLICIT_LEAD_ID` — explicit lead wins over everything. *(repurposes the spec's unused `sms` slot)*
- **007** `EXPLICIT_OUTREACH_ID` — malformed/foreign outreach ids resolve nothing.
- **008** `CONTACT_LOOKUP_EMAIL` — sender exact-match fallback.
- **009** `CONTACT_LOOKUP_PHONE_DIGITS` — phone-gated digits fallback.
- **010–014** invalid cascade — each gate, plus nested-channel invalidation semantics.
- **015** `DRY_RUN_ZERO_WRITES` — DRY_RUN never emits `response_rows`.
- **016** `REAL_ONE_WRITE` — REAL writes exactly one durable row.
- **017** `REPEAT_INGESTION_IDEMPOTENT` — pre-existing ledger key → `DUPLICATE`, not a second row.
- **018** `REORDERED_IDENTICAL` — `reorder_of` 001: identical input, identical report.

`identity_lookup` subscribes to the sheet's `lead_id`-keyed contact map and is supplied per fixture (often empty). The fixtures are the executable spec for the engine, the embedded mirror, and the live harness.

---

## 15. Run Lifecycle (Live Harness)

`scripts/run-response-capture-live.js` (+ `run-response-capture-live.ps1`) drives the ordered phases against a configured Google Sheets Response Log:

```
seed → ingest → verify → repeat → verify-idempotency → cleanup → verify-cleanup
```

- `--seed` writes the scenario's `initialResponseRows` (deduped by idempotency key).
- `--ingest` **never mutates the spreadsheet**; it runs the deterministic engine and writes `<run_id>-response-capture.json` to `--reports-dir`.
- `--verify` reads the live log, compares engine metrics **and the live idempotency key set** against the scenario, and checks for duplicate keys.
- `--repeat` simulates re-ingestion with the previously staged rows; expects zero newly staged/persisted.
- `--verify-idempotency` re-ingests over the *live* log rows and asserts zero staged.
- `--cleanup` deletes only `TEST-RESP-*` rows (lead_id namespace-guarded — a non-namespaced lead id throws). DRY_RUN without `--execute` deletes nothing.
- `--verify-cleanup` asserts zero `TEST-RESP-*` rows remain.

All mutations require **`--execute`**. Only the Response Log is ever touched, and only `TEST-RESP-*` rows are ever seeded or deleted. `GoogleSheetsClient.fromEnv(env)` requires `GOOGLE_SHEET_ID` (plus `GOOGLE_ACCESS_TOKEN` or `GOOGLE_SERVICE_ACCOUNT_JSON`); the runner exits `1` with a clear message when `GOOGLE_SHEET_ID` is missing. FIXED_NOW = `2026-09-11T09:00:00.000Z` keeps offline runs deterministic. Scenarios that persist `UNMATCHED` durable rows cannot run live (`assertLiveableScenario` throws): an empty `lead_id` cannot be namespace-cleaned, so those fixtures are validated by the offline engine/workflow suites only.

---

## 16. Test Suites

- **Engine** — `tests/response-capture-engine.test.js`: 29 tests; 18-fixture coverage, determinism, order-independence, idempotency, read-failure FAILED semantics, DRY_RUN zero-write, REAL row exactness, result-card hygiene, exception-envelope keys, `ERROR_CODE_SEVERITY`/`ERROR_CODE_REASON` values, summary invariants, sorted output.
- **Workflow** — `tests/response-capture-workflow.test.js`: 19 tests; 9 exact node names, connections, IF-gate topology (DRY_RUN cannot reach the write), one write surface, embedded↔engine parity on every fixture, embedded columns ≡ `RESPONSE_COLUMNS`, blocklisting of send/scheduler/provider nodes, no secrets, deterministic builder.
- **Harness** — `tests/response-capture-harness.test.js`: 25 tests; full SEED → INGEST → VERIFY → REPEAT → VERIFY-IDEMPOTENCY → CLEANUP → VERIFY-CLEANUP on a mock, namespace guards, dry-run semantics, spawn guard for missing `GOOGLE_SHEET_ID`.

Run any or all:

```bash
npm run response-capture:test      # all three suites
npm run response-capture:build     # regenerate Response-Capture V1.json
npm run response-capture:live      # node runner (see §15)
.\run-response-capture-live.ps1    # PowerShell driver (see §15)
```

---

## 17. Manual Run (n8n)

1. Import `Response-Capture V1.json` into n8n.
2. Attach a Google Sheets OAuth2 credential to **Read Response Log** and **Write Response Log**.
3. Execute on `DRY_RUN` first (correct default): the report shows what *would* persist; nothing is written.
4. To persist, feed `mode: REAL` (plus `events`, `identity_lookup`, optional `response_log_read_error`) into the workflow input, and re-execute. Only the false branch of `DRY_RUN?` can reach the append.

---

## 18. Reconciliation Compatibility

`UNMATCHED` rows are intentionally empty-lead so a later reconciliation/interpretation pass can never attribute them to the wrong person. The persisted `provider_message_id` and `response_id` give the reconciliation layer a concrete inbound-side key that pairs naturally with the outbound-side `EX-<lead>-<channel>` outreach ids produced by Outreach Execution & Delivery V1. Because this artifact never writes any other tab, the Outreach Log used by reconciliation stays untouched as its sole writer's view.

---

## 19. Known Limitations

| Limitation | Why | Workaround |
|---|---|---|
| No live inbound provider is wired | This repo has no real Gmail/IMAP, Twilio, or webhook integration | Feed operator-supplied events into the `events` input; validate with the harness first |
| No streaming/evented ingestion | Engine and workflow are batch-oriented on the manual trigger | Schedule/trigger a bridge outside this artifact |
| `UNMATCHED` durable rows cannot be cleaned by the live harness | Empty `lead_id` fails the `TEST-RESP-*` namespace guard by design | Manually triage unmatched rows; they are intentionally visible, never silently owned |
| `response_text` is not used for anything | Interpretation is explicitly out of scope (Interpret runs after Capture) | Consume the Response Log in the downstream Interpret stage |
| Phone identity requires `looksLikePhone` | `sender`/`recipient` non-phone strings are never digit-matched | Supply proper contact strings or use `identity_lookup` exact keys |
| Idempotency keys depend on `source` | Same provider id from two sources are two keys | Keep `source` stable per provider channel |

---

## 20. Verification Status

**Offline (green, reproducible):** engine 29/29, workflow 19/19, harness 25/25; full repo suite 321/321 passes with the 248-test baseline intact.
**Live:** **NOT RUN / NOT CONFIGURED** — the n8n workflow, Google Sheets boundary, and any real inbound provider require credentials and an integration that do not exist in this repo. Mocks are not a substitute for live validation and are never reported as such.

---

## 21. Lineage

Approved Outreach Handoff V0.1 → Run Reconciliation & Reporting V1 → Outreach Queue & Planning V1 → Outreach Execution & Delivery V1 → Execution Reconciliation V1 → **Outreach Response Capture V1**. Sequence applied in production: Capture → Reconcile → Interpret → Plan → Execute.

---

## 22. Changelog

- **2026-09-11 — v1** — First release: engine, 18 fixtures, embedded mirror, workflow (9 nodes, one REAL-gated write surface), offline suites (73 new tests), live runner + PS1 driver, doc. Capture-only; no interpretation, replies, or provider calls.

---

## 23. Worked Example: Reading a Report

Input: fixture **TEST-RESP-001** (one valid email reply, matched via `EX-TEST-RESP-001-email`, REAL mode). The report:

```
run_id:      RESPCAP-<digits14(now)>
mode:        REAL
status:      COMPLETED
sources:     { response_log_ok: true, response_log_read_error: '' }
summary:     events_processed 1 | captured 1 | unmatched 0 | invalid 0
             duplicate 0 | staged 1 | persisted 1 | exception_count 0
results:     [ { event_id evt-001-a, status CAPTURED, matched true,
                 idempotency_key 'mock:RESP-001-1::mock-provider',
                 response_id 'RESP-<hex8>', lead_id 'TEST-RESP-001',
                 outreach_id 'EX-TEST-RESP-001-email', would_persist true } ]
response_rows: [ one 12-column row with response_status CAPTURED, matched true ]
exceptions:  []
```

Reading it: exactly one inbound event was captured, identity proven (not guessed), the idempotency key is unique in the log, and because mode is `REAL` one durable Response Log row was written. If the same event were fed again, the report would show `duplicate 1`, `staged 0`, `persisted 0`, and a single `DUPLICATE_EVENT` WARNING — never a second durable row. If the Response Log had been unreadable, the whole report would instead be `FAILED` with `exception_count 1` (`SOURCE_READ_FAILURE`) and **null** summary metrics — no silent zero.