# Lead Recovery Engine — Prospect Finder & Validation V1

Production-ready n8n workflow for prospect research and validation. Stops at **Verified Leads**. No outreach, no Hunter, no Apollo, no email.

**Pipeline:** Search Input → Foursquare Places + OpenStreetMap Overpass → Raw Leads → Verified Leads → Google Sheets scoring

**Providers:** the live workflow queries **Foursquare Places API** and **OpenStreetMap Overpass API** in parallel, merges the two result streams, dedupes, and writes Verified Leads. (This README describes the current Foursquare/OSM pipeline; the former Google Places-based version was removed in the hygiene rebase.)

---

## 1. Required Credentials

| Credential | Type in n8n | Configures |
|---|---|---|
| Google Sheets OAuth2 | `googleSheetsOAuth2Api` | The 7 Google Sheets nodes |
| Foursquare API | `httpHeaderAuth` (named `Foursquare API`) | The **Foursquare Places API** HTTP node (`Authorization: Bearer <token>` via `=Bearer {{$credentials.value}}`) |
| OpenStreetMap Overpass | — (public endpoint, no credential) | The **OpenStreetMap Overpass API** HTTP node |

See `docs/CREDENTIALS.md` for the full nine-workflow credential inventory and import-side attach checklist.

---

## 2. Environment Variables

The workflow itself needs **no environment variables**. Google Sheets auth is a stored n8n credential; the Foursquare token lives in the n8n `httpHeaderAuth` credential (never in a file). `GOOGLE_SHEET_ID` lives in each Sheets node's parameters (insert $env if you prefer).

Live-runner environments for the downstream workflow boundaries are separate and are documented in `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` and each workflow spec.

**Never hard-code credentials or API keys in node parameters or committed files.** The Foursquare node now references the named credential instead of a hardcoded bearer token (Hygiene H2).

---

## 3. Google Sheets Credential Setup

1. Enable the Google Sheets API in a Google Cloud project.
2. n8n → **Settings → Credentials → Add Credential → Google Sheets OAuth2 API**.
3. Google Cloud Console → **Create Credentials → OAuth Client ID** (Desktop app).
4. Enter the client id/secret; add the n8n redirect URI to the OAuth consent screen.
5. Authorize with Google; attach this credential to the 7 Sheets nodes (or ensure the exported credential id `rOKhG0ESKifN5zy2` is recreated).

### Foursquare credential setup (Hygiene H2 — replaces hardcoded token)

1. Create an n8n credential of type **HTTP Header Auth** named exactly `Foursquare API`.
2. Set `name = Authorization`, `value = <your bare Foursquare API token>` (no `Bearer ` prefix).
3. The **Foursquare Places API** node's header `Authorization` = `=Bearer {{$credentials.value}}`, producing `Authorization: Bearer <token>`. A default Foursquare Places token works for Places Search.

---

## 4. Node-by-Node Explanation

### Setup Chain (runs once)

| Node | Type | What it does |
|---|---|---|
| **Manual Trigger** | Manual Trigger | Starts the workflow when you press Execute |
| **Initialize Configuration** | Code | Sets `LOW_COST_MODE = true`, `MAX_RESULTS_PER_SEARCH` + run counters in workflow static data |
| **Read Verified Leads** | Google Sheets Read | Reads the whole **Verified Leads** tab to build dedup memory |
| **Cache Dedup Keys** | Code | Normalizes existing verified leads into dedupe keys (website → phone → name+city+state) into static data |
| **Read Search Inputs** | Google Sheets Read | Reads the whole **Search Inputs** tab |
| **Filter Pending Searches** | Code | Keeps only rows with `status` `Pending` (or empty); emits a marker item so the workflow ends cleanly when nothing is pending |
| **Has Pending Searches?** | IF | **True** → loop. **False** → End |

### Per-Search Loop

