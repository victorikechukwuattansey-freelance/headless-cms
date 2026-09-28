# Lead Recovery Engine — Pilot Evidence Matrix

**Date:** 2026-09-28
**Scope:** `workflows/lead-recovery-engine/01–07` as committed at `5c1a854`
**Method:** static analysis of the production workflow JSON. For every workflow I read the node
graph, the Sheets write mappings, the Code-node bodies that compute persisted values, each email
node's `onError` posture, the output index each error branch is wired to, and each workflow's
`settings.errorWorkflow`.
**Companion:** `FINDINGS.md` (F1–F15). Finding IDs are cited below where they explain a gap.
**No workflow JSON, test, or `package.json` was modified to produce this document.**

---

## How to read this document

### Two things this matrix is not

1. **This is not a query of the live spreadsheet.** I read the workflows, not the sheet. Every
   "observable" rating below means *a field is written that carries the fact* — it does not mean I
   have seen the data. Whether the live tab headers actually match the mappings is **UNKNOWN**; see
   the global caveats.
2. **This is not workflow-execution evidence.** n8n execution history is a separate surface. I have
   not inspected it, and I do not know the retention window or query surface of this instance, so
   I have treated it as **UNKNOWN** rather than as an available fallback.

### Rating vocabulary

| Rating | Meaning |
| --- | --- |
| **YES** | A persisted field carries the fact directly. |
| **PARTIAL** | Observable for a subset of cases; the remainder is indistinguishable from something else. |
| **INCOMPLETE** | Observable, but captures only one channel or one code path and misses out-of-band reality. |
| **NO** | No persisted field carries the fact. |
| **UNKNOWN** | Cannot be determined without access I do not have (live sheet, n8n retention config). |

**A missing record is never counted as zero.** Throughout this document, "no evidence" means the
population is **unknown**, not empty. This is the single most important constraint in the matrix:
most of the gaps below produce *silent* absence, and an absent row is indistinguishable from a
system that did not run.

---

## The evidence base

Five tabs, identified from the resource locators in the workflow JSON (each `cachedResultName`).

| Tab | gid | Written by | Canonical fields written |
| --- | --- | --- | --- |
| `leads` | `1327828692` | `Append Lead` (WF01, WF03) + 6 update nodes | see below |
| `bookings` | `909369209` | `Append Booking` (WF02) | `booking_id`, `lead_id`, `business_id`, `created_at`, `booking_at`, `source`, `status` |
| `status_updates` | `68953102` | `Append Status Update` (WF02, WF04), `Log Status (new)` (WF03) | `update_id`, `created_at`, `lead_id`, `business_id`, `old_status`, `new_status`, `updated_by`, `notes` |
| `errors` | `2001101880` / literal `errors` | `Append Customer/Owner Email Error` (WF01), `Append Error` (WF06) | `error_id`, `created_at`, `workflow`, `node`, `business_id`, `lead_id`, `error_message`, `execution_id`, `payload`, `resolved` |
| `business_config` | `gid=0` | read-only in all 7 workflows | `business_id`, `business_name`, `owner_name`, `owner_email`, `from_email`, `reply_to_email`, `active`, `max_followups`, `followup_delay_hours`, `auto_customer_email`, `booking_link`, `niche`, `timezone` |

`leads` field set, as the union of every mapping in the JSON (27 written by `Append Lead`, plus 3
written only by updates):

`lead_id`, `business_id`, `created_at`, `updated_at`, `source_type`, `source_id`, `name`, `phone`,
`email`, `message`, `service`, `niche`, `city`, `state`, `zip`, `urgency`, `score`, `status`,
`booking_link`, `booking_link_sent`, `booked`, `followup_count`, `next_followup_at`,
`last_contact_at`, `last_customer_response_at`, `idempotency_key`, `notes`, **`booked_at`**,
**`booking_id`**, **`owner_notified`**, `row_number`

The three bolded fields are never written by any append — only by `Update Lead Booked` (WF02) and
`Update Lead` (WF04). `owner_notified` is never written by **any** node in any workflow; it appears
only as inert metadata inside WF07's `columns.schema` block.

### Two global caveats

