# Lead Recovery Engine — Execution Findings (Pilots 1–3)

**Date:** 2026-09-27
**Scope:** `workflows/lead-recovery-engine/01–07` (current working-tree JSON)
**Method:** observational harness (`measurement/`) executes the real workflow JSON —
real Code-node `jsCode` via `new Function`, an n8n expression evaluator
(`$json`, `$()`, `$execution`, `{{ }}`), and an in-memory sheet store whose headers are
copied verbatim from the live tab contracts.
**No production workflow JSON was modified to produce these findings.**

## Resolution log

| ID | Status | Note |
| --- | --- | --- |
| **F1** | **RESOLVED 2026-09-27** | One-line fix in `Prepare Email Content`. Covered by 9 tests in `tests/f1-f5-regressions.test.js`. |
| **F5** | **RESOLVED 2026-09-27** | One-line fix in `Build Status Update Record`. Covered by 5 tests in the same file. |
| **F9** | **RESOLVED 2026-09-27** | `Resolve Config & Normalize Lead` now matches `business_id` like WF04 does. Covered by 6 tests. |
| **F10** | **RESOLVED 2026-09-27** | Both email-error appends now map all ten `errors` columns. Covered by 5 tests. |
| F2 | open | out of scope |
| F3 | open | out of scope |
| F4 | open | out of scope; still needs one live confirmation |
| F6 | open | **partly self-resolved** — see F1 note below |
| F7 | open | out of scope |
| F8 | open | out of scope |
| **F11** | **RESOLVED 2026-09-28** | `error_message` is now sanitised in both email-error builders. Covered by 6 tests. Two residual observations recorded below. |
| **F12** | **RESOLVED 2026-09-28** | `booking_link_sent` now reflects the pre-existing `_bookingLinkPresent` flag. Covered by 4 behavioural + 1 structural test. |

### F1 side effect on F6

F1's fix restores the transient `_esc_*` fields to the item that `Customer Acknowledgment`
renders from, so **WF01's** body no longer renders `undefined` — as a direct consequence of
F1, not as an F6 change. F6 remains open for **WF03 and WF04**, whose email bodies are still
observed full of `undefined` (Journeys C and D).

### Harness fidelity corrections made during the F1/F5 pass

These are harness bugs, not engine bugs. Each was corrected so the observations are trustworthy:

1. **IF and NoOp nodes recorded no output**, so `$('SomeGate')` threw even though n8n resolves
   it. Now the union of both IF branches is recorded. Surfaced because F1 made `Update Booking
   Link` reachable for the first time.
2. **`readSheetName` mis-resolved `sheetName` resource locators** that carry a literal tab name
   with no `cachedResultName` (e.g. `{ value: "errors" }`), producing a phantom tab
   `gid:errors`. Now the `gid:` prefix is applied only to numeric values.
3. **A missing append mapping threw instead of writing a blank row.** n8n's `append` tolerates a
   node with no column mapping and appends empty cells; the harness now models that, which is
   what exposed F10.
4. **A failed email node did not carry n8n's error shape.** The harness set
   `json._emailError = message`, but n8n hands the error branch
   `json.error = { message, name }` — which is what the `Build * Email Error Record` nodes read.
   Without this, every error row recorded the literal string `unknown email error` and the
   `error_message` path was untestable. Surfaced while proving F10.

### F9 and F10 attribution

Both are in `01 - Lead Intake.json` but are independent defects in independent nodes:

| Fix | Node | Change |
| --- | --- | --- |
| F9 | `Resolve Config & Normalize Lead` | one `jsCode` line, config lookup only |
| F10 | `Append Customer Email Error` | added `fieldsUi` mapping |
| F10 | `Append Owner Email Error` | added `fieldsUi` mapping |

F9 touches no Sheets node, F10 touches no Code node. Reverting either leaves the other intact.

### F11 and F12 attribution

Also both in `01 - Lead Intake.json`, and likewise independent:

| Fix | Node | Change |
| --- | --- | --- |
| F11 | `Build Customer Email Error Record` | `error_message` routed through the node's existing `sanitize()` |
| F11 | `Build Owner Email Error Record` | `error_message` routed through the node's existing `sanitize()` |
| F12 | `Update Booking Link` | `columns.value.booking_link_sent` literal `"TRUE"` → conditional expression |

F11 touches only two `jsCode` strings; F12 touches only one sheet-column expression. F11's fix
reuses the `SECRET_RE` / `sanitize()` pair that was already present in both builders, so no new
mechanism and no new node was introduced. Reverting either fix leaves the other intact.

### F11 residual observations (deliberately not changed)

The reported defect was the `errors` sheet copying provider messages verbatim. That is closed for
WF01's two builders. Two adjacent exposures remain and were left alone to keep this pass scoped:

1. **Bearer tokens are only partially redacted.** `SECRET_RE` captures one token after `:` or `=`,
   so `Authorization: Bearer eyJhbGciOi…` redacts only `Bearer` and leaves the JWT itself in
   `error_message`. Fixing this means changing the shared regex in both builders, which would also
   change every other field `sanitize()` already guards.
2. **The same defect exists in `06 - Error Handler.json`.** Its `Build & Sanitize Error Record`
   node writes `error_message: errorMessage` with no sanitisation at all, into the same `errors`
   tab. WF06 is out of scope for an WF01 pass, so it is untouched. It is now the largest known
   secret-leak path in the engine and should be the next fix of this shape.

### F12 contract

`Prepare Email Content` already computed `safeBookingLink` and the boolean `_bookingLinkPresent`,
but nothing consumed the flag: `Update Booking Link` wrote the literal string `"TRUE"` on every
customer-email success. The fix reads the existing flag, so a link is written only when one was
actually validated and sent.

The intended behaviour, now asserted by tests:

- A valid link still records `booking_link_sent="TRUE"`.
- A tenant with no configured link records `booking_link_sent="false"`.
- The customer acknowledgment is **not** suppressed by the missing link.
- No error row is created by the missing link.
- The email body already omitted the booking CTA when the link was empty, so no template change
  was needed.

Verified end to end in Journey I: the linked tenant stays `"TRUE"` and the unlinked tenant moves
`"TRUE"` → `"false"`, with that the only differing line in the whole journey set.


## Confidence labels

| Label | Meaning |
| --- | --- |
| **CONFIRMED** | Reproduced deterministically by the harness. The behaviour follows from the workflow JSON itself. |
| **HARNESS-DEPENDENT** | Reproduced, but rests on one n8n runtime assumption that cannot be verified offline (noted per finding). |

---

## F1 — Lead intake never sends any email, and never marks the booking link sent

**Severity: critical · CONFIRMED**

`01 - Lead Intake.json`, node `Prepare Email Content`:

```js
const lead = $input.first().json;   // <-- output of "Update Lead Next Follow-up"
return [{ json: lead }];
```

`Prepare Email Content` is an identity passthrough whose apparent purpose is to re-attach the
transient tenant/escaping fields produced by `Resolve Config & Normalize Lead`. But its input is
the output of `Update Lead Next Follow-up`, a Google Sheets **update** node, which emits the
**sheet row** — not the Code node's item. Every transient field is therefore gone:

- `_fromEmailPresent` → `undefined`
- `owner_email`, `from_email`, `reply_to_email` → not columns on `leads`, so absent
- `_esc_name`, `_esc_business_name`, `_esc_booking_link`, … → never persisted

Downstream effects, all observed:

1. `Customer Email Present?` tests `_fromEmailPresent` → falsy → `Skip Customer Email`.
2. `Owner Email Present?` tests the absent `owner_email` → falsy → `Skip Owner Email`.
3. `Update Booking Link` hangs off `Customer Acknowledgment`, so it never runs →
   `booking_link_sent` stays `"false"`.
4. `owner_notified` is never written.

Journey A evidence: `emails: []`, `booking_link_sent: "false"`, `owner_notified: ""`.

