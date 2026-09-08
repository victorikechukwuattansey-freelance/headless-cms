# Texas Home Services Lead Recovery Engine — n8n MVP

A modular, config-driven n8n automation that helps Texas home-service businesses recover and manage leads arriving through web forms and related digital channels. The initial communication channel is **email**. The canonical lead model is channel-agnostic so additional channels (SMS, voice, WhatsApp) can be added later without restructuring the core data model.

> **MVP scope.** This is a working MVP built on Google Sheets + SMTP email. It is designed to be tested against a real Texas home-services business. Read the **Upgrade paths** sections before relying on it in production at scale.

---

## 1. Architecture Overview

```
                    ┌────────────────────────────────────────────┐
  Web form / API ──▶│ 01 Lead Intake   (POST /lead-intake)       │
  Booking provider─▶│ 02 Booking Status (POST /booking-status)   │
  Operator       ──▶│ 03 Manual Callback (POST /manual-callback) │
  Operator       ──▶│ 04 Manual Status Update (POST /status-update)
                    └────────────────────────────────────────────┘
                          │ (write / update)
                          ▼
               ┌──────────────────────┐      ┌──────────────────────┐
               │  Google Sheets       │      │  SMTP (Send Email)   │
               │  leads / bookings /  │      │  customer + owner    │
               │  business_config /   │      │  notifications       │
               │  errors / status_    │      └──────────────────────┘
               │  updates             │
               └──────────────────────┘
                          ▲
  05 Follow-up Sweeper (scheduled, hourly) ── reads due leads → emails → advances state

  06 Error Handler (error workflow) ── captures failures → errors sheet → admin email
```

**Design principles**

- **Config-driven, multi-tenant.** No business name, owner email, booking URL, niche, service area, or follow-up settings are hard-coded. Everything comes from the `business_config` tab, so the same five workflows serve many businesses.
- **Canonical lead model.** Every intake source is normalized into one object (`lead_id`, `business_id`, `created_at`, `source_type`, `source_id`, `name`, `phone`, `email`, `message`, `service`, `niche`, `city`, `state`, `zip`, `urgency`, `score`, `status`, `booking_link`, `booking_link_sent`, `booked`, `followup_count`, `next_followup_at`, `idempotency_key`). Channel-specific fields stay out of the core row.
- **Security before logic.** Every externally reachable webhook validates an ingress secret **before** any Google Sheets lookup or business logic.
- **Idempotent intake.** Duplicate/retry events never create a second lead. V4 makes the key deterministic (upstream event id, else a hash of normalized fields) so retries map to the same key even without an explicit one.
- **Persistence first, emails as side effects.** The lead row and `next_followup_at` are persisted first. Customer and owner emails branch after persistence and are independent of the webhook response path; their failure is sanitized and logged to the `errors` sheet and never blocks lead persistence, follow-up scheduling, or the success response.
- **Scheduled follow-ups, not Wait nodes.** The follow-up sweeper runs on a Schedule Trigger so no long-lived Wait nodes are needed.
- **Fail-safe.** Errors route to Workflow 06, which persists a sanitized record and notifies an admin. No lead is silently lost.

---

## 2. Workflow Descriptions

### 01 — Lead Intake (`01-lead-intake-v4.3.json`)
`POST /lead-intake` — primary intake for web forms and digital channels.

Validates ingress secret → validates `business_id` → reads `business_config` → validates business exists & is active → normalizes payload into the canonical lead → computes **urgency** and a **0–100 prioritization score** → checks duplicates → if duplicate, responds idempotently (no second lead) → if new, **persists the lead**, **computes and persists `next_followup_at`**, then responds `200 created`. Email side effects branch after persistence and are independent of the webhook response path — no strict temporal ordering between the response and email is claimed.

