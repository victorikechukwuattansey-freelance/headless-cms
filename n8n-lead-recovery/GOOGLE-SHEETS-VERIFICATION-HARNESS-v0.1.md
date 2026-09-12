# Google Sheets Verification & Fixture Harness v0.1

Harness artifact for the **Lead Recovery Engine — Approved Outreach Handoff V1** workflow (`Approved Outreach Handoff V1.json`). It validates the real `Verified Leads → Approved Outreach` handoff against the Google Sheets boundary using a deterministic `TEST-AOH-*` fixture namespace — **seed → run → verify → cleanup** — without writing any production business rules.

- **Artifact version:** v0.1
- **Companion artifacts:** `APPROVED-OUTREACH-HANDOFF-v0.1.md`, `Approved Outreach Handoff V1.json`
- **Status:** offline suite automated; live execution requires real Google Sheets / n8n credentials and is intentionally **not** claimed unless actually executed.

---

## 1. Scope and Boundary

| Layer | In scope of this harness |
|---|---|
| Boundary under test | `Verified Leads` tab → `Approved Outreach` tab (via the handoff workflow) |
| Business logic | **Read-only.** The harness never modifies the workflow's eligibility/dedup/mapping rules. |
| Verified Leads source tab | Read-only integrity assertions (see §9 category 11) |
| Approved Outreach target tab | Seed (preseed only), verify, cleanup (namespace-guarded) |
| Outreach Log | Isolation assertion only (zero `TEST-AOH-*` rows) |
| n8n | Manual Trigger workflow; execution is a manual step unless n8n API creds are available |

**What the harness does not do:**
- Does not alter `Filter Eligible Leads`, `Dedup Against Approved Outreach`, or `Prepare Approved Outreach Rows` node logic.
- Does not overwrite the formula-owned `Q:U` columns (`has_website`, `has_phone`, `target_niche`, `score`, `qualification_status`) in the production spreadsheet.
- Does not hard-code credentials, does not fabricate a LIVE PASS.

---

## 2. Verification Model

The harness reads the spreadsheet through either:

1. **Since `src/mock-sheets.js`** — in-memory transport with the same method surface as the live client (`listRows`, `appendRows`, `getSheetId`, `deleteRows`). Powers the fully automated offline suite.
2. **`src/google-sheets-client.js`** — zero-dependency live client (Node >= 18 `fetch` + `node:crypto`). Supports a short-lived `GOOGLE_ACCESS_TOKEN` **or** a service-account JSON path (`GOOGLE_SERVICE_ACCOUNT_JSON`, JWT minted and exchanged locally). 429/5xx retry with backoff; optional retry on 401 token refresh.

The shared assertion engine `src/verify.js` is transport-agnostic and produces exactly the 13 canonical categories (spec §14).

---

## 3. Fixture Contract

Namespace and fixture matrix defined in `fixtures/aoh-fixtures.json` (loaded by `src/fixtures.js`).

| Lead ID | Status | website | phone | Expected |
|---|---|---|---|---|
| `TEST-AOH-001` | QUALIFIED | ✅ | — | **insert** |
| `TEST-AOH-002` | QUALIFIED | — | ✅ | **insert** |
| `TEST-AOH-003` | REVIEW | ✅ | — | **skip** (not qualified) |
| `TEST-AOH-004` | DISQUALIFIED | ✅ | — | **skip** (not qualified) |
| `TEST-AOH-005` | QUALIFIED | — | — | **skip** (no contact path) |
| `TEST-AOH-006` | QUALIFIED | ✅ | — | **skip** (pre-seeded in Approved Outreach; dedupe) |
| `TEST-AOH-007` | QUALIFIED | ✅ | — | **insert** (mixed batch) |
| `TEST-AOH-008` | QUALIFIED | — | ✅ | **insert** (mixed batch) |

Rules enforced at load time (`fixtures.js`):

- Every `lead_id` must match `^TEST-AOH-\d+$` (`CLEANUP_REGEX`).
- No duplicate `lead_id` within the seed set.
- Every `expected.insert`/`expected.skip` id must be a known fixture id.
- Full 24-column Verified rows and 21-column Approved rows are derived from intent fields; `has_website`/`has_phone` are derived from `website`/`phone`.

---

## 4. Schema Contracts

### Verified Leads (production A–X, 24 columns)
`lead_id, business_name, niche, city, state, country, address, phone, website, rating, review_count, google_maps_url, business_type, source, search_input_id, dedupe_key, has_website, has_phone, target_niche, score, qualification_status, verified_at, notes, manual_review_notes`

**Q:U (`has_website`, `has_phone`, `target_niche`, `score`, `qualification_status`) are ARRAYFORMULA-owned in production. The harness never overwrites them in production mode** (`seed-mode formula-grown` in §6).