| Node | Type | What it does |
|---|---|---|
| **Loop Through Searches** | SplitInBatches | One Search Input row per iteration. Output 0 = all done, output 1 = next item |
| **Set Status Running** | Google Sheets Update | Sets `status = Running` (matched by `input_id`) to prevent double-processing |
| **Build FSQ API Query** | Code | Builds the Foursquare Places request: `near = {city}, {state}`, `fsq_category_ids` (per-niche category ids, e.g. HVAC `63be6904847c3692a84b9b56`), `limit`, `fields` (id, name, categories, location, tel, website) |
| **Foursquare Places API** | HTTP Request (GET) | Calls `https://places-api.foursquare.com/places/search`. Auth via the `httpHeaderAuth` credential. API version header `X-Places-Api-Version: 2025-06-17`. On HTTP error the node throws → workflow execution fails (no graceful per-row fallback) |
| **Process FSQ** | Code | Normizes FSQ results to Raw Leads schema: keeps businesses matching the niche category/positive patterns, rejects credit/roofing/plumbing/flooring/painting/insulation/foundation/concrete/carpet matches, computes `lead_id` + internal `dedupe_key`, removes in-batch duplicates, caps to `min(target_count, MAX_RESULTS_PER_SEARCH)` |
| **Build OSM API Query** | Code | Builds the Overpass query (`area["name"="{city}"]`, per-niche tags like `craft=hvac`, `shop=heating`) with a candidate pool = `min(max(5 × target_count, 20), MAX_RESULTS_PER_SEARCH)` |
| **OpenStreetMap Overpass API** | HTTP Request (POST) | POSTs to `https://overpass.kumi.systems/api/interpreter`. `fullResponse: true`, `onError: continueErrorOutput` → HTTP/transport errors go to the error branch (output 1); success goes to output 0 |
| **API Success?** | IF | Checks OSM **HTTP status == 200**. **True** → process; **False** → Handle API Error |
| **Process OSM** | Code | Normalizes Overpass elements (buildings/businesses with name/contact/opening tags) to the same Raw Leads schema, preserving search context, and caps like Process FSQ |
| **Merge** | Merge | Joins the FSQ and OSM streams (both inputs) into one Raw Leads item stream |
| **Write Raw Leads** | Google Sheets Append | Writes the merged records to **Raw Leads** via autoMapInputData |
| **Dedup & Prepare Verified** | Code | Checks against cached verified-key set (historical dedup), keeps only new, emits **only the 17 underlying data columns** (A–O, V, W). The six derived columns `dedupe_key` (P), `has_website` (Q), `has_phone` (R), `urgent_niche` (S), `lead_score` (T), `qualification_status` (U) are deliberately **not emitted** — they are Sheet-formula-owned |
| **Has New Verified?** | IF | **True** → Prepare Verified Sheet Row. **False** → all duplicates → mark Completed with note |
| **Prepare Verified Sheet Row** | Code | Shapes the final Verified Leads row payload (schema row before append) |
| **Write Verified Leads** | Google Sheets Append | Appends only genuinely-new leads to **Verified Leads**; P–U stay untouched so Sheet formulas compute them |
| **Update Status Completed** | Google Sheets Update | Sets `status = Completed` (+ any note), loops back to the next search |

### Error Path

| Node | Type | What it does |
|---|---|---|
| **Handle API Error** | Code | Reads the failed OSM response status/body, preserves `input_id` |
| **Update Status Failed** | Google Sheets Update | Sets `status = Failed` + error to `notes`. **Row preserved** — never deleted, never marked Completed |
| **End** | NoOp | Terminal (silent) |

**Dual-provider error semantics (important):** OSM failures are caught and recorded per-row (workflow continues looping). Foursquare failures are **uncaught** — the HTTP node throws on non-2xx and the whole execution fails. There is no Foursquare graceful error branch in V1; a FSQ outage stops the run (documented limitation).

---

## 5. One-Prospect Test Procedure

> **The first test must use exactly ONE prospect.**

1. **Search Inputs** — add a single row:
   `S-HVAC-001 | HVAC | Dallas | Texas | USA | HVAC repair | 1 | Pending | High | 2026-09-05 | First test`
   (only one row; `status` = `Pending`).
