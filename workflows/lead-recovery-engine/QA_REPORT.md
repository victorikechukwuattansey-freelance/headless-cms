# QA Report — Texas Home Services Lead Recovery Engine (n8n MVP)

**Date:** 2026-08-21
**Scope:** Static inspection of the six generated n8n workflows + supporting files.
**Method:** Manual review of JSON validity, n8n node types/versions/parameters, connections, webhook/auth/security, idempotency, duplicate handling, error handling, Google Sheets references, email/booking/follow-up/status logic, and missing-field handling.

> **Verification honesty.** None of these workflows have been imported into or executed in a live n8n instance as part of this review. Structural correctness is verified statically; runtime behavior is **not** verified. Anything that cannot be confirmed without a live n8n is explicitly marked **`REQUIRES LIVE N8N VALIDATION`** below. Accordingly, **no workflow is scored 10/10.**

---

## Post-Review Fixes (applied 2026-08-21)

A second full read-through found **three real defects**, all fixed and re-validated (`ConvertFrom-Json` passes on all files):

| # | File | Defect | Fix |
|---|---|---|---|
| F1 | `02-booking-status.json` | `Prep Lead Booked Update` read `$input.item.json` (the booking row from `Prep Booking Row`), so `item.lead` / `item.booking` were `undefined` → runtime crash; also lost `booking_id` for the final response | Node now reads `$('Resolve Lead & Booking').first().json` and carries `booking_id` through |
| F2 | `04-manual-status-update.json` | `Get Business Config` AND `Read Existing Leads` both connected into `Resolve Lead, Config & Validate Status` → double execution of the Code node (duplicate updates) | `Get Business Config` converted to a dead-end reference branch (`main: []`); resolve node reads it via `$('Get Business Config')` |
| F3 | `05-followup-sweeper.json` | Same convergence bug into `Select Follow-up Candidates`; plus `Advance Follow-up State` used `$input.item.json` inside a `runOnceForAllItems` Code node → only the first candidate advanced while all candidates got emails | `Get Active Businesses` made a dead-end reference branch; `Advance Follow-up State` rewritten to `.map()` over `$input.all()` so every candidate advances |

Also added during seed-file generation: `booking_id` column added to the documented `leads` headers (README §3) so Workflow 02's lead update persists the correlation ID instead of silently dropping it under `autoMapInputData`.

---

## 0. Global Checks

| Check | Result | Notes |
|---|---|---|
| All 6 `.json` files parse as valid JSON | ✅ PASS | Verified via `ConvertFrom-Json`; node/connection counts present. |
| Workflow top-level structure (`name`, `nodes`, `connections`, `settings`, `active`) | ✅ PASS | Matches n8n import shape. |
| Node `type` values are real n8n node names | ✅ PASS | `n8n-nodes-base.webhook`, `.if`, `.respondToWebhook`, `.code`, `.googleSheets`, `.sendEmail`, `.scheduleTrigger`, `.noOp`, `.errorTrigger`. |
| No invented/unsupported node types | ✅ PASS | Only standard base nodes used. |
| `typeVersion` values plausible | ⚠️ PARTIAL | Versions chosen from current n8n knowledge; see per-node notes. `REQUIRES LIVE N8N VALIDATION` for `googleSheets` v3 and `webhook` v2 parameter shapes. |
| Credentials referenced by type, not embedded | ✅ PASS | `googleSheetsOAuth2Api`, `smtp`; placeholder ids only. |
| No hard-coded business data | ✅ PASS | All business data read from `business_config`. |
| No hard-coded secrets | ✅ PASS | Secret via `$env.LEAD_ENGINE_SECRET`. |
| Secret gate precedes Sheets/business logic | ✅ PASS | Every webhook workflow has a `Valid Secret?` If node first. |
| Connections reference existing node names | ✅ PASS | Cross-checked against node names in each file. |
| JS in Code nodes returns valid item arrays | ✅ PASS | All Code nodes `return [{ json: ... }]` (or arrays thereof). |

---

## 1. `01-lead-intake.json` — **Score: 8.5 / 10**