1. **The `columns.schema` blocks are not a canonical field list.** WF01's `Update Booking Link`
   node carries a schema snapshot with two misspellings — `last_customer_resonse_at` and
   `idempontency_key` — while `Append Lead` and WF07 use the correct spellings. The node's actual
   `value` mapping writes only `lead_id` and `booking_link_sent`, so the typos are inert today, but
   they demonstrate that these schema blocks drift from the real headers. The union above is built
   from write mappings, not from schema blocks, for that reason.
2. **`business_config` is unversioned.** `max_followups` and `followup_delay_hours` are read live at
   send time. Any bound-compliance check is therefore judged against the *current* config, not the
   config in force when the send happened.

---

## The matrix

| Business claim | Existing evidence | Directly observable? | Safely derivable? | Missing evidence? | Minimum necessary instrumentation |
|---|---|---|---|---|---|
| **Lead entered** | `leads.created_at`, `lead_id` — accepted requests only | **PARTIAL** — nothing written for 401/400/403/404/422 rejects (F8) | **NO** for total ingress; **YES** for accepted count (row count in `leads`) | Every rejected or pre-persist-failed request | Ingress counter or log covering the reject branches (F8) |
| **Lead captured / normalized** | `score`, `urgency`, `status='new'`, `idempotency_key`, `source_type`, `source_id` | **PARTIAL** — persisted only when not a duplicate | **YES** for persisted leads; **NO** for duplicates and rejects | Normalization outcome for duplicate/rejected traffic | None for accepted leads; covered by the ingress counter above |
| **Lead persisted** | One row in `leads` keyed by `lead_id`, with `created_at` | **YES** | **YES** | Nothing for this claim | None |
| **Duplicate blocked** | **NONE.** `Is Duplicate?` → `Respond 200 Duplicate Accepted`, a terminal respond node. No row is written (F8) | **NO** | **NO** — "no duplicate" and "duplicate absorbed" are the same observable state | The duplicate-block event itself | Duplicate-block counter, keyed `business_id` (F8, F2) |
| **Initial response attempted** | `errors` row proves a *failed* attempt (WF01 only). `booking_link_sent='TRUE'` proves a *successful* attempt (WF01 only) | **PARTIAL** | **NO** — a successful send to a tenant with no booking link writes no field at all | A per-send attempt record (row 6 explains the asymmetry) | Per-send attempt record with lead_id, channel, timestamp, outcome |
| **Initial response succeeded** | `booking_link_sent='TRUE'` — positive proof. `errors` row — negative proof | **PARTIAL** — asymmetric by design | **NO** — `booking_link_sent='false'` conflates *sent with no link*, *skipped (no email configured)*, and *attempted and failed* | Send outcome for tenants with no configured link | Same record as above; without it this claim stays PARTIAL forever |
| **Follow-up eligible** | **NONE.** `Select Follow-up Candidates` output feeds an IF directly. No sweep-run record, no candidate list, no count | **NO** | **PARTIAL** — the candidate set can be *re-derived* from `leads` + `business_config` by replaying the Code-node filters, but that is a reconstruction of the present, not a record of what was eligible at sweep time | Per-sweep eligibility record | Sweep-run summary: timestamp, candidate count, tenant scope |
| **Follow-up actually sent** | `followup_count` + `last_contact_at`, advanced **only** on the email success output | **NO** for attempts; **YES** for successes | **NO** — a failed send writes nothing: `Send Follow-up Email` out:1 → `End Failed Sends` (terminal NoOp), never reaches `Advance Follow-up State`, and writes no `errors` row | Failed-follow-up record | Route the WF05 email error output to the existing `errors` tab |
| **Follow-up count bounded** | `followup_count` vs `business_config.max_followups`; at the cap WF05 sets `status='no_response'` and clears `next_followup_at` | **YES** | **YES** — `followup_count <= max_followups` is checkable per lead | Nothing for the bound itself | None. Caveat: judged against current, unversioned config |
| **Customer responded** | `leads.last_customer_response_at` (WF07), plus `next_followup_at` cleared | **YES** for the WF07 endpoint | **INCOMPLETE** — only responses POSTed to that endpoint. Email replies, calls, and provider callbacks are not captured | Out-of-band response capture | Genuinely unavailable from existing sources. Out of pilot scope; record as a known blind spot. (F7: `updated_at` is not bumped) |
| **Booking received** | **Four redundant writes:** `bookings` row, `leads.booked='TRUE'`, `booked_at`, `booking_id`, `status='booked'`, and a `status_updates` row with `new_status='booked'`, `updated_by='booking_status'` | **YES** for the provider channel | **YES** — the strongest evidence in the engine | Attendance / kept appointment; bookings taken by phone or in person | None for the channel. Do **not** infer from WF02 running: F3 means WF02 can execute and write nothing (404, unknown lead) |
| **Booked lead stopped inappropriate follow-up** | `leads.next_followup_at=''` and `status='booked'` (WF02); WF05 excludes `booked\|lost\|closed\|no_response` from candidates | **YES** | **YES** — checkable as an invariant: no terminal-status lead has a non-empty `next_followup_at`, and no `followup_count` advance after its terminal timestamp | Nothing material | None |
| **no_response reached** | `leads.status='no_response'` set by WF05 when `followup_count >= max_followups`, with `next_followup_at` cleared | **YES** in `leads.status` | **PARTIAL** — the state is persisted, but **WF05 writes no `status_updates` row**, so this transition is absent from the lifecycle audit trail. It is a state, not a recorded transition | A `status_updates` entry for sweeper-driven transitions, and the *reason* (cap reached) | WF05 appends one `status_updates` row on terminal transition — **reusing the existing table** |
| **Error occurred** | `errors` tab. Written by WF01's two email-error builders (carry `lead_id`) and by WF06 | **PARTIAL** | **PARTIAL** — two hard limits below | WF02–WF05 email failures; lead attribution on WF06 errors; all rejected requests | Route WF02–WF05 email error outputs to the existing `errors` tab |
| **Error affected business outcome** | **NONE.** No field records causation | **NO** | **PARTIAL**, and only for WF01: `errors.lead_id` → `leads` gives correlation, not causation. No ordering guarantee beyond timestamps. WF02–WF05 errors are not recorded, so no join exists at all | An outcome-impact marker | None beyond fixing row 14's recording gap. Once errors carry `lead_id`, the join is sufficient — do **not** add a causal field |
| **Final outcome traceable** | `leads.status` (current state) + `status_updates` (WF02/03/04 transitions) | **PARTIAL** | **INCOMPLETE** — four holes, listed in the detail section | Sweep-run records; automatic closure; an explicit expired/abandoned state | Sweep-run summary (same record as "Follow-up eligible") |

