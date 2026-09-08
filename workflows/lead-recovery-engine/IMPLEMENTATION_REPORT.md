# Implementation Report — Lead Recovery Engine Workflows 02–05

**Date:** 2026-08-23
**Standard:** Live-validated Lead Intake V4.3 patterns (n8n Cloud 2.36.5)
**Scope:** 02 Booking Status (rebuilt), 05 Follow-up Sweeper (rebuilt), 04 Manual Status Update (hardened), 03 Manual Callback (fixed + hardened). **Workflow 01 was NOT modified.**

---

## 1. Nodes replaced / removed

| Workflow | Removed | Replaced with |
|---|---|---|
| 02 | `n8n-nodes-base.sendEmail` "Owner Booking Notification" | FRESH native `n8n-nodes-base.emailSend` v2.1 |
| 03 | `sendEmail` ×2 ("Callback Customer Email", "Owner Callback Notification") | FRESH native `emailSend` v2.1 ×2 |
| 04 | `sendEmail` ("Owner Status Notification") | FRESH native `emailSend` v2.1 |
| 05 | `sendEmail` ("Send Follow-up Email") | FRESH native `emailSend` v2.1 |

Zero `n8n-nodes-base.sendEmail` references remain as node types (verified programmatically). All new email nodes carry `appendAttribution: false` (no n8n footer), the proven SMTP credential, and evaluated subject expressions.

## 2. Live-validated patterns applied everywhere

1. Secret gate: `$json.headers['x-lead-engine-secret']` vs `$vars.LEAD_ENGINE_SECRET` (was broken `$headers[...]` + `$env`).
2. Webhook v2 body nesting handled via `webhook.body ?? webhook` in all Code nodes and `$json.body.x` in If nodes.
3. Google Sheets update shape = proven v3 form: `columnToMatchOn: lead_id` + explicit `valueToMatchOn` expression + `fieldsUi.values`. Never row_number.
4. Google Sheets append shape = proven `fieldsUi.fieldValues` explicit mapping (replaced unverified `autoMapInputData`).
5. Read topology converted from unvalidated parallel dead-end branches to the proven **sequential read chain** (leads → bookings → config → resolve), referenced by name via `$('Node Name')`.
6. No `URL` constructor in any Code node (booking-link validation uses the regex patch pattern from V4.3).
7. Email failure isolation via `onError: continueErrorOutput`; success AND error outputs converge on Respond nodes that read exclusively via node references.
8. HTML-escaped `_esc_*` copies for all user-controlled fields placed in emails.

## 3. Credentials

Already wired in the JSON (same instance IDs as Lead Intake V4.3):

- Google Sheets OAuth2: id `WKOG2OGDN34LtGmz` ("Google Sheets account") — on every googleSheets node.
- SMTP: id `uRV9Wct3Ugjxu9hk` ("SMTP account") — on every emailSend node.

If an import drops credential refs, reselect these two existing credentials — do not create new ones.

## 4. Google Sheets mappings (exact headers)

- **leads updates (02):** `booked`, `booked_at`, `booking_id`, `status`, `next_followup_at` (cleared), `updated_at`
- **leads updates (04):** `status`, `updated_at`, `notes`, `next_followup_at` (cleared only when terminal), `booked`, `booked_at`, `booking_id` (preserved unless changed/supplied)
- **leads updates (05):** `followup_count`, `last_contact_at`, `next_followup_at`, `status`, `updated_at`
- **leads update (03):** `next_followup_at`, `updated_at`
- **leads append (03):** full canonical set incl. correct spellings `idempotency_key`, `last_customer_response_at`
- **bookings append (02):** `booking_id`, `lead_id`, `business_id`, `created_at`, `booking_at`, `source`, `status`
- **status_updates append (03, 04):** `update_id`, `created_at`, `lead_id`, `business_id`, `old_status`, `new_status`, `updated_by`, `notes`

### ⚠ Header conflict found (action needed)

Lead Intake V4.3's own Append node writes two **misspelled** field names (`idempontency_key`, `last_customer_resonse_at`), and its Update Booking Link schema shows those typo columns exist in the live leads tab. New appends in 03 target the **correct** spellings per the authoritative column list. Consequences:

- Duplicate near-empty typo columns may exist in the leads tab — harmless, optionally delete them manually.
- Cross-workflow dedup by `idempotency_key` in WF01 will not match rows created by WF03 if values land under different columns; phone/email dedup still covers this.

Recommendation: verify the leads tab headers once; keep the brief's exact list. WF01 itself was left untouched per instructions.

### Sheet-name resolution

Tabs with known gids are pinned (`leads` gid=1327828692, `business_config` gid=0). `bookings` and `status_updates` gids are unknown locally, so their nodes use RL mode `"name"` with value `"bookings"`/`"status_updates"`. If your n8n build rejects name-mode on import, just re-pick the tab from each dropdown once (2 nodes in 02… actually 1 in 02, 2 in 03, 1 in 04).

## 5. Key expressions used

- Match value (02): `={{ ($('Booking Status Webhook').first().json.body || $('Booking Status Webhook').first().json).lead_id || $('Prep Lead Booked Update').first().json.lead_id }}`
- Match value (04): same pattern against `$('Status Update Webhook')`.
- Owner subjects (evaluated): `={{ 'Booking confirmed — ' + …business_name + ' — Lead ' + …lead_id }}` (02); equivalent for 03/04/05.
- Idempotent replay response reads `$('Resolve Lead & Booking')…booking.booking_id`.
- Terminal flag (04): `['booked','lost','closed','no_response'].indexOf(newStatus) !== -1`.

## 6. Behavior changes vs imported versions

| Workflow | Change |
|---|---|
| 02 | Booking-idempotency added (Read Existing Bookings → replay returns safe 200, no second bookings row, lead untouched); owner email gated on owner_email **AND** from_email; missing reference → 400; lead not found → 404 with no writes; success body `{status:'booked', lead_id, booking_id, code:200}` |
| 03 | **Fixed inverted Is Duplicate? polarity** (would have re-appended duplicates); auto customer email requires strict boolean `auto_customer_email=TRUE` + lead email + from_email; deterministic callback idempotency key; tenant-scoped dedup order aligned with WF01 |
| 04 | `no_response` now terminal (clears next_followup_at); `booked` transition sets booked=TRUE without fabricating booked_at/booking_id (only request-supplied values used); non-terminal transitions preserve the existing schedule instead of wiping it |
| 05 | Per-candidate send isolation: failed sends route to a dead-end sink — followup_count/next_followup_at/status untouched for that lead (retry next hour); max-reached path sets status=no_response + clears schedule; email validity regex gate |

## 7. Validation executed (static)

- All five files parse as JSON ✅
- Node types: zero invented types; zero obsolete `sendEmail` types ✅
- No duplicate node names or IDs ✅
- No broken connections; only trigger nodes lack inbound links ✅
- No placeholder doc-ID/credential strings ✅
- No literal `{{ }}` in non-expression fields; subjects/match-values are proper `=` expressions ✅
- `$headers[` / `$env.LEAD_ENGINE_SECRET` eliminated from 02–05 ✅

## 8. Remaining manual configuration

1. Import/re-import 02–05 in n8n Cloud; confirm credentials resolved (Section 3).
2. Reselect `bookings` / `status_updates` tabs if name-mode unsupported (Section 4).
3. Assign **06 – Error Handler** as error workflow on 02–05 (Settings → Error workflow) — still unset in all files.
4. Activate 02–05; webhook paths unchanged (`/booking-status`, `/manual-callback`, `/status-update`).
5. Optional cleanup: remove typo columns `idempontency_key` / `last_customer_resonse_at` from leads tab if present.

## 9. Test execution status

Controlled tests T1–T4 and T8 are scripted in `run-live-tests.ps1` (webhook-driven). T5–T7 require seeding/backdating a lead row plus a manual execution of Workflow 05 — the script prints exact prep steps and pass criteria.

**Executed so far: none live** — awaiting the n8n instance base URL. No results are claimed beyond static validation above.