**Measurement impact:** the engine currently produces **zero** evidence of outbound contact at
intake, and never delivers the booking link. Any "time to first contact" or "booking link
delivery" metric is unsupportable.

**Fix:** read from the Code node, not the Sheets node.

```js
const lead = $('Compute Next Follow-up').first().json;
return [{ json: lead }];
```

---

## F2 — Duplicate intake responses return a lead_id that was never persisted

**Severity: high · CONFIRMED**

`Resolve Config & Normalize Lead` mints the id *before* duplicate detection:

```js
const leadId = body.lead_id || rid('lead');
```

`Check Duplicate` then flags `_isDuplicate: true`, and the `Is Duplicate?` branch goes to
`Respond 200 Duplicate Accepted`, which serialises `$json.lead_id` — the freshly minted,
never-appended id.

Journey F evidence (three submissions, one real lead row):

| # | Detected as | Response `lead_id` | Persisted? |
| --- | --- | --- | --- |
| 1 | — (created) | `lead_…_5nz8tbid` | yes |
| 2 | `idempotency_key` | `lead_…_wc2awdre` | **no** |
| 3 | `source_id` | `lead_…_yljfwgm1` | **no** |

Duplicate *detection* is correct — `idempotency_key` and `source_id` both matched, scoped to
`business_id`. The defect is the identifier handed back to the caller.

**Measurement impact:** a client that trusts the duplicate response's `lead_id` holds a
dangling reference that will 404 on any follow-up call.

**Fix:** resolve and return the *existing* row's `lead_id` on the duplicate branch.

---

## F3 — Booking-status requests for an unknown lead get no response at all

**Severity: high · CONFIRMED**

`02 - Booking Status.json` resolves the lead from `Read Existing Leads`. For a lead that does
not exist, the read returns **zero items**, so the downstream `Resolve Lead & Booking` Code node
never executes, the 404 branch is unreachable, and the webhook is left unanswered.

Journey G evidence: `unknownLeadResponse` → `404` (WF07, correct), but
`unknownLeadBooking` → `null` (WF02, silent).

**Measurement impact:** unknown-lead booking traffic is invisible — no response node fires, so
no error row, no log, no timing. The engine cannot distinguish "no such lead" from "request
never arrived".

**Fix:** the read must be followed by a Code node that tolerates zero input (e.g. read the
`lead_id` from the webhook rather than from the sheet output), or the IF must be fed from a
node that always emits one item.

---

## F4 — The first-ever booking cannot be processed while the bookings tab is empty

**Severity: medium · HARNESS-DEPENDENT**

Same mechanism as F3, in the other direction. `02 - Booking Status.json` gates on
`Read Existing Bookings`. On a fresh or fully-booked-out tab that read returns zero items and
the branch halts before the booking is written.

Journey A evidence: `bookingResponse: null`, `bookings: []`.

**Harness assumption:** n8n does not run downstream nodes when a node emits zero items. The
harness models this faithfully (`emptyOutputHaltsBranch: true`) and exposes it as an explicit
switch so both worlds can be observed. This assumption is also what makes F3 true, and it is
the single highest-value item to confirm with one live call against the real instance.

**Measurement impact:** the booking step can be a silent no-op. Whether this fires in
production depends entirely on whether the live `bookings` tab is non-empty.

---

## F5 — The status-change audit trail records no statuses

**Severity: critical · CONFIRMED**

`04 - Status Update.json` chain:

```
Validate Booking Data → Prepare Updated Lead → Update Lead (sheets update)
  → Build Status Update Record → Append Status Update
```

`Prepare Updated Lead` correctly attaches `old_status`, `new_status`, `updated_by`. Then
`Update Lead` overwrites the item with the sheet row, and those three fields are not columns —
so they are lost. `Build Status Update Record` reads `$input.first().json`:

```js
old_status: item.old_status,   // undefined
new_status: item.new_status,   // undefined
updated_by: item.updated_by,   // undefined
```

Journey D evidence — the appended row:

```json
{
  "update_id": "upd_1788282000000_uttpm5",
  "lead_id": "lead_1788253200000_h8flfj5m",
  "business_id": "biz_lonestar_hvac",
  "old_status": "",
  "new_status": "",
  "updated_by": "",
  "notes": "Went with a competitor."
}
```

`notes` survived because it *is* a real column written by the update — which is exactly why the
defect is easy to miss: the row looks populated.

**Measurement impact:** `status_updates` is the only place a lifecycle transition is recorded.
With `old_status`/`new_status` blank, the engine cannot reconstruct any journey. This alone
blocks the measurement layer.

**Fix:** read from the node reference, not `$input`:

```js
const item = $('Prepare Updated Lead').first().json;
```

---

## F6 — Customer-facing email bodies render `undefined`

**Severity: high · CONFIRMED (WF04) / HARNESS-DEPENDENT (WF01, WF03)**

A consistent pattern across the three inbound-capture workflows: the email node's
`fromEmail` / `toEmail` / `subject` were correctly rewired to explicit node references, but
the `html` body was left on `$json`, including the transient `_esc_*` fields.

| Workflow | Node | Header source | Body source | Result |
| --- | --- | --- | --- | --- |
| `01` | `Customer Acknowledgment` | `$json.*` | `$json._esc_*` | masked by F1 (never sends) |
| `03` | `Callback Customer Email` | `$('Resolve Config & Normalize Callback')` | `$json._esc_*` | `_esc_name`, `_esc_business_name`, `_esc_booking_link` → `undefined` |
| `04` | `Owner Status Notification` | `$('Prepare Updated Lead')` | `$json._esc_*` | every field → `undefined` |

Journey D observed body, verbatim:

```html
<h3>Lead status updated</h3><p><b>undefined</b></p>
<table cellpadding="4">
  <tr><td><b>Lead ID</b></td><td>undefined</td></tr>
  <tr><td><b>Name</b></td><td>undefined</td></tr>
  <tr><td><b>Old status</b></td><td>undefined</td></tr>
  <tr><td><b>New status</b></td><td>undefined</td></tr>
  <tr><td><b>Updated by</b></td><td>undefined</td></tr>
</table><p>Notes: undefined</p>
```

The subject line of that same email rendered correctly (`Lead status updated: lost — Lone Star
HVAC & Cooling — Lead lead_…`), which is precisely the signature of a partial fix.

WF01 and WF03 are marked harness-dependent only because F1 prevents WF01 from reaching the send
at all; the same `$json._esc_*` pattern is present in the JSON and will bite as soon as F1 is
fixed.

**Measurement impact:** outbound contact either does not happen (WF01) or reaches the customer
with literal `undefined` in the body (WF03, WF04).

---

## F7 — Customer responses do not bump `updated_at`

**Severity: low · CONFIRMED**

`07 - Customer Response.json`, `Update Lead Response` writes `lead_id`,
`next_followup_at`, `last_contact_at`, `last_customer_response_at` — but not `updated_at`.

Journey E evidence: `last_customer_response_at` = `2026-09-01T14:00:00.000Z` while
`updated_at` remains the intake value `2026-09-01T09:00:00.000Z`.

**Measurement impact:** minor for lifecycle reconstruction (the response timestamp is correct),
but any staleness or "last touched" heuristic that trusts `updated_at` will mis-rank leads.

---

## F8 — Rejected and duplicate requests leave no trace anywhere

**Severity: high · CONFIRMED**

Across all five tabs (`leads`, `bookings`, `status_updates`, `errors`, `business_config`),
rejected and duplicate traffic is completely unrecorded.

Journey G (`errors: []` despite nine rejected requests):

| Case | Status | Node | Row written |
| --- | --- | --- | --- |
| Wrong ingress secret | 401 | `Respond 401 Invalid Secret` | none |
| Missing `business_id` | 400 | `Respond 400 Missing business_id` | none |
| Unknown business | 403 | `Respond 403 Invalid Business` | none |
| Inactive business | 403 | `Respond 403 Invalid Business` | none |
| Unknown lead (booking) | *(none)* | — | none |
| Unknown lead (response) | 404 | `Respond 404` | none |
| Invalid status | 422 | `Respond 422 Invalid Status` | none |
| Duplicate (×2) | 200 | `Respond 200 Duplicate Accepted` | none |