### Approved Outreach (production A–U, 21 columns)
`lead_id, business_name, niche, city, state, country, website, phone, email, contact_name, contact_title, email_source, email_verified, contact_form, linkedin_url, lead_score, qualification_status, outreach_channel, outreach_status, approved_at, notes`

Defaults asserted for inserted rows: `email`, `contact_name`, `contact_title`, `email_source`, `email_verified`, `contact_form`, `linkedin_url` all empty; `outreach_channel` empty; `outreach_status = not_ready`; `approved_at` populated.

---

## 5. Seed Modes

| Mode | Where | Writes Q:U? | Outcome |
|---|---|---|---|
| `plain` | Offline/mock harness + dedicated fixture sheet | Yes (deterministic) | All 8 fixtures exercisable; REVIEW/DISQUALIFIED assertable |
| `formula-grown` | Production spreadsheet | **No** — ARRAYFORMULA fills Q:U | Only source-integrity, dedup, mapping, cleanup are deterministically assertable; `qualification_status` cannot be forced |

**Consequence (honest reporting):** on the production sheet, `TEST-AOH-003/004` cannot be forced to REVIEW/DISQUALIFIED. The offline suite proves those categories deterministically (categories 3/4). A production live run reports categories 3/4 as **AUTOMATED-offline / MANUAL-not-executed**, never as a fabricated PASS.

---

## 6. Verification Procedure

### Automated offline (`npm test`)
`tests/harness-offline.test.js` runs the simulated `seed → run → verify → repeat → cleanup` cycle against `MockSheets` and asserts:

- fixture matrix invariants and eligibility → expected outcome equivalence
- full schema construction and formula-owned Q:U derivation
- the 13 canonical report lines, all PASS; schema-leak detection; Verified integrity tamper detection
- namespace-guarded cleanup (only `TEST-AOH-*` deleted; non-fixture rows survive; `assertNamespaced` refuses bad ids)
- duplicate-within-batch rejection (case 12 of spec §12)
- fixture-workflow generator (`build-fixture-workflow.js`) swaps only `documentId`, **keeps node names** (`Filter Eligible Leads`, `Dedup Against Approved Outreach`, …), and marks `active: false`
- JWT minting shape for the service-account path

### Live (`--execute` against a real spreadsheet)
```
npm run harness -- --all --execute --fixture-sheet-id=<ID>      # isolated fixture sheet
# or production spreadsheet (formula-grown; Q:U never written)
npm run harness -- --seed --run --verify --cleanup --verify-final --execute
```

Execution order (fixed): **SEED → RUN → VERIFY → CLEANUP → VERIFY-FINAL**.

1. **SEED** appends missing `TEST-AOH-*` rows to Verified Leads (+ one preseed row `TEST-AOH-006`) to Approved Outreach. Idempotent (never re-seeds an existing fixture). Requires `--execute`; default is dry-run.
2. **RUN** attempts the n8n API (`X-N8N-API-KEY`) **only when** `N8N_BASE_URL` + `N8N_API_KEY` + `N8N_WORKFLOW_ID` are configured, otherwise prints MANUAL step instructions and waits for the user to confirm execution. With `--no-interactive` and no n8n creds, the harness **aborts** rather than fabricate a pass.
3. **VERIFY** reads live tab state and prints the 13-category report (Cleanup shows `FAIL`/pending pre-cleanup — expected, `12/13`).
4. **CLEANUP** captures a pre-cleanup snapshot, deletes namespace rows only (descending indexes, one `deleteDimension` request each), then re-reads and asserts zero `TEST-AOH-*` rows remain. Non-namespaced rows are never touched. Idempotent and safe if interrupted.
5. **VERIFY-FINAL** re-prints the acceptance report using the pre-cleanup snapshot with **Cleanup = PASS** → `13/13`.

`run-live-tests.ps1` mirrors the sibling `workflows/lead-recovery-engine/run-live-tests.ps1` convention (`#Requires -Version 5.1`, `[CmdletBinding()]`, prompted secrets via `Read-Host -AsSecureString`), no credentials stored on disk.

---

## 7. The 13 Canonical Report Lines (spec §14)