---

## Claim detail

### 1. Lead entered — PARTIAL
`Append Lead` runs **before** any email side effect (persistence-first, WF01 `Append Lead` note), so
a `leads` row proves the request was accepted and persisted, and nothing more. The reject branches
(`Respond 401/400/403`, plus `404`, `422`, `409` and the duplicate branch) are terminal respond
nodes with no write. **F8.** An accepted-leads count is therefore a floor on ingress, not a measure
of it.

### 2. Lead captured / normalized — PARTIAL
`Resolve Config & Normalize Lead` (WF01) and `Resolve Config & Normalize Callback` (WF03) compute
`urgency`, a 0–100 `score`, `status='new'`, and a deterministic `idempotency_key`. All of that is
persisted for accepted leads. For duplicates the node runs and its output is discarded at
`Is Duplicate?`, so normalization is invisible.

### 3. Lead persisted — YES
Direct. `leads.lead_id` + `created_at`. This is the one claim in the first third of the lifecycle
with unambiguous evidence.

### 4. Duplicate blocked — NOT_MEASURABLE
No field, and no derivable proxy: an inbound request that hits the duplicate branch and one that
never reaches the branch produce an identical `leads` tab. **F2** makes the API response unusable as
a cross-check too — the duplicate branch returns a freshly minted `lead_id` that was never
persisted, so the caller holds a dangling reference. Duplicate rate is currently unmeasurable in
both directions.

### 5–6. Initial response attempted / succeeded — PARTIAL, and the asymmetry matters
This is the most consequential row pair, so the wiring is worth stating exactly.

`Update Booking Link` is connected to `Customer Acknowledgment` **output index 0 — the success
output only.** The `booking_link_sent` expression is
`{{ $('Prepare Email Content').first().json._bookingLinkPresent ? 'TRUE' : 'false' }}`. Therefore:

- `booking_link_sent='TRUE'` ⟹ the customer email node **succeeded** *and* a validated link was
  offered. This is genuine positive proof of a successful send. (F12 made this column truthful.)