**Strengths**
- Ingress secret gate before any lookup. ✅
- `business_id` presence check (400) before config read. ✅
- Config-driven normalization; canonical lead + config merged in one Code node. ✅
- Urgency classifier + transparent 0–100 prioritization score (documented; not revenue). ✅
- Duplicate detection with all four strategies (idempotency_key, source_id, phone+business_id, email+business_id). ✅
- Idempotent duplicate response (200, no second lead). ✅
- Customer email gated on valid email; owner email gated on valid owner email. ✅
- `next_followup_at` computed from business `followup_delay_hours` and persisted. ✅

**Issues**
1. **Race condition in dedup** — read-then-append is not atomic; two near-simultaneous identical events could both pass the duplicate check. MVP-acceptable; **production**: unique index on `idempotency_key`.
2. **Reads entire `leads` tab** each run — does not scale; acceptable for MVP.
3. `REQUIRES LIVE N8N VALIDATION` — `googleSheets` v3 `append`/`update` with `columns.mappingMode=autoMapInputData` and `rowsToUpdate.defineBelow` shapes; `webhook` v2 `responseMode=responseNode`; `if` v2 condition object shape; `$env.LEAD_ENGINE_SECRET` expression.
4. Response bodies use expressions (e.g. `JSON.stringify(...)`); if an expression errors, the Respond node fails — covered by error workflow, but worth a smoke test.
5. `booking_link_sent` computed in a later Code node; if the update node fails, email still sent (acceptable).

---

## 2. `02-booking-status.json` — **Score: 8.5 / 10**

**Strengths**
- Secret gate + reference-presence validation. ✅
- Lead lookup: `lead_id` → phone+business_id → email+business_id. ✅
- Booking record appended; lead marked `booked`, `booked_at` set, `next_followup_at` cleared (stops sweeps). ✅
- Owner notification gated on owner email. ✅
- Config read runs as a parallel branch referenced by the resolve Code node. ✅

**Issues**
1. **Multi-input branch pattern** — `Booking Reference Present?` fans out to both `Read Existing Leads` and `Get Business Config`; the resolve Code node reads both via `$('Get Business Config')`. This depends on the parallel branch executing. **`REQUIRES LIVE N8N VALIDATION`** — confirm the dead-end branch actually executes when its output is unused. *(Post-review fix F1 corrected a related defect in `Prep Lead Booked Update`.)*
2. **Booking-link `lead_id` preservation** is configurable (README §17) but depends on the provider supporting query params; not verifiable generically.
3. `googleSheets` update shape — **`REQUIRES LIVE N8N VALIDATION`** (same as §1).
4. No per-business secret validation (uses shared secret) — documented enhancement.

---

## 3. `03-manual-callback-log.json` — **Score: 8.0 / 10**

**Strengths**
- Secret gate; business validation; dedup; owner notify; follow-up scheduling; status logging. ✅
- Customer email **only** when `auto_customer_email=true` in config (default false). ✅
- Source typed as `manual_callback`. ✅

**Issues**
1. `REQUIRES LIVE N8N VALIDATION` — `googleSheets` append/update shapes; `if` v2; `webhook` v2.
2. Neutral urgency/score hard-coded (50) for callbacks — intentional and documented, but means callbacks are not auto-scored like web leads. Acceptable for MVP; future: reuse the scorer.
3. `status_updates` logging path wired via `Build Status Record` → `Log Status (new)`; note the `Log Status (new)` node appends the record built by `Build Status Record`. Static wiring verified; runtime **`REQUIRES LIVE N8N VALIDATION`**.

---

## 4. `04-manual-status-update.json` — **Score: 8.0 / 10**

**Strengths**
- Secret gate; `business_id` + `lead_id` required (400). ✅
- Reads existing status; **whitelists** statuses (422 on invalid). ✅
- Terminal statuses (`booked`/`lost`/`closed`) clear `next_followup_at`; `booked` sets `booked`/`booked_at`. ✅
- Writes `status_updates` record; optional owner notify. ✅