**Measurement impact:** conversion, rejection and duplicate rates are all unmeasurable. The
`errors` tab is only populated by explicit catch branches (WF01's email failures), not by
validation rejections.

---

## What works

Recorded so the fixes are not over-broad.

- **Journey A** — intake normalises, scores (80/100), classifies urgency, generates a validated
  HTTPS booking link with `lead_id` attribution, and persists a well-formed lead row.
- **Journey B** — 4 sweeps at T+24/48/72/96h. The first three send follow-ups and advance
  `next_followup_at`; the lead reaches `no_response` at the configured maximum; the 4th sweep
  correctly selects zero candidates. The sweeper's scheduling and stop condition are sound.
- **Journey C** — callback capture persists the lead and both `status_updates` and `errors` stay
  empty, as intended.
- **Journey D** — status validation is correct: `new_status` contract enforced (422 with the
  allowed set), terminal-status guard correct (409 `terminal_status` on `lost → qualified`),
  `notes` persisted.
- **Journey E** — customer response sets `last_customer_response_at`, clears
  `next_followup_at` (follow-up correctly suppressed), and returns
  `followup_suppressed: true`.
- **Journey F** — duplicate detection works on both `idempotency_key` and `source_id`, correctly
  tenant-scoped. Only the returned identifier is wrong (F2).
- **Journey G** — 401/400/403/404/422 rejection paths are all reachable and correctly shaped,
  except the booking 404 (F3).

---

## F9 — Lead intake only ever resolved the FIRST business_config row

**Severity: critical · RESOLVED 2026-09-27**

Surfaced while testing F1: the owner/from-email gate tests could not reach a second tenant.

`01 - Lead Intake.json`, `Get Business Config` is an unfiltered `read` of the whole
`business_config` tab, so it emits one item per tenant. `Resolve Config & Normalize Lead` then
takes the first:

```js
const configJson = $('Get Business Config').first()?.json ?? null;
const config = configJson && String(configJson.business_id || '').trim() === businessId
  ? configJson : null;
```

For any tenant that is not row 1, `config` is `null` → `_active` false →
`Business Valid & Active?` false → `403 business_invalid_or_inactive`.

Journey I is the direct proof. It submits the **same** `source_id` and phone to two tenants to
prove idempotency stays tenant-scoped:

| Submission | `business_id` | Result |
| --- | --- | --- |
| 1 | `biz_lonestar_hvac` (row 1) | `200 created` |
| 2 | a different tenant | **`403 Invalid Business`** |

The second tenant never reaches the duplicate check — it is turned away at the door.

This is very likely an oversight rather than a design choice, because `04 - Status Update.json`
resolves the same tab correctly:

```js
const cfgRow = configs.find((c) => String(c.json.business_id || '').trim() === bid) || null;
```

**Measurement impact:** in production the engine is effectively single-tenant. Every tenant
except the first row of `business_config` is invisible, and the 403 is recorded nowhere (F8).
Any multi-tenant KPI would be computed over one tenant while appearing to cover all of them.

**Fix applied:** `01 - Lead Intake.json`, node `Resolve Config & Normalize Lead` now uses the
same lookup `04 - Status Update.json` already used correctly:

```js
- const configJson = $('Get Business Config').first()?.json ?? null;
- const config = configJson && String(configJson.business_id||'').trim() === businessId ? configJson : null;
+ const configs = $('Get Business Config').all();
+ const config = configs.find((c) => String(c.json.business_id || '').trim() === businessId)?.json ?? null;
```

`_configFound`, `_active`, both IF gates and every 403 path are untouched, so authorization is
unchanged — the only difference is that the row is now selected by id rather than by position.
Journey I is the direct proof: the second tenant went from `403 Invalid Business` to
`200 created`, and all eight other journeys are byte-identical after normalising generated ids.

---

## F10 — Both intake email-error appends discarded the entire error record

**Severity: high · RESOLVED 2026-09-27**

Surfaced while testing F1: the customer-email failure path became reachable for the first time.

`01 - Lead Intake.json` contains `Build Customer Email Error Record` and
`Build Owner Email Error Record`, which carefully assemble a complete, sanitised record
(`error_id`, `created_at`, `workflow`, `node`, `business_id`, `lead_id`, `error_message`,
`execution_id`, `payload`, `resolved`) including a secret-redaction pass. Both then feed an
append node whose entire `parameters` object is:

```json
{ "operation": "append", "documentId": {…}, "sheetName": {…}, "options": {} }
```

No `fieldsUi`, no `columns`, no `columnToMatchOn`. n8n appends a row of empty cells, so the
whole record is discarded and a blank row lands on `errors`.

Every other append in the engine has a mapping — this is an omission in these two nodes only:

| Node | Mapping |
| --- | --- |
| `01` `Append Customer Email Error` | **none** |
| `01` `Append Owner Email Error` | **none** |
| `01` `Append Lead` | `fieldsUi.fieldValues` (26 columns) |
| `02` `Append Booking` | `fieldsUi` |
| `02` `Append Status Update` | `fieldsUi` |
| `03` `Log Status (new)` | `fieldsUi` |
| `04` `Append Status Update` | `fieldsUi` |
| `06` `Append Error` | `fieldsUi` |

**Fix applied:** both nodes now declare the same ten-column mapping that
`06 - Error Handler.json :: Append Error` already used, so the record the builders construct is
persisted instead of a blank row:

```json
"fieldsUi": { "fieldValues": [
  { "fieldId": "error_id",      "fieldValue": "={{ $json.error_id }}" },
  { "fieldId": "created_at",   "fieldValue": "={{ $json.created_at }}" },
  { "fieldId": "workflow",     "fieldValue": "={{ $json.workflow }}" },
  { "fieldId": "node",         "fieldValue": "={{ $json.node }}" },
  { "fieldId": "business_id",  "fieldValue": "={{ $json.business_id }}" },
  { "fieldId": "lead_id",      "fieldValue": "={{ $json.lead_id }}" },
  { "fieldId": "error_message","fieldValue": "={{ $json.error_message }}" },
  { "fieldId": "execution_id", "fieldValue": "={{ $json.execution_id }}" },
  { "fieldId": "payload",      "fieldValue": "={{ $json.payload }}" },
  { "fieldId": "resolved",     "fieldValue": "={{ $json.resolved }}" }
] }
```

No builder, `sanitize()`, branch, IF gate or email node was changed — only the persistence of
the record that already existed. The deliberately-failing characterisation test has been
replaced by five tests asserting the populated row, the redaction guarantee, the unchanged
success path and the fail-safe behaviour.

**Measurement impact:** every email-send failure produces a blank `errors` row. The `errors` tab
cannot be trusted as a failure ledger, and this compounds F8.

---

## F11 — `error_message` is not sanitised, so provider secrets can leak into `errors`

**Severity: high · CONFIRMED (not fixed)**

Surfaced while proving F10: the first time a real provider message reached the `errors` sheet.

Both builders in `01 - Lead Intake.json` define a `sanitize()` helper that redacts
`secret|token|password|api_key|authorization|bearer` and apply it to `business_id`, `lead_id` and
`payload`. They do **not** apply it to `error_message`:

```js
error_message: ('customer_email_failed: ' + msg).slice(0, 2000),   // msg is the raw provider message
```

SMTP and provider auth failures routinely echo credentials in that text. Injecting
`535 authentication failed api_key=LEAKED_API_KEY_123` produces an `errors` row containing
`LEAKED_API_KEY_123` verbatim. Note that before the harness fix described above, this path was
invisible: every row recorded the literal string `unknown email error`, because the harness
never gave the builders the n8n error shape they read. F10 and the harness fix together exposed
it.

**Measurement impact:** `errors.payload` is safe; `errors.error_message` is not. Any tooling
that forwards or displays `error_message` may expose credentials.

**Status: RESOLVED 2026-09-28.** Both builders now pass `error_message` through the
`sanitize()` helper they already defined, before the 2000-character slice, so nothing is
truncated into a secret. The characterisation test was **replaced** by six regression tests that
assert the opposite — secrets must not survive — so the original `F11 CHARACTERISATION` test no
longer exists. See "F11 residual observations" above for the two exposures that remain open.

---

## F12 — Tenants with no configured `booking_link` are still marked `booking_link_sent=TRUE`

**Severity: medium · RESOLVED 2026-09-28**

Surfaced while proving F9: non-row-1 tenants became reachable, and most of the seeded tenants
have an empty `booking_link`.

`01 - Lead Intake.json` computes the link and marks it sent unconditionally:

```
Prepare Email Content -> Customer Acknowledgment -> Update Booking Link
```

`Update Booking Link` writes both `booking_link` and `booking_link_sent` with no guard on an
empty link. For `biz_hillcountry_plumbing` (whose `booking_link` is `''`) the lead ends up as:

```json
{ "booking_link": "", "booking_link_sent": "TRUE" }
```

and the customer acknowledgment body contains no booking link at all. Journey I shows this on
the second tenant.

**Measurement impact:** `booking_link_sent` was a false positive for any tenant without a
configured link, so "leads that received their booking link" was an over-count.

**Status: RESOLVED 2026-09-28.** `Update Booking Link` now writes
`booking_link_sent` from the `_bookingLinkPresent` flag that `Prepare Email Content` was already
computing, instead of the literal `"TRUE"`. The column is now truthful for every tenant: `"TRUE"`
means a validated link was sent, `"false"` means no link was configured. The customer
acknowledgment is still sent either way, and the existing body already omitted the CTA when the
link was empty, so no other behaviour moved. Journey I is the regression witness.

---

## Fix order

F1, F5, F9, F10, F11 and F12 are done. Revised order for what remains:

| # | Finding | Why |
| --- | --- | --- |
| 1 | **F11 residual — WF06** | `06 - Error Handler.json` still writes `error_message` unsanitised into the same `errors` tab. Now the largest known secret-leak path. |
| 2 | F6 | WF03 and WF04 bodies still render `undefined` at customers and owners. |
| 3 | F3 | Silent webhook hangs on unknown-lead booking traffic. |
| 4 | F2 | Dangling `lead_id` handed to API callers. |
| 5 | F8 | Needs a schema decision (`measurement_events`), not a code fix. |
| 6 | F4 | Confirm n8n zero-item semantics live; fix only if the halt is real. |
| 7 | F7 | Cosmetic staleness signal. |

## Before the measurement layer is built

The two structural prerequisites are met. F5 means `status_updates` is a real lifecycle audit
trail, F1 means intake produces real outbound evidence and delivers the booking link, F9 means
the engine actually serves more than one tenant, F10 means the `errors` tab is finally a
usable failure ledger, and F11/F12 mean the ledger is safe to read and the booking column is
trustworthy.

Two things must be accounted for in the schema before trusting any metric:

- **F11 residual** — `errors.error_message` is sanitised in WF01, but WF06 still writes it raw and
  `Authorization: Bearer <jwt>` is only partially redacted. It should not be copied wholesale into
  a measurement table until WF06 is fixed and the bearer pattern is closed.
- **F8** — the original gap list (rejected intake, duplicate attempts, response attempts,
  follow-up failures, candidate-selection counts, rejected transitions, discarded response
  bodies, sweep run records) is unchanged, and F8 confirms those gaps are total, not partial.
  F10 improved the *email-failure* slice of it; it did not close it.

F12 no longer constrains the schema: `booking_link_sent` is now a truthful flag for every tenant.

Recommended next step: fix the WF06 sanitisation gap, then re-open the `measurement_events`
schema decision against a baseline that is finally trustworthy.