- `booking_link_sent='false'` ⟹ the email succeeded with no link configured, **or** the email was
  skipped entirely (`Skip Customer Email` when no `from_email`), **or** the email failed. The
  `Append Lead` value is `false` (boolean) and is never revised on those paths. All three states are
  identical in the sheet.
- Email **failure** is provable, but only for WF01: the error output routes to
  `Build Customer Email Error Record` → `Append Customer Email Error`, carrying
  `workflow='01 - Lead Intake'`, `node='Customer Acknowledgment'`, and a real `lead_id`.

One further caveat on "succeeded": **WF03 and WF04 bodies render literal `undefined`** (F6). A
successful SMTP send in those workflows is not evidence of a correct message. Send success and send
correctness are separate claims and only the first is observable.

### 7. Follow-up eligible — NOT_MEASURABLE
`Select Follow-up Candidates` applies six filters (active business, non-terminal status,
`followup_count < max_followups`, `next_followup_at` present and `<= now`, valid email) and its
result goes straight into `Any Candidates?`. Nothing is persisted — not the candidate set, not the
count, not the fact that the sweep ran. You can re-derive the *current* candidate set by replaying
the same logic against `leads` + `business_config`, but the rules live in a Code node rather than in
config, so the derivation can silently drift away from production behaviour, and it says nothing
about any past sweep.

### 8. Follow-up actually sent — attempt NOT_MEASURABLE, success YES
`Advance Follow-up State` is connected to `Send Follow-up Email` output 0 only. So `followup_count`
and `last_contact_at` are a faithful record of **successful** sends. The failure path is the gap:
out:1 goes to `End Failed Sends`, a terminal NoOp. No `errors` row, no state change, and the
`End Failed Sends` note confirms the design intent — the lead is retried next sweep with
`followup_count` untouched. The consequence is exact: a lead can fail every follow-up indefinitely
and the sheet will show `followup_count=0` forever. **Failure is not zero sends; failure is an
unknown number of attempts.**

### 9. Follow-up count bounded — YES
`max_followups` comes from `business_config` (default 3 when absent or unparseable). At the cap,
`Advance Follow-up State` sets `status='no_response'` and clears `next_followup_at`, which also
removes the lead from future candidate selection. The invariant `followup_count <= max_followups`
is directly checkable. The only caveat is the unversioned config: raising `max_followups` later
changes the standard past sends are judged against.

### 10. Customer responded — INCOMPLETE
`Update Lead Response` (WF07) sets `last_customer_response_at` and clears `next_followup_at`, which
correctly suppresses follow-up. But this records only calls to the WF07 endpoint. The business
question is "did this lead respond?", and the sheet can only answer it for one channel. A lead who
replied to the acknowledgment email or called the business is indistinguishable from a lead who went
silent. This is a real blind spot, not a measurement defect — and the fix is not in this system.
**F7:** `updated_at` is not bumped by WF07, so "last touched" heuristics mis-rank responded leads.

### 11. Booking received — YES, with a scope limit
This is the best-evidenced claim in the engine: four independent, consistent writes. But read
precisely — it evidences *a booking event was received on the provider channel*. In
`Resolve Lead & Booking`, `booking.source` is `body.source` or the default `'booking_provider'`, and
`booking.status` is `body.status` or the default `'confirmed'`. Both are provider-supplied. Nothing
in the system records whether the appointment was kept or attended, and nothing records bookings
taken by phone or in person.

Per instruction, WF02 executing is **not** evidence: **F3** — an unknown lead produces
`Respond 404` with no booking append and no lead update, so WF02 can run to completion having
recorded nothing.

### 12. Booked lead stopped inappropriate follow-up — YES
WF02 clears `next_followup_at` and sets `status='booked'`; WF04 does the same for every terminal
status. WF05 excludes `booked`, `lost`, `closed`, `no_response` from candidates. So the suppression
is enforced twice — at scheduling time and at selection time — and both are checkable in the sheet.
This claim is genuinely measurable and is the one to build the pilot's first dashboard on.

### 13. no_response reached — PARTIAL
The terminal state is persisted in `leads.status`. But **WF05 contains no `status_updates` append** —
its node list is Schedule → 2 reads → Select → IF → Email → Advance → Update, and that is all. So
the transition that ends the follow-up lifecycle is missing from the audit trail that exists
specifically to record transitions. The *reason* (cap reached) is also unrecorded; it must be
re-inferred by comparing `followup_count` against a config value that may since have changed.