- **Execution order (V4.3):** `Append Lead → Compute Next Follow-up → Update Lead Next Follow-up`, which fans out to `Respond 200 Created` **and** `Prepare Email Content` (the latter branches to `Customer Email Present?` and `Owner Email Present?`). The response path and the email branches are independent; no strict temporal ordering between them is claimed.
- **Email failure isolation (V4):** both Send Email nodes use `onError: continueErrorOutput`. On failure the error is captured, sanitized, and appended to the `errors` sheet; processing continues. SMTP/provider errors are never exposed to the customer or the response, and no second lead is created.
- **Deterministic idempotency (V4):** `idempotency_key` is derived as `business_id|source_type|source_id` when an upstream event id exists, else a local hash of `business_id|source_type|normalized phone|normalized email|normalized message`. An explicit `idempotency_key` in the payload still takes precedence.
- **HTML escaping (V4):** user-controlled fields (`name`, `message`, `service`, `phone`, `email`, `city`, `state`, `zip`, booking link) are HTML-escaped (local helper) before being placed in email templates, preventing injection. Raw values are still stored unchanged in Sheets.
- **Booking URL validation (V4.3):** a booking link is rendered as a clickable `href` only when it is a valid HTTPS URL. `javascript:`, `data:`, `vbscript:`, `file:`, and other non-HTTPS schemes, plus malformed URLs, are treated as absent — no booking link is rendered and the lead is still created. Production booking URLs must be HTTPS.
- **Owner email gating (V4.3):** the owner notification sends only when both `owner_email` and `from_email` are configured; otherwise it is skipped cleanly (no SMTP attempt, no error) and the lead remains valid.
- Customer email: acknowledges receipt, identifies the business, includes the booking link when available, allows replies to reach the business. It makes **no unsupported promises**.
- Owner notification includes: lead ID, customer name, contact info, service, urgency, score, message, booking link, source, and timestamp.

### 02 — Booking Status (`02-booking-status.json`)
`POST /booking-status` — receives booking confirmations.

Validates secret → validates payload has a reference → finds the lead by `lead_id`, then **fallback to phone + business_id**, then **fallback to email + business_id** → appends a `bookings` record → marks the lead `booked` (`booked=true`, `booked_at`, `status=booked`, `next_followup_at` cleared) → notifies the owner → responds.

> **C2 (hardening).** This workflow's `pinData` previously carried a real test secret value. It has been redacted to a placeholder. Rotate that secret wherever it was copied (§14); it is not reproduced in this repository.

The booking-link construction is **configurable** in `business_config.booking_link` and can preserve `lead_id` as a query parameter where the provider supports it (see §17).

### 03 — Manual Callback Log (`03-manual-callback-log.json`)
`POST /manual-callback` — an operator records a missed call / callback request.

Validates business → normalizes into a lead (`source_type=manual_callback`) → duplicate check → creates the lead → **owner notification** → schedules `next_followup_at` → logs a `status_updates` record. This workflow sends **no automated customer email unless `business_config.auto_customer_email = true`**.

### 04 — Manual Status Update (`04-manual-status-update.json`)
`POST /status-update` — an operator changes a lead status.

Validates business → finds the lead → reads the existing status → **whitelists** the new status (`new`, `contacted`, `qualified`, `booked`, `lost`, `no_response`, `closed` — anything else → 422) → updates the lead → writes a `status_updates` record → if the new status is `booked`/`lost`/`closed`, clears `next_followup_at` to stop future follow-ups → notifies the owner if configured.

> **C4 (hardening).** The `Respond 422` node now sets `responseCode: 422`. Previously the JSON body carried `422` but the HTTP status defaulted to `200`. Invalid statuses now actually return `422` over the wire, with no lead mutation and no `status_updates` row (§12).

### 05 — Follow-up Sweeper (`05-followup-sweeper.json`)
Scheduled (default hourly, via a `scheduleTrigger` — **no long Wait nodes**).

Reads active businesses and leads → selects candidates where: business is active, `status` is not `booked`/`lost`/`closed`/`no_response`, `next_followup_at <= now`, `followup_count < max_followups`, and a valid email exists → sends a follow-up email → increments `followup_count` → sets `last_contact_at` → computes the next `next_followup_at`.

