# APPROVED-OUTREACH-HANDOFF-v0.1

**Artifact:** `Approved Outreach Handoff V1.json` (n8n workflow) · **Spec:** Approved Outreach Handoff Specification v0.1
**Scope declared against repository state:** 2026-09-10 (branch `pre-cleanup-2026-09-08`)

---

## 1. Purpose

Create the **approval gate** between the prospecting pipeline and any future outreach system:

```
Verified Leads (source of truth)  →  Approved Outreach (approval ledger)
```

The workflow validates, filters, and copies records from **Verified Leads** into **Approved Outreach** exactly once per `lead_id`. It **does not** enrich, message, send, schedule, or follow up anything. Approving a lead for outreach is a prerequisite step only; the approval ledger is **not** a send queue.

This is a new, isolated workflow. The live prospect pipeline (`Lead Recovery Engine — Prospect Finder & Validation V1.json`) is **not** modified.

## 2. Boundary

| Included | Excluded |
|---|---|
| Read Verified Leads | Any provider call (Foursquare / OSM / Places / etc.) |
| Qualification gate (eligibility) | Search Inputs re-fetch or pipeline re-runs |
| Dedupe against existing approvals | Email / contact enrichment (Hunter, Apollo, …) |
| Append to Approved Outreach | LinkedIn lookup |
| Idempotent, retry-safe writes | Outreach, messaging, sending, SMS, WhatsApp, CRM sync, follow-ups |

The workflow is **sheet-state-driven**: it operates on what is already persisted in Google Sheets. No provider dependency, no scheduling.

## 3. Input (consumed, never written)

Google Sheets tab **Verified Leads** (same spreadsheet as the pipeline, `lead_id`, `business_name`, `niche`, `city`, `state`, `country`, `address`, `phone`, `website`, `rating`, `review_count`, `google_maps_url`, `business_type`, `source`, `search_input_id`, `dedupe_key`, `has_website` (formula), `has_phone` (formula), `target_niche` (formula), `score` (formula), `qualification_status` (formula), `verified_at`, `notes`, `manual_review_notes`).

**Ownership:** formula-owned fields (`has_website`, `has_phone`, `target_niche`, `score`, `qualification_status`) are computed by the pipeline's ARRAYFORMULA. This workflow **only consumes** them — it never writes to Verified Leads, and never re-computes or lowers the qualification threshold.

## 4. Eligibility

A lead is eligible for the approval ledger **only if all** of the following hold:

- `qualification_status` (uppercased) equals `QUALIFIED`
- `business_name` non-empty
- `city` non-empty
- `state` non-empty
- `country` non-empty
- contact path present: `website` **or** `phone` non-empty

`REVIEW` and `DISQUALIFIED` never enter Approved Outreach. Missing any required field excludes the lead. Thresholds are **not** changed and the score is **not** recalculated here.

## 5. Mapping (Verified Leads → Approved Outreach)

| Approved Outreach column | Source / default |
|---|---|
| `lead_id` | Verified `lead_id` |
| `business_name` | Verified `business_name` |
| `niche` | Verified `niche` |
| `city` / `state` / `country` | Verified fields |
| `website` | Verified `website` |
| `phone` | Verified `phone` |
| `lead_score` | Verified `score` |
| `qualification_status` | Verified `qualification_status` |
| `email`, `contact_name`, `contact_title`, `email_source`, `email_verified`, `contact_form`, `linkedin_url` | `''` (enrichment is out of scope) |
| `outreach_channel` | `''` |
| `outreach_status` | `not_ready` (owning system's initial state) |
| `approved_at` | ISO timestamp of this run |
| `notes` | `''` |

**Write contract:** exactly the 21 Approved Outreach columns above are written via an explicit `defineBelow` mapping. No formula-owned fields, no `verified_at`, and no control/observability fields (`_control`, `_noNewApproved`) ever reach the sheet.

## 6. Idempotency & Dedupe

- Canonical key: **`lead_id`** — trim + compare.
- On every run the workflow loads the existing `lead_id`s already in Approved Outreach (the sheet is the **source of truth**; no `staticData`, no cached state).
- **In-batch duplicates** also collapse — the same `lead_id` appearing twice in one run is written once.
- A second run after a successful append writes **0** rows.

## 7. Failure Behavior

- No partial mutation: if the write fails, nothing is committed.
- Retries are safe: a re-run sees the same input and either skips (already approved) or inserts what was missing — never a duplicate.
- The no-op path returns an internal marker `{"_noNewApproved": true, "_message": "No new eligible leads for Approved Outreach"}` and routes to a `No-Op End` node — **no sheet row is created**.

## 8. Observability

Each run carries internal counters (not written to the sheet):

- `verified_examined`, `eligible`
- `ineligible_not_qualified`, `ineligible_missing_business_name`, `ineligible_missing_city`, `ineligible_missing_state`, `ineligible_missing_country`, `ineligible_no_contact_path`
- `eligible_incoming`, `already_approved`, `duplicate_in_batch`, `newly_approved`

No credentials, API keys, or personal data are logged.

## 9. Acceptance Criteria

Validated by `tests/handoff-workflow.test.js` (`npm test` in this directory; Node `node:test`, zero runtime dependencies). The tests execute the **real node code** from `Approved Outreach Handoff V1.json`:

| ID | Case |
|---|---|
| T1 | Qualified lead with contact info enters with correct mapping |
| T2 | `REVIEW` excluded |
| T3 | `DISQUALIFIED` excluded |
| T4 | No website **and** no phone excluded |
| T5 | Already-approved `lead_id` skipped |
| T6 | Mixed batch — existing skipped, new inserted |
| T7 | Repeat run inserts zero |
| T8 | Source integrity — Verified Leads only read, no formula/control leakage, write map = exactly 21 columns |
| T9 | Failure recovery / retry never duplicates |
| T10 | No outreach side effects — no send/log/emit beyond the Approved sheet |

Plus structural validation: JSON importability (unique node names/ids, valid connections), provider independence, no hardcoded secrets, no `staticData`/`$env` in node code, sheet/reference checks.

Also validated with `node --test` after any edit: the workflow JSON must parse and stay within the declared node set.

## 10. Validation

```powershell
npm test          # runs node --test "tests/*.test.js"
```

Import `Approved Outreach Handoff V1.json` into n8n, confirm the Google Sheets credential is linked, then hit **Execute workflow** (manual trigger). Verify:

1. No change to **Verified Leads**.
2. Only missing `lead_id`s appended to **Approved Outreach**.
3. Re-run → 0 new rows.

## 11. Non-Goals (explicit)

- Profiling, enrichment, or verification of contacts.
- Any send channel or outreach cadence. This ledger deliberately contains **no** outreach instructions.
- Changes to the prospect pipeline, README rewrite (the `n8n-lead-recovery/README.md` still documents the former Google Places pipeline and is a known documentation debt).

## 12. Open Risks

- The "Approved Outreach" tab is expected to exist with the header row named exactly as in Section 3 (spec is canonical). If the tab is missing/renamed, the workflow surfaces a n8n read error — no data loss.
- The live prospect workflow's Foursquare API key is no longer hardcoded: the `Foursquare Places API` node now references a named `httpHeaderAuth` n8n credential (`name: "Foursquare API"`) via `=Bearer {{$credentials.value}}`. The credential must be created in n8n (value = the bare API token) and attached after import. Reference: `Hygiene Workstream H2`.