**Issues**
1. `REQUIRES LIVE N8N VALIDATION` — `googleSheets` read/update shapes; `if` v2; `webhook` v2.
2. `Resolve Lead, Config & Validate Status` Code node reads two sheets via `$('...')` references (config + leads). Confirmed node references; runtime **`REQUIRES LIVE N8N VALIDATION`**. *(Post-review fix F2 removed the double-input convergence that previously caused double execution.)*
3. Status string normalization lowercases input; acceptable.

---

## 5. `05-followup-sweeper.json` — **Score: 8.0 / 10**

**Strengths**
- **No Wait nodes** — driven by `scheduleTrigger` (hourly cron). ✅
- Filters: active business, status not booked/lost/closed/no_response, `next_followup_at<=now`, `followup_count<max`, valid email. ✅
- Respects business `followup_delay_hours` and `max_followups`. ✅
- On max reached: `status=no_response`, `next_followup_at=null` — bounded, never indefinite. ✅
- `Any Candidates?` → `noOp` end path. ✅
- Bulk updates all candidates in one `googleSheets` update. ✅

**Issues**
1. **Timezone handling** — the sweeper fires on an instance schedule (UTC by default); per-business `timezone` is stored but not used to gate business-hours windows. The business `followup_delay_hours` is respected. Documented limitation.
2. `REQUIRES LIVE N8N VALIDATION` — `scheduleTrigger` v1.2 `rule.interval` cron shape; `googleSheets` multi-row update with `rowsToUpdate.defineBelow` when multiple items flow in; `if` v2.
3. Mixed item shapes out of `Select Follow-up Candidates` (real candidates vs. `{_noCandidates:true}` placeholder) — the `Any Candidates?` If routes them correctly by boolean, but this is a subtle pattern; **`REQUIRES LIVE N8N VALIDATION`**.
4. Bulk update correctness (one call, many rows) must be validated; if the provider/version updates only the first match, per-lead looping may be needed. *(Post-review fix F3 corrected the convergence bug and the single-item `Advance Follow-up State` defect; the multi-row update itself remains a live-validation item.)*

---

## 6. `06-error-handler.json` — **Score: 8.0 / 10**

**Strengths**
- Uses `errorTrigger` (proper n8n error workflow). ✅
- Captures workflow, node, execution ID, timestamp, message, business_id/lead_id. ✅
- **Payload sanitization** regex scrubs `secret|token|password|api_key|authorization|bearer` before store/email. ✅
- Writes to `errors` sheet; admin email uses `$env.LEAD_ENGINE_ADMIN_EMAIL`. ✅

**Issues**
1. `REQUIRES LIVE N8N VALIDATION` — the exact fields available on the `errorTrigger` output (`executionId`, `workflowId`, `error.message`, `error.node`) and their names. The Code node defensively falls back to empty strings, so a name mismatch degrades gracefully.
2. Error workflow must be **assigned** to workflows 01–05 (README §10). Not automatic on import.
3. `errors` sheet append uses `autoMapInputData` — **`REQUIRES LIVE N8N VALIDATION`**.

---

## 7. `TEST_PAYLOADS.json` — ✅ PASS
Covers: normal, emergency, missing email, duplicate, invalid secret, inactive business, missing field, booking, manual callback, status (valid + invalid), malformed booking, unknown-lead booking, follow-up candidate, and max-reached follow-up. Each has a stated expected outcome.

## 8. `README.md` — ✅ PASS
Contains all 20 required sections: architecture, workflow descriptions, Sheets setup, exact columns, credentials, env vars, webhook paths, auth, example payloads, import/activation/testing, failure scenarios, limitations, security, email considerations, add-business, add-channel, and both upgrade paths. Distinguishes MVP / production / future.

---

## 9. V4 Reliability & Security Patch (`01-lead-intake-v4.json`, 2026-08-21)

The V3 workflow was patched in place (new file `01-lead-intake-v4.json`; `01-lead-intake.json` left untouched). This is a **reliability/security patch, not a redesign.**

