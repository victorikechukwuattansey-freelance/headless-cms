# Lead Recovery Engine — Execution Findings (Pilots 1–3)

**Date:** 2026-09-27
**Updated:** 2026-10-01 — F17 is **RESOLVED** by `a06e1ae` and F15 is **RESOLVED** by `fd75d62`;
only the new F18 remains open. `af302e8`'s subject claimed to mark F15 resolved, but its body never
landed that change, so the record is corrected here.
Retained history: reconciled against committed production at `5c1a854`, where F11, F12, F13 and F14
were resolved and F15, F16 and F17 were open. F16 and F17 were added from
`measurement/EVIDENCE_MATRIX.md` (`c0f8e5b`, a docs-only commit); production JSON is unchanged at
`5c1a854`. Later the same day, F8 was reconciled against that matrix: the general
`measurement_events` question is **closed**, and F8's residual production behaviour stays open.
**Scope:** `workflows/lead-recovery-engine/01–07` (committed JSON at `5c1a854`)
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
| F8 | **partly closed 2026-09-28** | Split into two questions. **(1) The general `measurement_events` event store is CLOSED — not required for the pilot**, per `measurement/EVIDENCE_MATRIX.md` (`c0f8e5b`): three of the four evidence gaps are better served by writing to tables that already exist, and the fourth is small and single-purpose. **(2) The underlying production behaviour — rejected and duplicate requests writing no rows — remains OPEN** in its own right and is no longer blocked on that decision. F10 improved the *email-failure* slice only. |
| **F11** | **RESOLVED 2026-09-28** | `error_message` is now sanitised in both email-error builders. Covered by 6 tests. Its two residuals were closed as F13 and F14 in `5c1a854`; the quoted-JSON case became F15. |
| **F12** | **RESOLVED 2026-09-28** | `booking_link_sent` now reflects the pre-existing `_bookingLinkPresent` flag. Covered by 4 behavioural + 1 structural test. |
| **F13** | **RESOLVED 2026-09-28** | `error_message` is now sanitised in `06 - Error Handler.json`, and its string branch redacts like its object branch. Commit `5c1a854`. |
| **F14** | **RESOLVED 2026-09-28** | The shared `SECRET_RE` now consumes a bare or header-style Bearer credential whole, in all three consumers. Commit `5c1a854`. |
| **F15** | **RESOLVED 2026-09-30** | Quoted and escaped secret forms are now redacted across all sanitizer consumers. Commit `fd75d62`. The text previously recorded here ("still not redacted, deliberately excluded from `5c1a854`") described the state *before* `fd75d62` and was never updated. |
| **F16** | **RESOLVED 2026-09-30** | WF05's follow-up failure path now records the failure, counts it in a new `followup_fail_count` field, and retires the lead as `failed` at a ceiling of `Math.max(24, Number(config.max_followups || 3) * 4)`. Commit `0e30562`. One consequence was surfaced rather than fixed, as F18. |
| **F17** | **RESOLVED 2026-10-01** | WF05 now records its terminal transition in `status_updates`. A shared builder plus append was added, fed by both terminal branches, with the pre-transition status hoisted in the Code nodes that overwrite it. Commit `a06e1ae`. |
| **F18** | **open** | `followup_fail_count` uses total-accumulation, not consecutive-failure semantics; a lead with intermittent failures can be retired despite successful contacts. Classification: semantic edge case introduced by the F16 fix. Severity: not yet assigned. |

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

### F11 residual observations (both closed in `5c1a854`)

The reported defect was the `errors` sheet copying provider messages verbatim. That is closed for
WF01's two builders. Two adjacent exposures were left open by the F11 pass to keep it scoped. Both
were subsequently closed in `5c1a854`; a third, separate exposure is tracked as F15.

1. **Bearer tokens were only partially redacted — now F14 (RESOLVED).** `SECRET_RE` captured one
   token after `:` or `=`, so `Authorization: Bearer eyJhbGciOi…` redacted only `Bearer` and left
   the JWT itself in `error_message`.
2. **The same defect existed in `06 - Error Handler.json` — now F13 (RESOLVED).** Its
   `Build & Sanitize Error Record` node wrote `error_message: errorMessage` with no sanitisation at
   all, into the same `errors` tab. It was the largest known secret-leak path in the engine at that
   point.
3. **Quoted JSON values are still unredacted — now F15 (RESOLVED in `fd75d62`).** Not a residual of
   F11: it is a different root cause in the same shared regex, and it survived the F11, F13 and F14
   fixes. It was closed later, in `fd75d62`. See the F15 section below.

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

### F13 and F14 attribution

Both landed in `5c1a854`, across two files, and are independent of each other:

| Fix | Node | Change |
| --- | --- | --- |
| F13 | `06` `Build & Sanitize Error Record` | `error_message` routed through that node's own `sanitize()` |
| F13 | `06` `Build & Sanitize Error Record` | string branch returns `String(v).replace(SECRET_RE, redactSecret)` instead of `String(v)` |
| F14 | `01` `Build Customer Email Error Record` | `SECRET_RE` + `redactSecret` replaced with the shared two-alternative form |
| F14 | `01` `Build Owner Email Error Record` | same replacement |
| F14 | `06` `Build & Sanitize Error Record` | same replacement |