### 14. Error occurred — PARTIAL, with two structural limits
`errors` is populated by exactly two mechanisms: WF01's two email-error builders, and WF06 for
workflow-level failures. Two hard limits:

1. **Email failures in WF02, WF03, WF04 and WF05 are recorded nowhere.** All four email nodes use
   `onError=continueErrorOutput`, and each error output is wired to its *success* next node or to a
   terminal NoOp:

   | Workflow | Email node | Error output goes to | `errors` row? |
   | --- | --- | --- | --- |
   | WF02 | `Owner Booking Notification` | `Respond 200 Booked` | none |
   | WF03 | `Callback Customer Email` | `Owner Email Present?` (success path) | none |
   | WF03 | `Owner Callback Notification` | `Schedule Next Follow-up` (success path) | none |
   | WF04 | `Owner Status Notification` | `Respond 200 Updated` | none |
   | WF05 | `Send Follow-up Email` | `End Failed Sends` (terminal) | none |

   This is deliberate failure isolation — the state changes are committed regardless — but the
   isolation is total: the error is swallowed, not deferred.

2. **WF06 cannot attribute errors to a lead.** `Build & Sanitize Error Record` hardcodes
   `business_id: ''` and `lead_id: ''`. Every workflow-level error row therefore has empty
   attribution, so `errors` → `leads` joins are impossible for the WF06 population. Whether the
   error trigger can expose the failed execution's item is **UNKNOWN** without an instance check.

Additionally, `resolved` is written `false` by all three error builders and is **never set true by
any node in any workflow** — so error closure is not tracked, and an open error and a fixed error
are indistinguishable in the sheet.

### 15. Error affected business outcome — NOT_MEASURABLE as a recorded claim
No field asserts that an error degraded an outcome. For WF01 you can build a correlation:
`errors.lead_id` → `leads` shows the lead's later state, so "this lead had an email failure, then
reached `no_response`" is derivable. But that is a join over two independently-written tables with
no ordering guarantee beyond timestamps, and it is still a correlation. For WF02–WF05 there is no
error row to join, so nothing is derivable at all.

**Recommendation: do not add a causal field.** Once row 14's recording gap is closed, the
`errors.lead_id` → `leads` join answers this adequately. A dedicated impact column would be new
schema for a question the join covers.

### 16. Final outcome traceable — INCOMPLETE
Four specific holes, all evidence-backed:

1. **Sweeper transitions are not in the trail.** `no_response` and every `followup_count` advance
   change `leads` without writing `status_updates` (row 13).
2. **Nothing closes a lead automatically.** `lost` and `closed` appear only when a human calls
   WF04. A lead that simply stops responding to follow-ups stays at whatever status it last had.
3. **"No outcome" is indistinguishable from "not yet closed."** A lead at `status='new'` with
   `followup_count=0` could be brand new, or could be a month-old lead that was never contacted.
   `created_at` bounds it but the tab never records a decision to stop.
4. **Rejected and duplicate traffic never appears at all** (F8, row 4), so the funnel has no top.

---

## Claims that remain NOT_MEASURABLE

Listed explicitly, as requested. For each: the reason, and whether the gap is closable from existing
production sources.

| # | Claim | Why not measurable | Closable from existing sources? |
| --- | --- | --- | --- |
| 1 | **Duplicate blocked** | Duplicate branch is a terminal respond node; no field written. "No duplicate" and "duplicate absorbed" are the same state (F8, F2) | No — needs a new record |
| 2 | **Initial response attempted** (successful sends, link-less tenants) | `booking_link_sent='false'` conflates sent / skipped / failed; `Update Booking Link` writes only on the email success output | No — needs a new record |
| 3 | **Follow-up eligible** | `Select Follow-up Candidates` output is never persisted; no sweep-run record | Partially — the current set is re-derivable, but no history |
| 4 | **Follow-up actually sent** — *attempts* | Failure path is a terminal NoOp with no `errors` row and no state change | No — needs a new record |
| 5 | **Error affected business outcome** — as causation | No impact field exists; WF02–WF05 errors are not recorded at all | Partially — for WF01 only, as correlation |
| 6 | **Lead entered** — total ingress | All reject branches write nothing (F8) | No — needs a new record |
| 7 | **Error occurred** — WF02–WF05 email failures | Error outputs wired to success paths / terminal NoOps | Yes — reuse the existing `errors` tab |
| 8 | **Error occurred** — attribution of workflow-level errors | WF06 hardcodes empty `business_id` / `lead_id` | **UNKNOWN** — depends on what the error trigger exposes |