```
[PASS] QUALIFIED + website          TEST-AOH-001 inserted (count == 1)
[PASS] QUALIFIED + phone            TEST-AOH-002 inserted (count == 1)
[PASS] REVIEW rejected              TEST-AOH-003 absent
[PASS] DISQUALIFIED rejected        TEST-AOH-004 absent
[PASS] Missing contact rejected     TEST-AOH-005 absent
[PASS] Existing lead deduped        TEST-AOH-006 exactly 1 (pre-seeded once)
[PASS] Mixed batch                  006/007/008 exactly 1 each
[PASS] Repeat execution             no new rows on a second run; every id exactly 1
[PASS] Mapping                      field-for-field equality + defaults + approved_at
[PASS] Schema contract              21-column exact schema; no control/formula leakage
[PASS] Verified Leads integrity     source fields unchanged for all 8 fixtures
[PASS] Outreach Log isolation       zero TEST-AOH-* rows in Outreach Log
[PASS] Cleanup                      namespace-guarded deletes verified to zero rows
---
RESULT: 13/13 PASS
```

Repeat-execution and in-batch duplicate checks only consider the `TEST-AOH-*` namespace, so pre-existing production rows do not disturb them.

---

## 8. Cleanup Safety (spec §8/§17)

- Cleanup key is **`lead_id` only**; each row must match `^TEST-AOH-\d+$` before deletion (`assertNamespaced` throws otherwise).
- business_name / phone / website are never used as delete criteria.
- Deletes run against descending absolute row indexes in a single `batchUpdate` to keep offsets valid.
- The harness is idempotent (zero rows to delete = no-op) and safe to re-run mid-sequence.

---

## 9. Integrity Assertions (Verified Leads)

`src/verify.js` compares, per fixture, these `SOURCE_INTEGRITY_FIELDS`: `lead_id, business_name, qualification_status, score, dedupe_key, verified_at`. Any change in Verified Leads caused by the run fails category 11 and is reported per-field.

---

## 10. Credentials and Secrets

- `GOOGLE_SHEET_ID`, `FIXTURE_SHEET_ID`, `GOOGLE_ACCESS_TOKEN`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_WORKFLOW_ID` are all **optional env config**. None are required for offline tests.
- `.env.example` contains placeholders only — never commit a `.env` with real credentials.
- Foursquare API key remediation (Hygiene Workstream H2): the live prospect workflow's key is no longer hardcoded — the `Foursquare Places API` node now references a named `httpHeaderAuth` n8n credential (`name: "Foursquare API"`) via `=Bearer {{$credentials.value}}`. Create the credential in n8n (value = the bare API token) and attach after import.

---

## 11. File Map

| File | Purpose |
|---|---|
| `fixtures/aoh-fixtures.json` | Canonical `TEST-AOH-*` matrix |
| `src/schema.js` | Column contracts, formula-owned set, cleanup namespace |
| `src/eligibility.js` | Mirrors `Filter Eligible Leads` |
| `src/fixtures.js` | Loads/validates fixtures; derives rows & defaults |
| `src/verify.js` | 13-category report engine |
| `src/cleanup.js` | Namespace-guarded row planning + deletes |
| `src/mock-sheets.js` | In-memory transport for offline tests |
| `src/google-sheets-client.js` | Zero-dep live Sheets client (token / service account) |
| `scripts/run-live-harness.js` | Live orchestrator (SEED/RUN/VERIFY/CLEANUP/FINAL) |
| `scripts/build-fixture-workflow.js` | Generates `.json` fixture copy (documentId swap only) |
| `tests/harness-offline.test.js` | Automated offline suite |
| `run-live-tests.ps1` | Live runner entry (prompted secrets) |
| `.env.example` | Placeholder env docs |

---

## 12. Known Limitations

- **n8n execution is not fully automatable on community edition's public API.** `POST /api/v1/executions` is an enterprise-level provision; the harness attempts it when creds exist, otherwise it documents MANUAL execution and **never claims a LIVE PASS** it did not confirm.
- **Production `formula-grown` mode cannot force REVIEW/DISQUALIFIED** fixtures (Q:U are formula-owned); those categories are proven offline and marked MANUAL-not-executed on a production live run.
- Live-run verification depends on the sheet being reachable from the machine running the harness.

---

## 13. Validation Summary (honest)

| Layer | Status |
|---|---|
| Automated offline suite | **PASS** (`npm test`: handoff 18/18 + harness categories) |
| Fixture workflow generator | Offline-verified (documentId-only swap) |
| Live Google Sheets execution | **Not run** — no real credentials configured; documented MANUAL steps, no fabricated PASS |
| n8n API execution | **Not run** — requires enterprise executions API / creds; MANUAL fallback documented |
| REVIEW/DISQUALIFIED on production sheet | AUTOMATED-offline / MANUAL-not-executed (see §6) |

## 14. Next Artifact (recommended)

A `Run-Reconciliation-and-Reporting V1` workflow (n8n) that re-reads `Approved Outreach` on a schedule and reconciles `outreach_status` transitions against the Outreach Log — reusing this harness's schema contract and cleanup conventions.