The committed regex, identical byte-for-byte in all three consumers:

```js
const SECRET_RE = /(bearer)(\s+)([^,}"'\s]+)|(secret|token|password|api[_ -]?key|authorization|bearer)(["']?\s*[:=]\s*)((?:bearer\s+)?[^,}"'\s]+)/gi;
const redactSecret = (m, bearer, ws, token, keyword, sep) =>
  (bearer ? bearer + ws + '[REDACTED]' : keyword + sep + '[REDACTED]');
```

The first alternative is new and is what F14 needed: it matches a bare `Bearer <token>` on its own,
where the old keyword-then-separator form could only reach the word `Bearer` and stop. The second
alternative is the pre-existing keyword form, with `bearer\s+` folded into the value so a
keyword-prefixed credential is consumed whole. The keyword list is unchanged, so no field that
`sanitize()` already guarded lost coverage. The three consumers are byte-identical by construction,
so the three behavioural tests for F14 run the same logic in WF01 (twice) and WF06.

## Status summary

Restates the resolution log above for `a06e1ae`; the log remains the source of truth.

**Resolved — 11 findings, no further work claimed:** F1, F5, F9, F10, F11, F12, F13, F14, F15, F16,
F17.

**Open — 7 findings, carried forward.** The second column is the reason each one is still open, so a
deliberately deferred item is not read as an active regression.

| ID | Why still open | Deferred? |
| --- | --- | --- |
| F2 | Duplicate branch returns an id that was never persisted | yes — out of scope |
| F3 | Unknown-lead booking traffic gets no response | yes — out of scope |
| F4 | Empty `bookings` tab halts the first booking | yes — needs one live confirmation of n8n zero-item semantics |
| F6 | WF03/WF04 bodies still render `undefined` | partly — WF01 closed as a consequence of F1 |
| F7 | `Update Lead Response` does not bump `updated_at` | yes — out of scope |
| F8 | Rejected and duplicate traffic still writes no rows anywhere | **partly** — the `measurement_events` question beneath it is **closed**; the behaviour itself is still unfixed |
| F18 | `followup_fail_count` accumulates total failures, not a consecutive streak | **no — semantic edge case, and a fix would touch the success path** |

**Tracked follow-up — the sanitize block now has five consumers and no single test spans all five.**
The block is byte-identical everywhere (one hash, `d7ffc93db65e5c0c…`, 1509 chars, 23 lines), but
coverage is split: the F14 test asserts WF01 ×2 + WF06, and the F17 test asserts WF05 ×2 against a
pinned hash. Nothing asserts all five at once, so a sixth consumer could be added with a divergent
block and both tests would still pass. A single all-five byte-identity test is **not yet written**; see
the F15 resolution for the full statement. This is a coverage gap, not a known defect — the block is
identical today.

**`measurement_events` — CLOSED as a requirement, and never implemented.** The general
event store contemplated by F8 is **not required for the pilot**: `measurement/EVIDENCE_MATRIX.md`
(`c0f8e5b`) found that the four evidence gaps are served by existing tabs and small
purpose-specific records, and recommended against a general-purpose log. No `measurement_events`
table, node or column exists in `01–07`, at `5c1a854` or at any later commit. Nothing in this
document created one, and closing the question did not authorise one.

**Scope of that closure — read before treating it as "no new schema".** The matrix recommended
**four** instrumentation items, and the closed decision covered only the general event store. Two of
the four reuse tabs that already exist: `errors` for WF02–WF05 email failures (F16 delivered WF05's
half), and `status_updates` for the WF05 terminal transition (F17, **RESOLVED** in `a06e1ae`). The
remaining two are **small new schema elements** that stay
open on their own: a **sweep-run record**, and an **ingress record for reject and duplicate branches**
— the latter being the substance of F8's still-open production half. So the closure is "the general
event store is not needed", not "the pilot needs no new schema". Revisit only if an item 1–4 gap
appears that genuinely fits no existing tab.

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

**Scope — two questions, split at `c0f8e5b`.** This finding is now open on its production behaviour
only: the rows above are still not written. The schema question that used to sit underneath it is
**closed** — the general `measurement_events` event store is not required for the pilot, per
`measurement/EVIDENCE_MATRIX.md`. The matrix's remedy for this section is a **small ingress record
for reject and duplicate branches**, which is a separate, much smaller schema element than the event
store and remains open.

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

**Severity: high · RESOLVED 2026-09-28**

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
longer exists. See "F11 residual observations" above for how its two residuals were closed as F13
and F14, and for the one that became F15.

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

## F13 — `06 - Error Handler.json` wrote `error_message` into the `errors` tab unsanitised

**Status: RESOLVED 2026-09-28 · CONFIRMED · commit `5c1a854`**

Severity was not separately triaged for this one; it was closed as a known exposure without a
re-rating pass.

`06 - Error Handler.json`, node `Build & Sanitize Error Record`, applied `sanitize()` to `payload`
but not to the message it built from the n8n error:

```js
// before
error_message: errorMessage.slice(0, 2000),
// where errorMessage = String(executionError.message || triggerError.message || 'unknown error')
```

So the object branch of the same node was redacted while the string branch was copied verbatim, into
the **same `errors` tab** F11 had just closed for WF01, and into the same admin notification. This
was the largest known secret-leak path in the engine at the time of the F11 pass.

**Fix applied:** the message is now sanitised by the node's own `sanitize()`, before truncation:

```js
const errorMessage = sanitize(
  String(
    executionError.message ||
    triggerError.message ||
    'unknown error'
  )
).slice(0, 2000);
```

Order matters and is deliberate: sanitising **before** the slice means a secret cannot be truncated
into safety by having its keyword cut off. The node's own string branch was repaired in the same
commit, because `sanitize()` on a string previously returned the input unchanged:

```js
// before
if (typeof v === 'object') return JSON.stringify(v).replace(SECRET_RE, redactSecret);
return String(v);
// after
if (typeof v === 'object') return JSON.stringify(v).replace(SECRET_RE, redactSecret);
return String(v).replace(SECRET_RE, redactSecret);
```

No branch, IF gate, column or append mapping was changed — only redaction.

---

## F14 — `Authorization: Bearer <jwt>` was only partially redacted

**Status: RESOLVED 2026-09-28 · CONFIRMED · commit `5c1a854`**

Severity was not separately triaged for this one either.

The shared `SECRET_RE` had a single keyword-then-separator alternative, so a header-style credential
matched the keyword `authorization`, consumed the separator `: `, and then stopped at the space:

```
Authorization: Bearer eyJhbGciOi…
             ^^^^^^^^^^ value group matches "Bearer" only; the JWT survives
```

Every bearer credential in the engine, in all three consumers, was therefore redacted to
`Authorization: [REDACTED]` with the token still present.

**Fix applied:** a second leading alternative matches a bare bearer credential wherever it appears,
and the keyword alternative absorbs `bearer\s+` into its own value so a keyword-prefixed credential
is consumed whole. The replacer is branch-aware, so the bare form keeps its `Bearer ` prefix while
the keyword form reproduces keyword + separator:

```js
const SECRET_RE = /(bearer)(\s+)([^,}"'\s]+)|(secret|token|password|api[_ -]?key|authorization|bearer)(["']?\s*[:=]\s*)((?:bearer\s+)?[^,}"'\s]+)/gi;
const redactSecret = (m, bearer, ws, token, keyword, sep) =>
  (bearer ? bearer + ws + '[REDACTED]' : keyword + sep + '[REDACTED]');
```

The keyword list is unchanged, so no field that `sanitize()` already guarded lost coverage. The
regex and replacer are byte-identical in all three consumers, so the F14 tests exercise the same
logic in WF01 (twice) and WF06.

The quote handling in the keyword alternative was **not** changed in this commit. That gap is a
separate root cause and is tracked as F15.

---

## F15 — Quoted JSON secret values are not redacted

**Status: RESOLVED 2026-09-30 (`fd75d62`) · CONFIRMED · severity not yet assigned · fixed after being
intentionally excluded from `5c1a854`**

> The tables and body below describe the defect **as observed before `fd75d62`**. They are retained
> unchanged as the finding's record. The fix and its verification are in the resolution at the end of
> this section.

Surfaced while verifying F14: the F14 tests pass, and a sweep of the same regex over quoted forms
showed the keyword alternative does not fire when the secret value is a quoted JSON value.

These are **not** redacted, even though every keyword involved is already on the list:

| Input | Result |
| --- | --- |
| `{"password":"hunter2"}` | unchanged |
| `{"api_key":"sk_live_abc123"}` | unchanged |
| `{"refresh_token":"rt_9f8e7d6c"}` | unchanged |
| `{"client_secret":"s3cr3t_value"}` | unchanged |
| `"password":"hunter2"` | unchanged |

One quoted form is caught, but incidentally:

| Input | Result | Why |
| --- | --- | --- |
| `{"authorization":"Bearer abc.def.ghi"}` | `{"authorization":"Bearer [REDACTED]"}` | F14's bare-bearer alternative matches `Bearer abc.def.ghi` later in the string; the keyword form still does not fire |

**Root cause.** In the keyword alternative the separator group is `(["']?\s*[:=]\s*)`. Its optional
`["']?` consumes the quote that *opens* the value, and the value class `[^,}"'\s]+` then cannot match
because the cursor sits on a `"`, which the class excludes. Backtracking does not rescue it: leaving
the quote unconsumed would require `[:=]` to match `"`, which it can never do. There is no parse that
reaches the value, so the whole alternative fails and the global scan moves on.

**Affected paths.** The shared `sanitize()` in all three Code nodes. Concretely, the two destinations
F11 and F13 closed for unquoted forms are open again for quoted values:

- `06` `Build & Sanitize Error Record` → `payload: sanitize(err).slice(0, 4000)`. The object branch
  is `JSON.stringify(v).replace(...)`, so the entire n8n error object is serialised first — any
  JSON-quoted secret in a provider body passes through it untouched.
- The same node's `error_message`, when the provider message embeds a JSON fragment.