**Partially measurable but materially incomplete** (measurability is not the issue; coverage is):
`Customer responded` (WF07 endpoint only, no out-of-band), `Booking received` (provider channel
only, no attendance), `no_response reached` (state present, transition unrecorded), `Final outcome
traceable` (four holes above).

---

## Minimum necessary instrumentation

Proposed only where the evidence is genuinely unavailable from existing production sources, per
the constraint. **Four items, and none of them requires a new general-purpose table.**

| # | Addition | Target | Justification | Priority |
| --- | --- | --- | --- | --- |
| 1 | Route the WF02–WF05 email **error outputs** to the existing `errors` tab | Reuse `errors` (4 nodes) | Closes 4 gaps at once (rows 8, 14, 15). WF01 already has the exact builder+append pattern to copy. This is closer to a bug fix than new instrumentation — the isolation is currently total. | **Highest** |
| 2 | WF05 appends a `status_updates` row on terminal transition | Reuse `status_updates` (1 node) | Puts `no_response` and cap-reached into the audit trail that exists to hold transitions (row 13). WF04's `Build Status Update Record` is the pattern to copy. | High |
| 3 | Sweep-run summary: timestamp, tenant scope, candidate count | One small record; no existing tab fits | Without it, "we stopped because nothing was due" and "the sweeper is broken" are indistinguishable (rows 7, 16). | Medium |
| 4 | Ingress record for reject and duplicate branches | New small record | Closes rows 1, 4 and the top of the funnel (F8, F2). Cannot be derived from any current field. | Medium |

Deliberately **not** proposed:

- **A causal "error affected outcome" field** — the `errors.lead_id` → `leads` join covers it once
  item 1 lands (row 15).
- **A per-send attempt table** — items 1 and 2 plus the existing `booking_link_sent` cover the
  WF01 and follow-up paths. The residual gap (row 2, link-less tenants) is real but narrow; if the
  pilot shows it matters, extend `errors` with a success-side record rather than building a new
  surface now.
- **Anything for `Customer responded` out-of-band** — not a measurement defect; it needs inbound
  email or telephony, which is outside this system and outside pilot scope.

### Is `measurement_events` necessary?

**No. This matrix does not prove it necessary, and recommends against it for the pilot.**

Each of the four genuine gaps maps to either an existing tab or a single small purpose-specific
record:

- WF02–WF05 email failures → the existing `errors` tab (item 1)
- sweeper terminal transitions → the existing `status_updates` tab (item 2)
- sweep-run history → one small summary record (item 3)
- reject/duplicate events → one small ingress record (item 4)

`measurement_events`, as contemplated in **F8**, would be a general-purpose event log intended to
absorb all of these at once. The evidence here does not justify that: **two** of the four gaps are
better served by writing to tables that already have owners, canonical field lists and an existing
write pattern (items 1 and 2), and the **remaining two** are small, single-purpose records that fit
neither (items 3 and 4). Two narrow purpose-specific records are not the same thing as one
general-purpose event store — each has a single consumer and needs no cross-cutting schema
governance, whereas the event store would be a new surface that every future gap would have to be
argued into. A general event log would also add a schema-governance burden to exactly the phase
where the engine's audit trail is still incomplete.

**F8's schema decision can therefore be closed as "not required for the pilot"** rather than
deferred indefinitely — but note this is a recommendation about the pilot's four known gaps, not a
claim that the engine will never need broader event capture. If items 1–4 are built and a fifth gap
appears that genuinely does not fit any existing tab, that is the moment to revisit the question.

---

## What was not changed

- No workflow JSON (`01`–`07`) was modified.
- No test file was modified or added.
- No `package.json` was modified.
- No `measurement_events` table, node, column or schema was created or proposed as a table.
- No node, table or column was added to the engine. Items 1–4 above are **recommendations**, not
  changes; none has been implemented.
- `reconcilekit/` and all other unrelated untracked paths were not touched.
- `FINDINGS.md` is modified from the prior documentation pass and remains uncommitted.