When `followup_count` reaches `max_followups`: sets `status = no_response` and `next_followup_at = null`. The lead is **never contacted indefinitely**.

Respects the business-configured `followup_delay_hours`, `max_followups`, and `timezone`. Defaults are conservative (24h, 3 max).

> Follow-ups **do not guarantee conversion.** The sweeper only ensures timely, bounded persistence.

### 06 — Error Handler (`06-error-handler.json`)
An n8n **error workflow** (assign it as the error workflow for 01–05).

Captures `workflow`, `node`, `execution ID`, timestamp, error message, `business_id`/`lead_id` when available, and a **sanitized** payload. Writes a row to the `errors` sheet and emails the configured administrator. Secrets and credentials are never sent to the admin or stored (see the redaction logic in the Code node).

> **C3 (hardening).** The admin notification address and sender are read from `$env.LEAD_ENGINE_ADMIN_EMAIL` / `$env.LEAD_ENGINE_ADMIN_FROM` at execution time — they are no longer hard-coded into the workflow (previously a literal email was embedded). Both env vars must be set on the instance (§5) for the admin email to send.

---

## 3. Google Sheets Setup

Create one Google Spreadsheet. Inside it, create the following tabs with **exactly** these header names (header row = row 1). Header names drive the `autoMapInputData` mapping used by the Google Sheets nodes, so do not rename them.

### Tab: `leads`
```
lead_id | business_id | created_at | updated_at | source_type | source_id | name | phone | email | message | service | niche | city | state | zip | urgency | score | status | booking_link | booking_link_sent | booked | booked_at | booking_id | owner_notified | followup_count | next_followup_at | last_contact_at | last_customer_response_at | idempotency_key | notes
```

> `booking_id` is written by Workflow 02 when a booking confirms, so the lead row carries the correlation ID.

> **Copy-paste starter files:** ready-to-import CSVs with exact headers **and** sample rows live in [`sheets-seed/`](sheets-seed/) — one file per tab (`business_config.csv`, `leads.csv`, `bookings.csv`, `status_updates.csv`, `errors.csv`). In Google Sheets use **File → Import → Upload → Insert new sheet(s)** per tab, or open each CSV and copy/paste into the tab. The sample rows include an active HVAC business, an active plumbing business, an **inactive** business (to test the 403 path), and a lead whose `next_followup_at` is already in the past (to test the sweeper).

### Tab: `business_config`
```
business_id | business_name | active | owner_name | owner_email | reply_to_email | from_email | booking_link | business_secret | followup_delay_hours | max_followups | timezone | niche | service_area | default_message
```

> **Optional added column** for Workflow 03 gating: `auto_customer_email` (TRUE/FALSE). Default `FALSE` = no automated customer email for manual callbacks. Add the column if you want to enable it per business.

### Tab: `bookings`
```
booking_id | lead_id | business_id | created_at | booking_at | source | status
```

### Tab: `errors`
```
error_id | created_at | workflow | node | business_id | lead_id | error_message | execution_id | payload | resolved
```

### Tab: `status_updates`
```
update_id | created_at | lead_id | business_id | old_status | new_status | updated_by | notes
```

**Example `business_config` row:**

| business_id | business_name | active | owner_name | owner_email | reply_to_email | from_email | booking_link | business_secret | followup_delay_hours | max_followups | timezone | niche | service_area | default_message |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| biz_texas_ac | Carter AC & Plumbing | TRUE | Jim Carter | jim@carterac.com | hello@carterac.com | no-reply@carterac.com | https://book.carterac.com?lead_id={{lead_id}} | `biz-secret` | 24 | 3 | America/Chicago | HVAC | Austin, TX | We respond within 24 hours. |

> The `business_secret` column is supported by the data model for per-business secrets (a production enhancement). The MVP ingress gate uses the instance-wide `LEAD_ENGINE_SECRET` env var so it works with the default nodes. See §9.

---

## 4. Required Credentials

Configure these in n8n **Credentials** (click the credential node on each workflow, or add once and select it):