**Not a regression of F14.** Evaluating the committed regex over the unquoted forms still redacts
them: `password=hunter2`, `api_key=sk_live_abc123`, `Authorization: Bearer abc.def.ghi` and bare
`Bearer abc.def.ghi` all redact. F14 stands; this is a different root cause in the same regex.

**Why it was excluded from `5c1a854`.** Changing the quote handling in the keyword alternative
changes what `sanitize()` redacts for every field it already guards, across all three consumers, and
that is a wider blast radius than the F13/F14 pass warranted. It is recorded here as its own finding
rather than folded into that commit.

**Remediation:** delivered in `fd75d62`. See the resolution below.

### Resolution — F15 (2026-09-30, commit `fd75d62`)

**What changed.** The keyword alternative's separator/value handling was reworked so that quoted and
escaped secret forms redact, rather than only bare ones. The root cause recorded above is exactly what
was fixed: the separator group's optional `["']?` consumed the quote that *opens* the value, leaving
the cursor on a `"` that the value class excludes, so no parse could reach the value. All five
documented cases now redact — `{"password":"hunter2"}` → `{"password":"[REDACTED]"}`, and likewise
`api_key`, `refresh_token`, `client_secret` and the bare `"password":"hunter2"` form. Quote style is
preserved so a redacted JSON body still parses, and ordinary text — including quoted prose — is still
left alone.

**Scope of the fix.**

| File | Change |
| --- | --- |
| `01 - Lead Intake.json` | `Build Customer Email Error Record` and `Build Owner Email Error Record` |
| `06 - Error Handler.json` | `Build & Sanitize Error Record` |
| `measurement/tests/f1-f5-regressions.test.js` | 7 tests added |

**Five consumers, one distinct hash.** F16 and F17 later added two WF05 consumers
(`Build Failed Follow-up Record`, `Build Follow-up Status Record`), so the block now exists in
**five** places — WF01 ×2, WF05 ×2, WF06 ×1 — and all five hash to `d7ffc93db65e5c0c…` (SHA-256
`d7ffc93db65e5c0c6e7ccb4ecd4bb89e9768522d90b4a8e9c26af611c36435aa`), **1509 chars, 23 lines**, i.e.
byte-identical. This is the "unify all three consumers" half of the commit message, extended by the two
WF05 copies.

**Verification at commit time.** 58/58 tests pass, 9/9 journeys pass, and the smoke run exits 0.

**Non-vacuity.** 5 of the 7 new tests fail against the pre-fix code. The two that pass against it are
correct to pass: *the three consumers agree byte-for-byte on the same input* (all three were already
identical before the fix) and *ordinary text, including quoted prose, is still NOT redacted* (a guard
against over-redaction, which must hold in both states). So the 5 failures are the defect-specific ones.

**Known coverage gap.** No single test spans all five consumers. The F14 test asserts WF01 ×2 + WF06;
the F17 test asserts WF05 ×2 against the pinned hash. A sixth consumer carrying a divergent block
would pass both. A single all-five byte-identity test is a **tracked follow-up, not yet written** —
recorded in the status summary so it is not buried here.

**Why this commit's record lagged.** `af302e8`'s subject reads *"docs(measurement): mark F15 resolved;
add F16 resolution, F18, deploy prerequisite"*, but its body never changed any of F15's twelve
references — the resolution-log row, the summary row, the header and the section status all still read
open at `af302e8`. The code fix landed in `fd75d62`; the documentation claim did not. Corrected in this
pass, with no workflow JSON, test, `measurement/src/`, `package.json` or evidence-matrix change.

---

## F16 — WF05 fails follow-up sends silently and leaves the lead re-eligible forever

**Status: RESOLVED 2026-09-30 · CONFIRMED · classification: production reliability defect · commit `0e30562`**

Severity was not separately triaged for this one; it was closed as a known active defect without a
re-rating pass. The analysis below is retained as written, describing the behaviour before the fix.

Surfaced from `measurement/EVIDENCE_MATRIX.md`, which rated the claim *follow-up actually sent —
attempts* as **NO**. Read as a measurement question the gap is survivable; read as a statement about
the engine it is not: WF05's failure path is a terminal dead end that changes nothing, and the
sweeper runs hourly.

**Evidence.** `05 - Follow-up Sweeper.json` has ten nodes and exactly one write — `Update Lead
Follow-up State`, on `leads`. The relevant edges:

| Node | Type | Notes |
| --- | --- | --- |
| `Schedule Trigger` | `scheduleTrigger` | `0 * * * *` — hourly |
| `Send Follow-up Email` | `emailSend` | `onError: continueErrorOutput` |
| ↳ output 0 | — | → `Advance Follow-up State` |
| ↳ output 1 | — | → `End Failed Sends` |
| `Advance Follow-up State` | `code` | the **only** node that advances follow-up state |
| `End Failed Sends` | `noOp` | **no outgoing connections — terminal** |

`Advance Follow-up State` is the sole place in the whole engine that increments `followup_count`,
stamps `last_contact_at`, recomputes `next_followup_at`, and sets the terminal
`status: 'no_response'` once `count >= max_followups`. It is reachable only from output 0.