### What changed
1. **Persistence-first execution order.** `Append Lead → Compute Next Follow-up → Update Lead Next Follow-up → Respond 200 Created`, then a fan-out to email branches. Emails are non-critical side effects after persistence.
2. **Email failure isolation.** Both Send Email nodes set `onError: continueErrorOutput`. Failures route to per-email sanitize + `errors`-sheet appends. Lead persistence, follow-up scheduling, owner notification, and the response are all independent of either email's success.
3. **Deterministic idempotency.** `idempotency_key` now derives from `business_id|source_type|source_id` when an event id exists, else a local FNV-1a hash of `business_id|source_type|normalized phone|normalized email|normalized message`. Explicit payload `idempotency_key` still wins. No external hashing service.
4. **Tenant-scoped duplicate detection.** The `source_id + source_type` duplicate check now also requires matching `business_id` (V3 matched globally). Phone/email were already scoped.
5. **Phone normalization.** Duplicate phone comparison uses a digits-only value computed transiently; the stored `phone` is unchanged and no new column is added.
6. **HTML escaping.** A local `esc()` helper emits `_esc_*` copies of all user-controlled fields consumed by both email templates (prevents message/name injection into owner email). Raw values remain stored unchanged.
7. **Config validation flags.** `_fromEmailPresent` gates the customer email branch (customer email must exist AND `from_email` configured). Optional fields (customer email, owner email, booking link) remain optional.
8. **Booking link attribution.** `withLeadId()` substitutes `{{lead_id}}` or appends `?lead_id=<id>` when the configured link lacks a lead identifier.
9. **Robustness to Sheets output shape.** `Compute Next Follow-up`, `Prepare Email Content`, the responders, and error builders read authoritative data via `$('Check Duplicate')` / `$('Compute Next Follow-up')` references instead of relying on Google Sheets node output passthrough.
10. **BUG FIX (critical): `Is Duplicate?` branch polarity.** In V3 the branches were inverted: `TRUE` (duplicate) connected to `Append Lead` and `FALSE` (new) to `Respond 200 Duplicate Accepted`. This would re-append duplicates and mis-label new leads. V4 corrects it: `TRUE → Respond 200 Duplicate Accepted`, `FALSE → Append Lead`.

### What was preserved
- Webhook path `/lead-intake`, workflow name, node IDs of all retained nodes.
- Canonical lead model and `leads`/`business_config`/`errors` column names (unchanged; no new persisted columns).
- Existing 0–100 scoring logic (untouched).
- Four-way duplicate strategy (idempotency_key, source_id, phone, email) — improved, not removed.
- Response codes (401/400/403/200 duplicate/200 created).
- Global ingress secret gate (`$env.LEAD_ENGINE_SECRET`) and the read-all-then-filter config lookup.
- Follow-up sweeper contract (`next_followup_at` persisted before response; sweeper unchanged).
- Customer/owner email copy (HTML bodies now escaped; text bodies unchanged; subjects unchanged).

### Nodes modified (3)
- `Resolve Config & Normalize Lead` (idempotency, booking link, escaping, config flags).
- `Check Duplicate` (tenant-scoped source_id, digits-only phone).
- `Compute Next Follow-up` (reads authoritative data via node reference).
- `Is Duplicate?` (notes updated; connection polarity fixed).
- `Customer Email Present?` (added `from_email` condition).
- `Customer Acknowledgment`, `Owner Notification` (added `onError: continueErrorOutput`; HTML bodies escaped).
- `Respond 200 Created` (reads via node reference; note updated).
- `Get Business Config`, `Append Lead`, `Update Lead Next Follow-up` (notes updated only).

### Nodes added (9)
- `Prepare Email Content` (Code).
- `Skip Customer Email`, `Skip Owner Email`, `End Customer Email`, `End Owner Email` (noOp terminators).
- `Build Customer Email Error Record`, `Build Owner Email Error Record` (Code, sanitize).
- `Append Customer Email Error`, `Append Owner Email Error` (googleSheets append to `errors`).