| Credential | Type (n8n name) | Used by |
|---|---|---|
| Google Sheets OAuth2 | `Google Sheets OAuth2 API` | Workflows 01–06 (all Google Sheets nodes) |
| SMTP | `SMTP` | Workflows 01–06 (all Send Email nodes) |

Set up the Google Service Account / OAuth as documented in n8n for the Google Sheets node, and your SMTP host/credentials for email.

> **Send Email node type (V4.2+):** the internal n8n node type is `n8n-nodes-base.emailSend` (display name "Send Email"). Workflow 01 v4.3 uses this type. Workflows 02–06 still use the older `sendEmail` type and should be updated to `emailSend` in a follow-up pass.

## 5. Required Environment / Configuration Variables

These are instance-level environment variables read via `$env` expressions (set them on the n8n host / container before activation):

| Variable | Purpose | Notes |
|---|---|---|
| `LEAD_ENGINE_SECRET` | Ingress secret. Every webhook compares header `X-Lead-Engine-Secret` to this value. | **Do not hard-code.** This is the shared secret used by all five webhook workflows (01–04 and 07). |
| `LEAD_ENGINE_ADMIN_EMAIL` | Recipient of Workflow 06 error notifications. Workflow 06 reads it via `$env.LEAD_ENGINE_ADMIN_EMAIL`. | **Required.** Must be configured on the n8n instance, or Workflow 06's admin email step fails. |
| `LEAD_ENGINE_ADMIN_FROM` | From address for Workflow 06 error notifications. Workflow 06 reads it via `$env.LEAD_ENGINE_ADMIN_FROM`. | **Required.** Must be configured on the n8n instance, or Workflow 06's admin email step fails. |

Where secrets/credentials must be configured:

1. **`LEAD_ENGINE_SECRET`** — instance env var (referenced in each webhook's `Valid Secret?` If node). Set it once; never place it in a workflow body, response, log, or email.
2. **`__YOUR_GOOGLE_SPREADSHEET_ID__`** — replace in every Google Sheets node's `documentId` with your spreadsheet ID (the long ID in the sheet URL). Alternatively set the credential and pick the document from the dropdown.
3. **Google Sheets OAuth2** and **SMTP** credentials — attach to the credential nodes (placeholders `__GOOGLE_SHEETS_CRED_ID__`, `__SMTP_CRED_ID__` are left in the import; replace with your own credentials in the UI).

> Do **not** commit real credentials. The import contains placeholder credential objects; n8n will prompt you to select/create credentials on activation.

> **Documentation-only hardening patch (C1–C4).** This README documents the C1–C4 security/response fixes applied to the production workflows. See §7 (C1 — Workflow 07 auth gate), §14 (C2/C3 — secret rotation and env-driven admin addresses), and §12 (C4 — real HTTP 422). Workflow JSON is unchanged by this README patch.

## 6. Webhook Paths

| Workflow | Method | Path | Notes |
|---|---|---|---|
| 01 Lead Intake | POST | `/lead-intake` | |
| 02 Booking Status | POST | `/booking-status` | |
| 03 Manual Callback | POST | `/manual-callback` | |
| 04 Manual Status Update | POST | `/status-update` | |
| 05 Follow-up Sweeper | — | none (Schedule Trigger) | Run manually to test |
| 06 Error Handler | — | none (error trigger) | Assign as error workflow |

Full URLs are shown in the n8n UI when a workflow is saved and the webhook is active (e.g. `https://<your-n8n-host>/webhook/lead-intake`).

## 7. Authentication Mechanism

Every webhook workflow begins with a **`Valid Secret?`** If node:

- Reads header `X-Lead-Engine-Secret`.
- Compares it (exact string) to `$env.LEAD_ENGINE_SECRET`.
- Mismatch or missing → `Respond 401` immediately, **before** any Sheets lookup or business logic.

> **C1 (hardening).** Workflow 07 (`/customer-response-07`) previously lacked this ingress gate. It now uses the same `Valid Secret?` node + `Respond 401 Invalid Secret` pattern as Workflows 01–04, wired so the gate runs **before** any normalization, lookup, or mutation. Unauthorized requests to any webhook receive `401` with no state change.

This is a shared-secret ingress gate, appropriate for an MVP. Per-business secrets (`business_config.business_secret`) are a documented production enhancement (§17). The gate rejects unknown/inactive businesses at the next stage with `403`.

> **Business-level authentication (V4):** the MVP does **not** implement per-business client authentication. It preserves the single shared `LEAD_ENGINE_SECRET` ingress gate and validates that the requested `business_id` exists and is active. All business configuration and duplicate checks are scoped by `business_id`. Two-factor/tenant client authentication is a future enhancement — the workflow does not claim it.

## 8. Example Payloads

See `TEST_PAYLOADS.json` for a full set with expected outcomes. Minimal example:

```json
// POST /lead-intake   Header: X-Lead-Engine-Secret: <your secret>
{
  "business_id": "biz_texas_ac",
  "source_type": "web_form",
  "source_id": "form-001",
  "name": "John Carter",
  "phone": "+1 (512) 555-0142",
  "email": "john.carter@example.com",
  "message": "I need an AC quote for my 3,000 sq ft home in Austin.",
  "service": "HVAC",
  "city": "Austin",
  "state": "TX",
  "zip": "78701"
}
```

## 9. Import Instructions

1. Open n8n, go to **Workflows** → **Import from File** (or drag & drop).
2. Import in order: `01-lead-intake-v4.3.json` (replaces `01-lead-intake.json` / `01-lead-intake-v4.json` / `01-lead-intake-v4.2.json`), `02-booking-status.json`, `03-manual-callback-log.json`, `04-manual-status-update.json`, `05-followup-sweeper.json`, `06-error-handler.json`, `07-customer-response.json`.
3. For each workflow, open the credentials nodes and attach your **Google Sheets** and **SMTP** credentials; replace `__YOUR_GOOGLE_SPREADSHEET_ID__` with your spreadsheet ID.
4. Add the env vars from §5 to your n8n instance and restart.
5. Set up the spreadsheet tabs from §3 with your first business row.

**Workflow 06 import/activation requirements** (C3):

- Workflow 06 is an n8n **error workflow** (`errorTrigger`), not a webhook, so it never appears in §6. It exists to capture failures from Workflows 01–05.
- On import, its Admin Error Notification node references `$env.LEAD_ENGINE_ADMIN_FROM` and `$env.LEAD_ENGINE_ADMIN_EMAIL` — set **both** on the n8n instance (step 4) before activating Workflow 06 and before any error can route to it.
- Activate Workflow 06 and assign it as the **error workflow** for Workflows 01–05 (see §10, step 2). Workflow 07 must also route errors to 06 where configured.
- If the env vars are unset at the time an error routes to it, the email step fails — the errors-tab record is still written by the preceding Sheets step, but the admin notification will not send until the vars are set and n8n is restarted.

## 10. Activation Instructions

1. Create/save all workflows so n8n assigns stable webhook URLs and workflow IDs.
2. **Wire the error workflow:** open each workflow (01–05) → **Settings → Error workflow** → select `06 - Error Handler`. (Or configure it globally under **Settings → Error Workflows**.) This ensures failures route to Workflow 06.
3. Activate **01, 02, 03, 04** (Webhook) and **05** (Schedule). Activate **06** so it can receive errors.
4. Confirm each workflow is **Active** (green toggle).

## 11. Testing Instructions

1. Prepare the spreadsheet tabs and at least one `business_config` row with `active = TRUE`.
2. Run `TEST_PAYLOADS.json` (V4, 20 cases) against the live webhook URLs (see §6). For Workflow 01, recommended order: T08 (bad secret), T09 (missing business_id), T10 (unknown), T11 (inactive), T01 (valid with email), T02 (no email), T03/T04/T05/T06 (duplicates), T16 (malformed), T17 (HTML injection), T18/T19 (booking link), T20 (missing owner email), then T12 (customer email failure), T13 (owner email failure), T14 (Sheets failure), T15 (follow-up update failure). T07 documents the concurrent-duplicate limitation (not a pass/fail test).
3. **Follow-up sweeper:** run Workflow 05 **manually** (execute workflow) after backdating a lead's `next_followup_at` to the past, then confirm the email + state change. T14/T15 cover both the normal and the max-reached terminal path.
4. Confirm error handling by temporarily breaking a node (e.g., wrong sheet name) and running Workflow 01; verify a sanitized row lands in `errors` and the admin email arrives. Confirm email-failure isolation (T12/T13) by pointing an email at an unreachable recipient and verifying the lead still persists and the response is still `200 created`.

## 12. Failure Scenarios

The workflows fail safely and log where appropriate. Handled cases include: invalid webhook, invalid authentication (401), missing business (403), inactive business (403), malformed payload (400), missing `business_id` (400), duplicate lead (idempotent 200), missing customer email (skips customer email), missing owner email (skips owner email), Google Sheets failure (→ error workflow), email provider failure (→ **isolated**, sanitized + logged to `errors`, lead remains valid), booking lookup failure (404), invalid status (422), and missing required fields (400). Duplicate leads are never created on retries (idempotency gate in Workflow 01/03). Critical failures (authentication, business validation, lead persistence, follow-up persistence) never produce a false `200 created`.

> **C4 (hardening).** In Workflow 04, `Respond 422` now sends an actual HTTP `422` status (`responseCode: 422`). Previously the JSON body carried `422` but the HTTP status was left at the default `200`, which violated the documented contract. A rejected status update now returns `422` over the wire, still with **no lead mutation and no `status_updates` row written**.

## 13. Known Limitations

- **MVP:** Google Sheets is not a transactional database. Concurrent writes / race conditions on duplicate checks are possible under load.
- **Concurrency (V4, explicit):** Google Sheets duplicate detection is retry-aware but **not transactionally race-safe under concurrent requests.** Two identical requests arriving simultaneously can both pass the read-then-append check before either sees the other's row. This is a documented limitation, not a concurrency-safe guarantee. Production fix: unique index on `idempotency_key`.
- **Read-all-then-filter:** the Code nodes read the full `leads`/`business_config` tabs before filtering (deliberately retained; correctness over premature optimization). Does not scale past thousands of rows without pagination or a database.
- **Phone normalization:** duplicate comparison uses digits-only normalization (a local, country-agnostic helper). International-number edge cases (country codes, extension formatting) remain a limitation; a robust per-country library is intentionally not introduced.
- `autoMapInputData` requires the exact header names from §3.
- Per-business secret is modeled (`business_config.business_secret`) but the MVP gate uses the instance-wide `LEAD_ENGINE_SECRET`.
- Follow-up timing is UTC-based; timezone is respected via the business `followup_delay_hours` but the sweeper fires on an instance-wide schedule, not per-business business-hours windows.
- Booking-link `lead_id` preservation depends on the booking provider supporting query parameters; V4 appends `?lead_id=<id>` (or substitutes `{{lead_id}}`) when the configured link lacks a lead identifier.
- Booking links are scheme-validated as HTTPS-only (V4.3). `http://` and non-HTTP(S) schemes are rejected, so a misconfigured or malicious booking link is treated as absent rather than rendered.

## 14. Security Considerations

- **Ingress secret first.** No business logic or Sheets access before the `Valid Secret?` gate.
- **No hard-coded secrets.** The secret lives in `$env.LEAD_ENGINE_SECRET`; credentials live in n8n Credentials.
- **Redaction.** Workflow 06 scrubs common secret patterns (`secret`, `token`, `password`, `api_key`, `authorization`, `bearer`) from stored and emailed payloads.
- **No secrets in responses, logs, or emails.** Error emails carry only sanitized fields.
- **C2: no embedded test secrets.** A real test secret value that was previously embedded in Workflow 02's `pinData` has been **removed and replaced with a placeholder**. Any copy of that exposed/test secret must be **rotated** in `$env.LEAD_ENGINE_SECRET` and elsewhere it was used. The value is not reproduced in this repository — do not reintroduce it.
- **C3: env-driven admin addresses.** Workflow 06's admin notification reads `LEAD_ENGINE_ADMIN_FROM`/`LEAD_ENGINE_ADMIN_EMAIL` from `$env` — no hard-coded admin email addresses in the workflow. Both must exist on the instance (§5, §9).
- Keep the spreadsheet access restricted to the service account; do not share it publicly.

## 15. Email Considerations

- Uses the n8n **Send Email** (SMTP) node. Configure a real SMTP relay/domain with SPF/DKIM to avoid spam folders.
- Customer emails identify the business, include the booking link when available, allow replies (via `reply_to_email`), and make **no unsupported promises**.
- Owner notifications contain full lead context but never secrets.
- Set `reply_to_email` so customer replies reach the business, not the n8n host.

## 16. How to Add Another Business

1. Add a row to `business_config` with a unique `business_id`, `active=TRUE`, owner/from/reply-to emails, `booking_link`, follow-up settings, niche, service area.
2. Point your forms at `/lead-intake` with that `business_id`.
No workflow changes are required — everything is config-driven.

## 17. How to Add Another Communication Channel

Because intake is normalized to the **canonical lead model**, a new channel is an additional intake workflow that outputs the same canonical object (then reuses the append / dedup / email logic), not a change to the core model:

1. **Create a new webhook workflow** (e.g., `07-sms-intake`) that authenticates, validates the business, and **normalizes to the same canonical lead fields** (same `lead_id`, `business_id`, `source_type=SMS`, `idempotency_key`, etc.).
2. Route its output into the same Google Sheets `leads` append and dedup path (either reuse the nodes or point the new workflow at the same sheets).
3. For **outbound** follow-ups on the new channel, add a channel column (e.g., `sms_number`) to `leads` and a matching delivery node in Workflow 05 (branch by channel), or add a parallel channel sweeper.

The booking-link construction is configurable in `business_config.booking_link`; append `?lead_id={{lead_id}}` (or equivalent) where the provider supports query params so booking confirmations can be correlated back via Workflow 02.

## 18. Upgrade Path Toward a Database

1. Replace the read-all Google Sheets nodes with **Postgres / MySQL** nodes using the same normalized schema and `WHERE` filters (`business_id`, `idempotency_key`, `phone`, `email`).
2. Move duplicate detection into a unique-index/`INSERT ... ON CONFLICT` on `idempotency_key` for true atomicity (eliminates the read-then-write race).
3. Add proper indexing (`leads(idempotency_key)`, `leads(business_id, next_followup_at)`, `leads(business_id, phone)`, `leads(business_id, email)`).
4. Keep the canonical model unchanged; only the storage layer changes.

## 19. Upgrade Path Toward a SaaS Product

1. Expose the webhook endpoints behind an API gateway with per-tenant API keys (replace the shared ingress secret).
2. Replace `business_config` with a tenant/account table and true multi-tenant auth.
3. Move from spreadsheets to a managed database with per-tenant RLS (see §18).
4. Add per-business channels (SMS/voice/WhatsApp) via provider adapters behind the canonical model (§17).
5. Add a UI/CRM layer on top of the same canonical lead model, plus analytics on the `score` (prioritization only), `status_updates`, and `bookings` data.

---

### MVP vs. Production vs. Future

| Concern | MVP (this repo) | Production recommendation | Future / SaaS |
|---|---|---|---|
| Storage | Google Sheets | Postgres/MySQL with indexes + unique constraints | Managed DB with RLS |
| Auth | Shared `LEAD_ENGINE_SECRET` header | Per-business secret / HMAC signatures | API keys, OAuth, per-tenant |
| Channel | Email only | Email + provider adapters | Multi-channel orchestration |
| Follow-up | Scheduled sweeper | Queue-backed, business-hours aware | Workflow orchestration platform |
| Errors | Error workflow → sheets + admin email | Centralized log + alerting + retry queues | Observability platform |