**Consequence.** On failure, all four values are left exactly as they were:

| Field | After a successful send | After a failed send |
| --- | --- | --- |
| `followup_count` | `+1` | **unchanged** |
| `last_contact_at` | stamped now | **unchanged** |
| `next_followup_at` | pushed out `followup_delay_hours` (default 24) | **unchanged, stays in the past** |
| `status` | `no_response` once at max | **unchanged** |

`Select Follow-up Candidates` admits a lead when `followup_count < max_followups` (default 3) **and**
`next_followup_at` is present and `<= now`. A failure changes none of the three inputs to that test,
so **all three conditions still hold on the next hourly run — and on every run after that.** The
retry loop is unbounded in time, and `max_followups` is unreachable, because the counter it compares
against is only incremented on the success path.

**Nothing is recorded.** WF05 contains no `errors` write at all — its three Google Sheets nodes are
two reads (`business_config`, `leads`) and one `leads` update. And because the email node sets
`onError: continueErrorOutput`, the execution does not fail, so the workflow-level error handler
(`06 - Error Handler.json`, wired as WF05's `errorWorkflow`) is never invoked either. There is
consequently no observable signal that follow-ups are failing.

**Why this is a reliability defect and not a measurement gap.** F2, F3 and F7 share a shape — an
expected output is absent. F16 is different: the engine *acts*, repeatedly, and appears healthy. A
lead whose sends fail on a persistent condition (invalid address, provider rejection, suppression)
is re-selected hourly and retried indefinitely, while `leads` shows `followup_count = 0` and a
`next_followup_at` stuck in the past. From the sheet, that lead is indistinguishable from one that
has simply never been swept, so the failure is invisible to an operator and unbounded to the
customer. F16 is the only open finding whose failure mode is *repetition* rather than *absence*.

**Scope note.** This is bounded by one thing only: whether the failure is persistent. A single
transient failure costs one redundant send. A persistent one is an unbounded loop. Nothing in
`01–07` distinguishes the two, because the state that would distinguish them is exactly what the
failure path declines to write.

**Remediation:** not determined. No fix is proposed here.

### Resolution — F16 (2026-09-30, commit `0e30562`)

**Option (c) was chosen.** A new `followup_fail_count` field on `leads`, maintained by a Code node on
the error path only, which records a sanitised `errors` row and retires the lead as `failed` once a
failure ceiling is reached:

```js
const ceiling = Math.max(24, Number(config.max_followups || 3) * 4);
```

The terminal status is `failed`, deliberately distinct from `no_response`, because `no_response` is a
claim that the customer never replied. A lead retired for send failures never made that claim, and
conflating the two would corrupt the measurement layer's non-response metric.

**Options rejected.**

- **(a) Increment `followup_count` on failure and let `Advance Follow-up State` reach `no_response`
  naturally** — rejected because it would fabricate a customer non-response out of an infrastructure
  failure. The engine would assert something untrue about a customer.
- **(b) Write an `errors` row but leave the retry loop as it was** — rejected as a non-fix. It makes
  the failure visible while leaving the unbounded hourly retry and the unreachable `max_followups`
  in place, which is the actual defect.
- **(c) A dedicated failure counter on the error path** — chosen because it preserves `followup_count`
  as a record of real contacts (so a transient SMTP failure cannot burn the customer's follow-up
  allowance) while bounding retries through the same `reachedMax` threshold pattern
  `Advance Follow-up State` already uses.

`followup_count` is therefore never touched on the failure path, and a lead whose sends fail
transiently recovers normally on the next sweep.

**The two writes fan out rather than chain.** `Append Follow-up Error` and
`Update Lead Follow-up Retry` are both connected directly to the output of
`Build Failed Follow-up Record`, in parallel, because n8n's `googleSheets` **append** node returns the
**appended sheet row** as its output. Chaining them would have fed the appended `errors` row into the
lead update as `$json`, so the update node would have written the error record's values over the
lead's row. The fan-out is what makes the partial update read from the Code node's item.

**Scope of the fix.**

| File | Change |
| --- | --- |
| `05 - Follow-up Sweeper.json` | error path rebuilt: `End Failed Sends` removed; `Build Failed Follow-up Record`, `Append Follow-up Error`, `Update Lead Follow-up Retry` added, fanned out |
| `04 - Status Update.json` | `'failed'` added to the allowed-status list and the terminal-status list |
| `measurement/src/sheet-store.js` | `followup_fail_count` added to the `leads` header contract |
| `measurement/src/journeys.js` | Journey H extended to cover the failure, the ceiling and the recovery |
| `measurement/tests/f1-f5-regressions.test.js` | 9 tests added |

**Verification.** 67/67 tests pass. Non-vacuity was established by re-running the 9 new tests against
the pre-fix WF04 and WF05: **8 of 9 fail**, each on a defect-specific assertion, and the ninth — the
guard asserting the success path is unchanged — correctly passes both before and after, which is what
a regression guard should do. All 9 journeys pass, and the smoke run exits 0.

**Not verified offline:** the deploy-time header requirement below, which can only be confirmed
against the live Google Sheet.

### Deployment prerequisite — add `followup_fail_count` to `leads` first

The real Google Sheet `leads` tab **must** have `followup_fail_count` in its header **before** WF05 is
imported into the live n8n instance. `Update Lead Follow-up Retry` is a partial update that writes
that column by name, so on a live tab lacking the column the update fails at runtime and the failure
path breaks in production even though it is correct in the harness.

This is a deploy-time requirement, not a code change. The harness is not at risk: it copies its
headers from the contract in `measurement/src/sheet-store.js`, which was updated in the same commit.
Order the sheet change ahead of the workflow import.

One further consequence was surfaced by the fix rather than addressed by it, and is tracked as F18
below.

---

## F17 — WF05 records no `status_updates` row for the terminal transition

**Status: RESOLVED 2026-10-01 (`a06e1ae`) · CONFIRMED · classification: audit-trail defect (fixed)**

Surfaced from `measurement/EVIDENCE_MATRIX.md` while rating the *no_response reached* and *final
outcome traceable* claims. The string `status_updates` does not occur anywhere in
`05 - Follow-up Sweeper.json`. Its only sheet nodes are the two reads and the one `leads` update
listed in F16.

**What is missing.** `Advance Follow-up State` moves a lead to `status: 'no_response'` when
`followup_count` reaches `max_followups`. That state is written to the `leads` row and no
`status_updates` row is appended, so the transition is never recorded as an event. The audit table
that exists to record status transitions omits the one transition that closes the follow-up
lifecycle.

**Contrast with F5 (resolved).** `Build Status Update Record` exists in WF03 and WF04, so status
changes arriving through the status-update and callback paths *are* recorded — each row carrying
`update_id`, `created_at`, `lead_id`, `business_id`, `old_status`, `new_status`, `updated_by` and
`notes`. The engine's own history is therefore inconsistent: the paths an operator can trigger by
hand are audited, and the one path the scheduler takes on its own is not.

**Precisely what is lost.** The end state survives — `leads.status` reads `no_response`, and
`leads.followup_count` reads how many sends *succeeded*. What does not survive is the transition
itself:

- `old_status` — the status the lead was in when the sweeper gave up
- `updated_by` — that the sweeper, not an operator, made this change
- `new_status` as an event, with its own `update_id` and `created_at`
- any record that the terminal decision was reached *deliberately* at `count >= max` rather than by
  any other cause

**Relationship to F16.** The two compound, and neither alone tells the whole story. `leads` shows
`status = no_response` with `followup_count = N`, which reads as "we tried N times, successfully,
and stopped." F16 says nothing about attempts that *failed*, because those leave no row anywhere;
F17 says nothing about the transition, because no `status_updates` row is written. Closing F17 alone
would produce a trustworthy-but-incomplete transition record that still cannot distinguish `N`
attempts from `N + M` attempts.

**Remediation:** delivered in `a06e1ae`. See the resolution below.

### Resolution — F17 (2026-10-01, commit `a06e1ae`)

**What was added.** Two nodes in `05 - Follow-up Sweeper.json`:

| Node | ID | Role |
| --- | --- | --- |
| `Build Follow-up Status Record` | `f17b1c40-0001-4a11-9c02-0000000000e1` | Emits the `status_updates` row, mirroring `Build Status Update Record` from WF03/WF04 |
| `Append Follow-up Status Update` | `f17b1c40-0002-4a11-9c02-0000000000e2` | `googleSheets` **append** to `status_updates` |

**The obstacle was `old_status`.** `old_status` is the whole point of the row, and in WF05 the status
is overwritten *inside* the same Code node that would need to read it. Two Code nodes already write a
terminal status, and both now hoist the pre-transition value before the overwrite:

- `Advance Follow-up State` derives `oldStatus` from the lead as it stands, before writing
  `no_response`.
- `Build Failed Follow-up Record` (from F16) emits `old_status` alongside its own terminal write, so
  the F16 path does not need a second read.

**Why the branches feed the builder directly.** Both terminal writers fan out to
`Build Follow-up Status Record` rather than chaining `Prepare → Update → Build → Append`. n8n's
`googleSheets` **append** node returns the appended sheet row as its output, so chaining the builders
would feed one `status_updates` row into the next node as `$json`. Fan-out is the same pattern F16
established, and it is what preserves the F5 topology invariant: every terminal `leads` update in WF05
is now paired with exactly one `status_updates` row.

**The row shape matches the rest of the engine.** `update_id`, `created_at`, `lead_id`, `business_id`,
`old_status`, `new_status`, `updated_by`, `notes` — the same eight columns `Build Status Update Record`
writes, so a reader written against WF03/WF04 needs no special case for sweeper-originated rows.
`updated_by` is the sweeper, not an operator, which is the attribution the finding said was lost.

**Sanitizer.** The builder carries the shared `SECRET_RE` block rather than trusting `updated_by` and
`notes` to be safe. That block now has **five** consumers — `Build Customer Email Error Record` and
`Build Owner Email Error Record` (WF01), `Build Follow-up Status Record` and
`Build Failed Follow-up Record` (WF05), and `Build & Sanitize Error Record` (WF06) — and all five
hash to `d7ffc93db65e5c0c…` (1509 chars), so it is byte-identical everywhere. The F17 test pins that
hash and compares byte-for-byte against the F16 copies; the pre-existing F14 drift check spans the
WF01 ×2 and WF06 copies. `updated_by` and `notes` are both routed through `sanitize()`.

**Transition-gated semantics — the gate sits in the builder, and it matches WF05's.** The builder
emits a row only when `old_status !== status`; a sweep that neither sends nor crosses a threshold
produces no row. This was verified by driving WF05 with a mixed sweep — one lead returns, one bounces
in the same run — where both leads remain `status: new` and the builder emits **0** rows. That is the
property F18's predecessor concern required, and it is why closing F17 does not manufacture audit
noise for sweeps that changed nothing.

**Verification.** 76/76 tests pass in `tests/f1-f5-regressions.test.js`, all 9 journeys pass, and the
smoke run exits 0. The mixed-sweep case above is the load-bearing one: it is the only scenario that
distinguishes a genuinely gated builder from one that appends unconditionally.

**Non-vacuity.** Against the pre-fix HEAD the 9 dedicated F17 tests all fail, each on a
defect-specific assertion. Together with the F16 fan-out test widened to cover the new nodes, the
pre-fix run is **66 pass / 10 fail** — so the suite genuinely exercises the new behaviour rather than
passing vacuously.

**Observation, not a finding — the `??` chain in `Advance Follow-up State`.** The hoist reads
`String(j.status ?? source.status ?? '')`. An **empty-string** status survives that chain rather than
falling through to `source.status`. This is correct and was left unchanged: the candidate `j` and
`source` derive from the same `leads` row, so if one is `''` the other is `''` and the fallback cannot
disagree. It is also **unreachable through normal engine operation** — every lead the engine creates
arrives with `status: 'new'` — so no normal path produces the empty string at all. The only way to
reach it is a hand-edited or legacy row with a blanked status, and the `??` chain already degrades
safely there, matching the `old_status: ''` convention WF03 uses for the same situation. No expression
was changed.

**Not verified offline:** the live-sheet append, which needs the real `status_updates` tab. The tab and
its headers already exist — F5 established that — so this is a confirmation of the write, not a schema
prerequisite. The F16 `followup_fail_count` header prerequisite remains the one live blocker for WF05.

---

## F18 — `followup_fail_count` is a total, not a consecutive-failure streak

**Status: OPEN · CONFIRMED · classification: semantic edge case introduced by the F16 fix · severity not yet assigned**

Surfaced by the F16 fix, and not by anything preceding it: the counter that bounds follow-up retries
was specified and implemented as a total accumulation, and that choice has a consequence worth
recording rather than shipping silently.

**The behaviour.** `Build Failed Follow-up Record` increments `followup_fail_count` on every failed
send and decrements nothing. A success does not reset it. So the ceiling test is
`followup_fail_count >= ceiling`, over the lead's whole lifetime, not over consecutive failures. A
lead that alternates — fail, succeed, fail, succeed — accumulates failures indefinitely while its
`followup_count` records the successes, and will eventually be retired as `failed` on the strength of
failures that were not consecutive.

**Consequence.** A lead with intermittent sends can be retired even though it received some emails.
The two counters disagree in the terminal state: `followup_count = 1` and `followup_fail_count = 24`
is reachable, and it means "one message got through, twenty-four sends did not" rather than
"twenty-four attempts in a row failed".

**Why it was not fixed in F16.** Consecutive-failure semantics require a reset on success, and the
reset can only be written in `Update Lead Follow-up State` — the success path. F16 was explicitly
scoped to leave the success path untouched, because the entire guarantee of that fix is that
`followup_count` keeps its meaning and a transient failure cannot burn the customer's allowance.
Adding a `followup_fail_count: 0` write to the success path is a change to the most heavily
regressed surface in the engine, and it is a different change from the one F16 authorised. The
consequence was therefore surfaced as a separate finding rather than absorbed into the commit.

**Why it is not a pilot blocker.** Two independent reasons.

1. **The ratio required is extreme.** To retire a lead, a tenant must accumulate 24 failed sends
   against at most 3 successful ones — and `followup_count` is itself capped at `max_followups`
   (default 3), so the successful-contact count can never exceed 3 while the failure count reaches 24.
   That is a failure ratio worse than 8:1 sustained across many leads. At that point, concluding the
   lead is unreachable is a defensible reading of the evidence, not a distortion of it.
2. **The terminal status is `failed`, not `no_response`.** The measurement layer therefore does not
   read this as a customer non-response. A lead retired this way is not counted among non-responses,
   so the non-response metric stays truthful. F18 degrades the *reason* a lead was retired, not the
   fact of retirement, and the retirement itself is the correct outcome for a lead that has failed to
   be reached 24 times.

**Remediation:** not determined. Candidate: streak semantics, with `followup_fail_count` reset to 0 in
`Update Lead Follow-up State` on a successful send, so the ceiling counts consecutive failures only.
That fix is small but belongs on the success path and needs its own regression pass over the
`followup_count` tests before it can be adopted.

---

## Fix order

F1, F5, F9, F10, F11, F12, F13, F14, F15, F16 and F17 are done. Revised order for what remains:

| # | Finding | Why |
| --- | --- | --- |
| 1 | **F6** | WF03 and WF04 bodies still render `undefined` at customers and owners. WF01's half closed as a consequence of F1, so this is the only live customer-facing rendering defect. |
| 2 | F3 | Silent webhook hangs on unknown-lead booking traffic. |
| 3 | F2 | Dangling `lead_id` handed to API callers. |
| 4 | F8 | Rejected/duplicate traffic still writes no rows. No longer blocked on `measurement_events` — that question is closed; needs a small ingress record instead. |
| 5 | F4 | Confirm n8n zero-item semantics live; fix only if the halt is real. |
| 6 | F7 | Cosmetic staleness signal. |
| — | **F18** | **Deferred.** A fix requires touching `Update Lead Follow-up State` — the success path — which F16 was explicitly scoped to leave alone. Semantics are total, not a consecutive streak; see the F18 section for why the resulting retirement is still defensible. |

**On F6 now ranking first.** F17 held this slot on the strength of being an active audit-trail defect
sharing F16's surface, and F15 outranked it as the only open finding with a security consequence. Both
are now closed — F17 as of `a06e1ae`, F15 as of `fd75d62`. Of what remains, F6 is the only one a
customer can observe, and nothing left carries a security consequence. F18 is deliberately parked
rather than promoted: it is reachable only at a failure ratio worse than 8:1, and its terminal status
is `failed` rather than `no_response`, so it does not distort the non-response metric.

## Before the measurement layer is built

The two structural prerequisites are met. F5 means `status_updates` is a real lifecycle audit
trail, F1 means intake produces real outbound evidence and delivers the booking link, F9 means
the engine actually serves more than one tenant, F10 means the `errors` tab is finally a
usable failure ledger, F11/F13 mean the ledger's `error_message` is sanitised on both write paths,
F14 closes the bearer pattern, and F12 means the booking column is trustworthy.

Four things must be accounted for before trusting any metric, as scoped by
`measurement/EVIDENCE_MATRIX.md` (`c0f8e5b`):

- ~~**F15**~~ — **CLOSED.** `errors.error_message` and `errors.payload` are sanitised for both
  unquoted *and* quoted credential forms as of `fd75d62`, so the quoted-JSON values
  (`"password":"hunter2"`) that once passed through on the same paths no longer do. The blocker this
  bullet recorded — "should not be copied wholesale into a measurement table until the quoted form is
  redacted" — no longer applies. F13 closed the WF06 write path, F14 the bearer pattern, and F15 the
  quoted form, which was the last of the F11 residual.
- **WF02–WF04 email failures are recorded nowhere** — as of `0e30562`, WF01 and WF05 both have an
  error-record builder, so three email nodes still fail into silence. The matrix routes their
  existing error outputs to the **`errors` tab already in use**; WF01's builder+append pair is the
  pattern to copy, and F16's `Build Failed Follow-up Record` / `Append Follow-up Error` pair is a
  second worked instance of it. This is closer to a bug fix than to new instrumentation, and it is
  the highest-priority remaining item in the matrix.
- ~~**F17**~~ — **CLOSED in `a06e1ae`.** WF05 now writes the `status_updates` row for the terminal
  transition, appending to the **`status_updates` tab already in use** as the matrix prescribed.
- **Sweep-run record — the one item that may need a minimal new schema element, and it is kept
  deliberately separate from the closed `measurement_events` question.** `Select Follow-up Candidates`
  output feeds an IF directly, so no sweep-run record exists. Without one, "we stopped because
  nothing was due" and "the sweeper is broken" are indistinguishable. No existing tab fits, so this
  stays an open, separate decision rather than a consequence of the closure above.

**F8's residual half.** Rejected and duplicate ingress still writes no rows, and cannot be derived
from any current field; the matrix's remedy is a **small ingress record** — a second small new schema
element, and the substance of why F8 remains open. F10 improved the *email-failure* slice of F8's
original gap list; it did not close it, and the schema decision that used to sit underneath F8 is
now closed.

F12 no longer constrains the schema: `booking_link_sent` is now a truthful flag for every tenant.

**`measurement_events` status: closed as a requirement; still not implemented.** The decision
recorded in `measurement/EVIDENCE_MATRIX.md` (`c0f8e5b`) recommends against a general-purpose event
log for the pilot, which closes the question this document previously left attached to F8. No
`measurement_events` table, node or column exists in `01–07` at this commit, and closing the question
did not authorise one. What remains open is scoped and small: the **sweep-run record** and the
**ingress record** above.

Recommended next step: fix F6 — the last customer-visible defect — then the matrix's item 1, route the
remaining WF02–WF04 email error outputs to the existing `errors` tab, since it closes the most gaps at
once against a baseline that is finally trustworthy. **F15 and F17 are both closed** (`fd75d62` and
`a06e1ae`), leaving F18 as the only open item on the follow-up lifecycle, deferred because a fix would
touch the success path. **Deploy F16 only after adding `followup_fail_count` to the live `leads` header** — see the deployment
prerequisite in the F16 section.