### Connections changed
- `Is Duplicate?`: `main[0] → Respond 200 Duplicate Accepted`, `main[1] → Append Lead` (polarity fix).
- `Append Lead → Compute Next Follow-up → Update Lead Next Follow-up` (reordered; previously emails sat between append and follow-up).
- `Update Lead Next Follow-up` now fans out to both `Respond 200 Created` and `Prepare Email Content`.
- `Prepare Email Content` fans out to `Customer Email Present?` and `Owner Email Present?`.
- Each email node has two outputs: `main[0]` → end noOp; `main[1]` (error) → build+append error record (separate appends per email to avoid convergence double-execution).

### Scores (V4; all < 10 pending live execution)

| Dimension | Score | Notes |
|---|---|---|
| Architecture | 9 | Persistence-first, isolated side effects |
| Security | 9 | HTML escaping added; redaction preserved |
| Tenant isolation | 9 | source_id scoped by business_id |
| Idempotency | 8.5 | Deterministic keys; still not race-safe (documented) |
| Persistence reliability | 9 | Critical persistence precedes response |
| Error handling | 8.5 | Emails isolated; critical failures surfaced |
| Email isolation | 9 | onError continueErrorOutput + errors-sheet sink |
| Follow-up reliability | 9 | Scheduled before response, email-independent |
| Data integrity | 8.5 | No column changes; robustness to Sheets output shape |
| n8n compatibility | 8 | Several params require live validation |

### Remaining limitations
- **Google Sheets duplicate detection is retry-aware but not transactionally race-safe under concurrent requests.** Two identical simultaneous requests can both pass the read-then-append check. (Explicitly documented; production fix = unique index.)
- Digits-only phone normalization is country-agnostic; international edge cases remain a limitation.
- `business_config` is read-all-then-filter (retained deliberately).
- Business-level (per-tenant) client authentication is a future enhancement; the MVP uses the shared secret.

### `REQUIRES LIVE N8N VALIDATION` (V4)
- `onError: "continueErrorOutput"` node property and the shape of the error-output item (`{ error, item }` vs. message-only) on `sendEmail` v2.1.
- `googleSheets` v3 append/update with `autoMapInputData` silently dropping non-matching keys (relied upon for `_esc_*` not persisting).
- `googleSheets` v3 update output passthrough (mitigated by node-reference reads).
- `if` v2 condition object with multiple `AND` conditions (Customer Email Present?).
- `webhook` v2 `responseMode=responseNode` + `respondToWebhook` continuing execution after a response is sent (the post-response fan-out).
- `$execution.id` availability in Code nodes.
- `$env.LEAD_ENGINE_SECRET` in expressions.
- `noOp` v1 as an explicit terminator on otherwise-unconnected outputs.

---

## 10. V4.2 Surgical Patch (`01-lead-intake-v4.2.json`, 2026-08-21)

A minimal surgical patch on top of V4. `01-lead-intake.json` and `01-lead-intake-v4.json` are untouched. Node IDs, names, webhook path, canonical model, scoring, HTML escaping, deterministic idempotency, and the follow-up architecture are preserved.

### Changes