2. **Credentials** — ensure the Sheets OAuth2 credential is attached to the 7 Sheets nodes and the `Foursquare API` `httpHeaderAuth` credential exists (Section 3).
3. **Import** — n8n → Workflows → **Import from File** → `Lead Recovery Engine — Prospect Finder & Validation V1.json`; confirm credential assignment.
4. **Execute** — press **Execute Workflow**.
5. **Verify**:

   | Tab | Expect |
   |---|---|
   | Search Inputs | `status` = `Completed` |
   | Raw Leads | At most `target_count` rows (1 here), exact schema, `source` = `Foursquare` and/or `OpenStreetMap`, `lead_id` present |
   | Verified Leads | Same rows (deduped); P–U (`dedupe_key`, `has_website`, `has_phone`, `urgent_niche`, `lead_score`, `qualification_status`) **computed by Sheet formulas**, never written by n8n |
   | Approved Outreach | Untouched |
   | Outreach Log | Untouched |

6. **Re-run safety check** — execute again: the `S-HVAC-001` row is `Completed`, so it is skipped. No duplicates.
7. **Scale up** — add more Search Inputs rows (HVAC, plumbing, roofing, electrical, pest) and raise `target_count` as needed.

---

## 6. Cost Control

| Variable | Location | Default | Effect |
|---|---|---|---|
| `LOW_COST_MODE` | Initialize Configuration | `true` | Minimal Foursquare `fields` payload; no photos/reviews/geometry |
| `MAX_RESULTS_PER_SEARCH` | Initialize Configuration | `20` | Hard cap on businesses pulled per search (and the OSM candidate pool ceiling) |

Why costs stay low:

1. **Foursquare** — Places Search is on free-tier quota for typical volumes. `target_count` and `MAX_RESULTS_PER_SEARCH` cap requests and results; one request per search, no chained Place Details calls.
2. **OpenStreetMap Overpass** — the public Overpass instances are free (be considerate of their rate limits; the query is `[out:json][timeout:60]` and lives only for the search's bounds).
3. **No enrichment** — Hunter, Apollo, email verification, scraping: not called, not installed.
4. **Status gating** — `Running`/`Completed`/`Failed` states mean a search is never re-queried accidentally.
5. **In-batch + historical dedup** — a business is captured exactly once.

---

## 7. Error Handling

| Scenario | Behavior |
|---|---|
| Foursquare HTTP error (non-2xx) | HTTP node throws → execution fails (no per-row fallback; documented limitation) |
| Overpass HTTP/transport error | Error branch → `Handle API Error` → `status = Failed` + `notes`; row preserved; loop continues |
| Overpass returns non-200 status | `API Success?` → false → Failed path (as above) |
| Both providers return zero leads | Search → `Completed`, note "No results"; no empty rows |
| All results are in-batch duplicates | `Completed`, note "All results were in-batch duplicates" |
| All candidates already exist in Verified Leads | `Completed`, note "All leads already exist in Verified Leads" |
| No pending rows at all | Workflow ends cleanly through the End node |

**Fail-safe principle:** the workflow never fabricates leads, never silently re-queries a `Completed` search, and preserves failed rows for inspection.

---

## 8. How Formula Preservation Works

The **Verified Leads** sheet has formulas in columns P–U: `dedupe_key` (P), `has_website` (Q), `has_phone` (R), `urgent_niche` (S), `lead_score` (T, +20/+15/+20/+10/+15/+10/+10 = 100 max), `qualification_status` (U, 70–100 QUALIFIED / 50–69 REVIEW / 0–49 DISQUALIFIED).

Because **Dedup & Prepare Verified** and **Prepare Verified Sheet Row** never emit those six keys and `autoMapInputData` only writes columns whose headers match JSON keys, **P–U are never written by n8n** — the Sheet formulas are their only writer.

**Limitation:** formulas are populated down 500+ rows. Appends beyond row 500 land in rows with no formulas. Safest fixes: convert T2/U2 to `ARRAYFORMULA`, manually drag the formula column down after a crossing batch, or add a follow-up n8n step that copies formulas from the row above.

---

## 9. Adding Hunter/Apollo Enrichment Later (Without Redesign)

The core loop stops at Verified Leads. Future enrichment belongs in a **separate workflow** triggered on verified rows (e.g., rows where a manual-review flag is empty): read only approved rows, call one endpoint at a time (Hunter/Apollo) behind a `FULL_ENRICHMENT_MODE` flag (default `false`), and write result columns it owns. Do **not** add enrichment nodes to this workflow; do **not** remove the `LOW_COST_MODE` / `MAX_RESULTS_PER_SEARCH` variables; never let enrichment write `lead_score` or `qualification_status`.

---

## 10. Deployment Checklist

- [ ] Google Sheets API enabled; OAuth2 credential created and attached to the 7 Sheets nodes
- [ ] `Foursquare API` `httpHeaderAuth` credential created (name = `Foursquare API`, value = bare token); no token in any file
- [ ] Overpass public endpoint reachable (no credential required)
- [ ] Sheet contains exactly the expected tabs with exact column headers
- [ ] Verified Leads formulas present in T and U (down 500+ rows)
- [ ] Workflow imported; credentials attached
- [ ] One-row HVAC test executed and verified (Section 5)
- [ ] Re-run confirms dedup + status gating
- [ ] Error path verified (bad FSQ token → execution fails loudly; Overpass reachable)

---

## 11. Troubleshooting

| Symptom | Fix |
|---|---|
| Foursquare HTTP 403/401 | `Foursquare API` credential wrong/missing/rate-limited → recreate in n8n Settings → Credentials; confirm the node references it |
| Foursquare HTTP 429 | Free-tier rate limit → wait or lower `target_count`/`MAX_RESULTS_PER_SEARCH`; the run will have failed (uncaught) — rerun pending rows |
| Overpass timeout / 504 | Public Overpass instance busy → retry; the run marks the row `Failed` and continues, so re-run pending rows |
| No rows written to Verified Leads | Open the Sheets nodes → confirm the OAuth2 credential is selected |
| `lead_score` blank on new rows | Formula cells beyond row 500 — see Section 8 |
| Search stays stuck `Running` | A previous run crashed mid-way; manually set back to `Pending` or `Failed` |
| Duplicate leads after 1st run | Check `Cache Dedup Keys` output on a manual test run |

---

## 12. Pipeline Ecosystem (all 9 workflows)

This project is the first stage of a nine-workflow Lead Recovery Engine. Each downstream workflow has its own spec + offline test suite + live runner (see README links below and `docs/CREDENTIALS.md` for credentials):

1. **Prospect Finder & Validation V1** — `Lead Recovery Engine — Prospect Finder & Validation V1.json` (this workflow)
2. **Approved Outreach Handoff V1** — `APPROVED-OUTREACH-HANDOFF-v0.1.md` + `Approved Outreach Handoff V1.json`
3. **Outreach Queue & Planning V1** — `OUTREACH-QUEUE-AND-PLANNING-v1.md` + `Outreach-Queue-and-Planning V1.json`
4. **Outreach Execution & Delivery V1** — `OUTREACH-EXECUTION-AND-DELIVERY-v1.md` + `Outreach-Execution-and-Delivery V1.json`
5. **Execution Reconciliation V1** — `OUTREACH-EXECUTION-RECONCILIATION-v1.md` + `Execution-Reconciliation V1.json`
6. **Outreach Response Capture V1** — `OUTREACH-RESPONSE-CAPTURE-v1.md` + `Response-Capture V1.json`
7. **Outreach Response Reconciliation V1** — `OUTREACH-RESPONSE-RECONCILIATION-v1.md` + `Response-Reconciliation V1.json`
8. **Response Interpretation V1** — `OUTREACH-RESPONSE-INTERPRETATION-v1.md` + `Response-Interpretation V1.json` (spec v1.6 includes the Phase 6 environment-gate result; see `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` to execute A–F live)
9. **Run Reconciliation and Reporting V1** — `RUN-RECONCILIATION-AND-REPORTING-v1.md` + `Run-Reconciliation-and-Reporting V1.json`

**Verification infrastructure:** `GOOGLE-SHEETS-VERIFICATION-HARNESS-v0.1.md` (deterministic TEST-AOH-* fixture harness), `scripts/verify-frozen.js` + `frozen-artifacts.manifest.json` (`npm run verify:frozen` — freezes the 7 Phase-1–5 artifacts against their recorded SHA-256), and `.github/workflows/test.yml` (CI: `npm test` + `npm run verify:frozen`). Run the full offline suite with `npm test` (637 tests).

---

*Version 2 (hygiene rebase) — 2026-09-12. Pipeline: Foursquare + Overpass → Raw Leads → Verified Leads. Foursquare token moved to a named n8n credential (H2). Supersedes the Google Places-era v1 README.*