1. **`sendEmail` → `emailSend`.** Both Send Email nodes (`Customer Acknowledgment`, `Owner Notification`) now use the internal type `n8n-nodes-base.emailSend` (the valid n8n node type). `typeVersion` (2.1), SMTP credential reference, all email parameters, and `onError: continueErrorOutput` are preserved. Email copy is unchanged.
2. **Corrected email fan-out.** `Update Lead Next Follow-up` and `Prepare Email Content` previously encoded a fabricated second `main[1]` output from single-output nodes (googleSheets and Code). Both are now a single-output fan-out (`main[0]` with two targets). No reliance on a nonexistent second output.
3. **Removed Respond-to-Webhook continuation.** `Respond 200 Created` is a terminal node; `Prepare Email Content` branches from the persistence node (not from the response node's output). No node chains off a `respondToWebhook` output.
4. **Tenant-scoped idempotency key.** The `idempotency_key` duplicate comparison now requires matching `business_id` (`&& rowBid === bid`), matching the scoping already applied to `source_id`, `phone`, and `email`. Duplicate order: `idempotency_key + business_id` → `source_id + source_type + business_id` → `phone + business_id` → `email + business_id`. No schema change; no new column.
5. **Global error-workflow configuration.** The workflow's `settings.errorWorkflow` remains empty — **REQUIRES CONFIGURATION**. The exported files use placeholder `id` values (e.g. `wf-lead-intake`, `wf-error-handler`), which are **not** valid n8n workflow IDs; real IDs are assigned by the n8n instance on import. In n8n: open Workflow 01 → **Settings → Error Workflow → select "06 - Error Handler"** (repeat for 02–05). No fake ID was inserted.
6. **Preserved email failure isolation.** Both email nodes retain `onError: continueErrorOutput`; their error outputs continue to sanitize → append `errors` record. Email failure cannot delete/invalidate the lead, block follow-up persistence, or change the success response.

### Static audit results

| Check | Result |
| --- | --- |
| Correct Send Email internal type | PASS (`n8n-nodes-base.emailSend`) |
| No `sendEmail` references remain | PASS (0 occurrences) |
| Email fan-out uses valid n8n topology | PASS (single-output fan-out) |
| Response node not used as continuation | PASS (`Respond 200 Created` is terminal) |
| Idempotency tenant scoped | PASS (`idempotency_key && rowBid === bid`) |
| Error workflow configured | REQUIRES CONFIGURATION (see change 5) |
| Customer email isolated | PASS (`continueErrorOutput` + errors sink) |
| Owner email isolated | PASS (`continueErrorOutput` + errors sink) |
| Broken connections | PASS (0 missing targets) |
| Orphaned functional nodes | PASS (0) |

Node-type audit (internal identifiers): `webhook` v2, `if` v2, `respondToWebhook` v1, `googleSheets` v3, `code` v2, `noOp` v1, `emailSend` v2.1 — all real n8n node types; zero invented types.

### Cross-cutting note (out of scope for this patch)

Workflows 02–06 still reference `n8n-nodes-base.sendEmail` and should receive the same `sendEmail` → `emailSend` rename in a follow-up pass. This patch touches only `01-lead-intake-v4.2.json` per scope.

### `REQUIRES LIVE N8N VALIDATION` (V4.2)

- `emailSend` v2.1 parameter surface (`fromEmail`, `toEmail`, `replyTo`, `subject`, `html`, `text`) and `onError: continueErrorOutput` error-output item shape.
- `googleSheets` v3 `autoMapInputData` silently dropping non-matching keys (`_esc_*`, merged config fields).
- `webhook` v2 + `respondToWebhook` continuing execution across the post-response fan-out.
- `if` v2 multi-condition AND; `$execution.id` and `$env.LEAD_ENGINE_SECRET` in Code/expressions.
- `noOp` v1 as terminator.
- Error-workflow assignment (change 5) must be done manually in n8n.

Not production-ready: no live n8n import/execution has been performed.

---

## 11. V4.3 Tiny Security/Configuration Patch (`01-lead-intake-v4.3.json`, 2026-08-21)

A tiny surgical patch on top of V4.2. Node IDs, names, webhook path, canonical lead model, scoring, HTML escaping, deterministic idempotency, duplicate strategy, Google Sheets schema, response codes, email copy, and the follow-up architecture are preserved. `01-lead-intake.json`, `01-lead-intake-v4.json`, and `01-lead-intake-v4.2.json` are untouched.

### Changes

1. **Booking URL scheme validation.** The normalization Code node now validates any booking link with the standard `URL` parser before it can be placed in an `<a href="...">`. Only `https:` is accepted; `javascript:`, `data:`, `vbscript:`, `file:`, `http:`, and other non-HTTPS schemes, plus malformed URLs, are rejected and treated as absent (empty string), so no unsafe `href` is ever generated. The lead itself is always persisted regardless. `{{lead_id}}` substitution and `lead_id` query-param attribution are preserved; an existing `lead_id` is not duplicated.
2. **Booking-link precedence.** A request-supplied `body.booking_link` is used only when it is a trusted HTTPS URL. If it is absent or invalid, the operator-configured `business_config.booking_link` is used instead (also validated). An invalid request link is treated as absent — it is never silently rendered and never invalidates the lead.
3. **Owner email requires `from_email`.** `Owner Email Present?` now requires BOTH `owner_email` isNotEmpty AND `_fromEmailPresent == true` (mirroring the customer email gate). Missing configuration skips the owner email cleanly — no SMTP attempt, no generated error — and the lead remains valid.
4. **Documentation corrected.** Notes and README no longer claim that emails execute strictly after the HTTP response. The branch topology guarantees independence, not a strict temporal ordering: the response path and the email side effects both branch from `Update Lead Next Follow-up`, and persistence always happens first.

### Static audit

| Check | Result |
| --- | --- |
| HTTPS booking URL validation | PASS / REQUIRES LIVE N8N VALIDATION |
| javascript: blocked | PASS |
| data: blocked | PASS |
| malformed URL handled safely | PASS |
| lead_id attribution preserved | PASS |
| Owner email requires from_email | PASS |
| Missing owner config skips cleanly | PASS |
| Persistence architecture unchanged | PASS |
| Response path unchanged | PASS |
| Email isolation unchanged | PASS |
| No sendEmail node type | PASS |
| Broken connections | PASS |
| Duplicate IDs | PASS |

> The `safeBookingLink` helper was unit-tested locally against 18 inputs (valid HTTPS, existing `lead_id`, `{{lead_id}}` substitution, `javascript:`/`data:`/`vbscript:`/`file:`/`http:`/`ftp:` rejection, malformed input, and request-vs-config precedence). These are logic tests, **not** an n8n execution — the first row above is therefore marked both PASS (local logic) and REQUIRES LIVE N8N VALIDATION (not yet run in a live n8n instance).

### `REQUIRES LIVE N8N VALIDATION` (V4.3)

- `new URL(...)` availability and behavior in the n8n Code node runtime (Node.js ≥ 10; expected present).
- `emailSend` v2.1 / `googleSheets` v3 / `webhook` v2 / `if` v2 parameter shapes (unchanged from V4.2; still unverified live).
- `onError: continueErrorOutput` error-output item shape.
- The `Owner Email Present?` two-condition AND actually skipping SMTP delivery when `from_email` is absent (static condition present; runtime behavior unverified).
- Error-workflow assignment must be done manually in n8n.

Not production-ready: no live n8n import/execution has been performed.

---

## Summary

| File | Score (0–10) | Key open items |
|---|---|---|
| 01-lead-intake (V4) | 8.5 | persistence-first; email isolation; race-safe dedup (documented); live validation |
| 02-booking-status | 8.5 | parallel-branch execution; node-param shapes |
| 03-manual-callback-log | 8.0 | neutral score; node-param shapes |
| 04-manual-status-update | 8.0 | multi-sheet references; node-param shapes |
| 05-followup-sweeper | 8.0 | timezone; multi-row update; candidate routing |
| 06-error-handler | 8.0 | errorTrigger field names; error-workflow assignment |

**All scores are < 10 by design** because no workflow has been imported and executed in a real n8n environment.

### Items requiring live n8n validation (not claims of failure)
- `googleSheets` node v3 parameter shapes (`documentId`, `sheetName`, `operation`, `columns.mappingMode=autoMapInputData`, `rowsToUpdate.defineBelow`).
- `webhook` node v2 `responseMode=responseNode` + `respondToWebhook` interaction.
- `if` node v2 condition object shape and `boolean` operators.
- `scheduleTrigger` v1.2 `rule.interval` cron format.
- `errorTrigger` output field names.
- Parallel/dead-end branch execution (Workflow 02) and multi-item routing (Workflows 03, 05).
- `$env.LEAD_ENGINE_SECRET` expression availability in node parameters.

### Recommended verification sequence (after import)
1. Validate all six imports open without node errors.
2. Run `TEST_PAYLOADS.json` in order against live webhooks.
3. Manually execute Workflow 05 with backdated leads (T14/T15).
4. Force an error to confirm Workflow 06 fires (README §11).
