# Lead Recovery Engine — Prospect Finder & Validation V1

Production-ready n8n workflow for prospect research and validation. Stops at **Verified Leads**. No outreach, no Hunter, no Apollo, no email.

**Pipeline:** Search Input → Google Places → Raw Leads → Verified Leads → Google Sheets scoring

---

## 1. Required Credentials

| Credential | Type in n8n | Configures |
|---|---|---|
| Google Sheets OAuth2 | `googleSheetsOAuth2Api` | All 5 Google Sheets nodes |
| Google Places API Key | Env variable (no n8n credential needed) | HTTP Request node |

---

## 2. Environment Variables

Set these in your n8n environment (`.env` file, Docker, or n8n Settings → Environment Variables):

```bash
# Required
GOOGLE_SHEET_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890   # from the spreadsheet URL
GOOGLE_PLACES_API_KEY=AIzaSyYourKeyHere                 # restricted to Places API
```

The spreadsheet ID is the long token in the URL: `https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`

**Never hard-code these values inside node parameters.** The workflow references them via `={{ $env.GOOGLE_SHEET_ID }}` and `={{ $env.GOOGLE_PLACES_API_KEY }}` — both are placeholders until you set the environment variables.

---

## 3. Google Places API Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable **Places API** (APIs & Services → Library → search "Places API")
4. Go to APIs & Services → Credentials → **Create Credentials → API Key**
5. **Restrict the key:**
   - API restrictions → "Restrict key" → check **Places API**
   - Application restrictions → set to your server IP/domain
6. Go to **Google Cloud → Billing** and enable a billing account

### Billing — Read This

| Item | Cost |
|---|---|
| Text Search (New) — Essential | **$32 per 1,000 requests** (0.032/request) |
| Place Details (NOT used here) | $17 per 1,000 calls |
| Place Photos (NOT used here) | $7 per 1,000 calls |

**Set up protections before running anything:**
1. Billing → Budgets → create a **$5/month budget** with alert notifications
2. APIs & Services → Quotas → sort by usage → set a **daily Places API request limit** (e.g., 100 requests/day)

One search = one API request = **$0.032**. The 50-prospect HVAC test = roughly **$0.16–$0.32** total.

---

## 4. Google Sheets Credential Setup

1. **Enable** the Google Sheets API in the same Google Cloud project
2. In n8n: **Settings → Credentials → Add Credential → Google Sheets OAuth2 API**
3. Google Cloud Console → APIs & Services → Credentials → **Create Credentials → OAuth Client ID** (Application type: Desktop app)
4. Copy the Client ID and Client Secret into n8n
5. The OAuth redirect URL n8n shows you must be added to the OAuth consent screen authorized redirect URIs
6. Click **Sign in with Google** and authorize
7. Assign this credential to the 7 Google Sheets nodes after import

---

## 5. Node-by-Node Explanation

### Setup Chain (runs once)

| # | Node | Type | What it does |
|---|---|---|---|
| 1 | **Manual Trigger** | Manual Trigger | Starts the workflow when you press Execute |
| 2 | **Initialize Configuration** | Code | Sets `LOW_COST_MODE = true`, `MAX_RESULTS_PER_SEARCH = 20` in workflow static data, plus run counters |
| 3 | **Read Verified Leads** | Google Sheets Read | Reads the whole **Verified Leads** tab to build a dedup memory |
| 4 | **Cache Dedup Keys** | Code | Normalizes every existing verified lead into a dedupe key (website → phone → name+city+state) and stores them in static data |
| 5 | **Read Search Inputs** | Google Sheets Read | Reads the whole **Search Inputs** tab |
| 6 | **Filter Pending Searches** | Code | Keeps only rows where `status` is `Pending` (or empty). If none, emits a marker item so the workflow can end cleanly |
| 7 | **Has Pending Searches?** | IF | **True** → loop. **False** → End (nothing to do) |

### Per-Search Loop

| # | Node | Type | What it does |
|---|---|---|---|
| 8 | **Loop Through Searches** | SplitInBatches | Processes one Search Input row per iteration (batch size 1). Output 0 = next item, output 1 = all done |
| 9 | **Set Status Running** | Google Sheets Update | Sets `status = Running` on the Search Input row (matched by `input_id`). Prevents double-processing if the workflow is re-executed |
| 10 | **Build API Query** | Code | Reads the original search row from the loop. Uses `search_query` if provided, else constructs `{niche} in {city}, {state}`. Computes the 8-field `X-Goog-FieldMask` payload for the paid-tier minimum |
| 11 | **Google Places API** | HTTP Request (POST) | Calls `https://places.googleapis.com/v1/places:searchText` with `X-Goog-Api-Key` and `X-Goog-FieldMask` headers and a `{"textQuery": ...}` JSON body. `neverError: true` + `fullResponse: true` so HTTP failures return status data instead of crashing |
| 12 | **API Success?** | IF | Checks HTTP **status code == 200** (**true** → process, **false** → error path). The legacy `status: "OK"` body field no longer exists in Places API (New) |

### Result Processing

| # | Node | Type | What it does |
|---|---|---|---|
| 13 | **Process Results** | Code | Normalizes each place into the exact Raw Leads schema. Reads the new `body.places` response shape (`displayName.text`, `formattedAddress`, `internationalPhoneNumber`, `websiteUri`, `userRatingCount`, `googleMapsUri`). Cleans website (strips protocol/www/trailing slash), phone (digits only), generates `lead_id`, builds an internal `dedupe_key`, removes in-batch duplicates, and **caps results at `min(target_count, MAX_RESULTS_PER_SEARCH)`** — `target_count = 1` yields at most 1 prospect. Never fabricates missing data — blanks stay blank |
| 14 | **Has Results?** | IF | **True** → write Raw Leads. **False** → mark search Completed with "no results" note (correctly fires when the API genuinely returned zero) |
| 15 | **Write Raw Leads** | Google Sheets Append | Writes all captured records to **Raw Leads** via autoMapInputData (exact column headers match the JSON keys) |
| 16 | **Dedup & Prepare Verified** | Code | Checks every lead against the cached verified-key set (historical dedup, using the internal `dedupe_key`), keeps only new ones, and emits **only the 17 underlying data columns** (A–O, V, W). The six derived columns `dedupe_key` (P), `has_website` (Q), `has_phone` (R), `urgent_niche` (S), `lead_score` (T) and `qualification_status` (U) are deliberately **not emitted** — they are Sheet-formula-owned |
| 17 | **Has New Verified?** | IF | **True** → write Verified Leads. **False** → all were duplicates → mark Completed with note |
| 18 | **Write Verified Leads** | Google Sheets Append | Appends only genuinely-new leads to **Verified Leads**. Because P–U (`dedupe_key`, `has_website`, `has_phone`, `urgent_niche`, `lead_score`, `qualification_status`) are absent from the JSON, those columns are left untouched so the Sheet formulas compute them |
| 19 | **Update Status Completed** | Google Sheets Update | Sets `status = Completed` (matched by `input_id`), writes any informational note. Loops back to node 8 for the next search |

### Error Path

| # | Node | Type | What it does |
|---|---|---|---|
| 20 | **Handle API Error** | Code | Reads the HTTP status code and `body.error.message`/`body.error.status` from the full response (e.g., `PERMISSION_DENIED`, `RESOURCE_EXHAUSTED`), increments the error counter, preserves `input_id` |
| 21 | **Update Status Failed** | Google Sheets Update | Sets `status = Failed` + writes the error to `notes`. **The row is preserved** — never deleted, never marked Completed |
| 22 | **End** | NoOp | Terminal. Silent no-op |

---

## 6. One-Prospect Test Procedure

> **The first test must use exactly ONE prospect.**

### Step 1 — Configure the Search Inputs tab

Add a single row:

| input_id | niche | city | state | country | search_query | target_count | status | priority | created_at | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| S-HVAC-001 | HVAC | Dallas | Texas | USA | HVAC repair | 1 | Pending | High | 2026-09-05 | First test |

**Only one row.** Leave `status` as `Pending`.

### Step 2 — Set environment variables

```bash
GOOGLE_SHEET_ID=<your id>
GOOGLE_PLACES_API_KEY=<your key>
```

### Step 3 — Import and connect credentials

1. n8n → Workflows → **Import from File** → select `Lead-Recovery-Engine-V1.json`
2. Open each Google Sheets node → confirm the OAuth2 credential is selected
3. Check **Set Status Running**, **Update Status Completed**, **Update Status Failed** — confirm they update by `input_id`

### Step 4 — Execute

Press **Execute Workflow** and watch.

### Step 5 — Verify

| Tab | Expect |
|---|---|
| Search Inputs | `status` = `Completed` |
| Raw Leads | At most `target_count` rows (1 for this test), exact schema, `source` = `Google Places`, `lead_id` present |
| Verified Leads | Same rows (deduped); P–U (`dedupe_key`, `has_website`, `has_phone`, `urgent_niche`, `lead_score`, `qualification_status`) **computed by Sheet formulas**, never written by n8n |
| Approved Outreach | Untouched |
| Outreach Log | Untouched |

### Step 6 — Re-run safety check

Execute again. The S-HVAC-001 row has `status = Completed`, so it is skipped. No duplicates are created.

### Step 7 — Scale up

After the test passes, you can:
- Add more Search Inputs rows (HVAC, then plumbing/roofing)
- Increase `target_count` as needed
- Larger batches process one search per iteration automatically

---

## 7. Cost Control

### Configuration Variables

| Variable | Location | Default | Effect |
|---|---|---|---|
| `LOW_COST_MODE` | Node 2 (Initialize Configuration) | `true` | Selective field mask (8 fields) — no photos, opening hours, reviews, or geometry |
| `MAX_RESULTS_PER_SEARCH` | Node 2 (Initialize Configuration) | `20` | Hard cap on businesses pulled per search |

### Why Costs Stay Low

1. **One API request per search** — Text Search (New), no chained Place Details calls
2. **Two-layer cap** — `target_count` from the sheet AND `MAX_RESULTS_PER_SEARCH` (20) in code; effective = `min(target_count, 20)`
3. **No enrichment** — Hunter, Apollo, email verification, scraping: not called, not installed
4. **Status gating** — `Running`/`Completed`/`Failed` states mean a search is never re-queried accidentally
5. **Error preservation** — failed searches stop, they are NOT retried automatically
6. **In-batch + historical dedup** — a business is captured exactly once

**Google Places requires a billing account.** It is not a free API. One paid-tier text-search request costs ~$0.032.

---

## 8. Error Handling

| Scenario | Behavior |
|---|---|
| API `PERMISSION_DENIED` (401/403) | Status → `Failed`, error written to `notes`, search preserved |
| API `RESOURCE_EXHAUSTED` (429) | Status → `Failed`, search preserved for later retry — no autoretry loop |
| API returns zero places (200, empty list) | Search → `Completed`, note "No businesses returned by API". No empty rows are created |
| HTTP timeout / network error | Same as API error (HTTP node is set to never throw) |
| All results are in-batch duplicates | `Completed`, note "All results were in-batch duplicates" |
| All candidates already exist in Verified Leads | `Completed`, note "All leads already exist in Verified Leads" |
| No pending rows at all | Workflow ends cleanly through the End node |

**Fail-safe principle:** the workflow never silently generates API spend and never fabricates leads. It stops, records why, and leaves the input intact.

---

## 9. How Formula Preservation Works

The **Verified Leads** sheet has formulas in:

| Column | Letter | Formula purpose |
|---|---|---|
| `dedupe_key` | P | May already be formula-driven |
| `has_website` | Q | Formula-driven |
| `has_phone` | R | Formula-driven |
| `urgent_niche` | S | Formula-driven |
| `lead_score` | T | **Formula: +20/+15/+20/+10/+15/+10/+10 = 100 max** |
| `qualification_status` | U | **Formula: 70–100 QUALIFIED / 50–69 REVIEW / 0–49 DISQUALIFIED** |

### The mechanism

The n8n **Write Verified Leads** node uses `autoMapInputData`, which maps JSON keys → sheet column headers. Because:

1. The **Dedup & Prepare Verified** Code node deliberately **does NOT emit** `dedupe_key`, `has_website`, `has_phone`, `urgent_niche`, `lead_score`, or `qualification_status` in its JSON, and
2. `autoMapInputData` only touches columns whose headers match JSON keys,

columns **P through U are never written by n8n**. The Sheet formulas are the only writer of those columns.

### Limitation (formulas copied down, not array formulas)

Your formulas are populated down 500+ rows. Two situations:

- **Append lands inside rows 2–500** → the formula cells already exist there → scoring works with zero intervention. For the 50-prospect V1 test this is the normal case.
- **Append lands beyond row 500** → the new row has no formula cells of its own.

**Safest fixes (pick one):**

1. **Convert T2 and U2 to ARRAYFORMULA** so every new row calculates automatically, e.g. `=ARRAYFORMULA(IF($A$2:$A="",, IF($P$2:$P="","", ...)))` — this is the permanent solution.
2. **Manually drag the formula column down** after a batch that crosses row 500.
3. Add a tiny follow-up n8n step later that copies formulas from the row above into each appended row (documented below if you want it).

For now, with 50 prospects, situation 1 holds and **nothing is overwritten**.

---

## 10. Adding Hunter/Apollo Enrichment Later (Without Redesign)

The core loop is built so enrichment slots in without touching search, Places, Raw Leads, or dedup.

### Current stopping point

```
Verified Leads  ← workflow stops here
        ↓
   (empty)
        ↓
Approved Outreach
```

### Future chain (do NOT build now)

```
Verified Leads
    ↓
Manual review (human, in-sheet)
    ↓
Hunter / Apollo enrichment   ← insert here
    ↓
Approved Outreach            ← future approval gate
```

### How to insert the enrichment stage

1. **New node after "Update Status Completed" is not where it goes.** Enrichment belongs between Verified Leads and Approved Outreach, which is outside this workflow today.
2. When you build V2, create a **separate n8n workflow** triggered on Verified Leads (e.g., a schedule of "rows where `manual_review_notes` is empty") that:
   - Reads only rows the human approved (a new `approved`/`reviewed` flag column you add to the sheet — allowed, since this is enrichment, not a V1 rename)
   - Calls Hunter (`https://api.hunter.io/v2/domain-search`) or Apollo (`https://api.apollo.io/v1/people/match`)
   - Writes results back to a new `email`-style column
   - One endpoint at a time, gated behind a `FULL_ENRICHMENT_MODE` flag exactly like `LOW_COST_MODE` today

### Rules that keep V1 clean

- Do **not** add Hunter/Apollo nodes into this workflow file
- Do **not** remove the `LOW_COST_MODE` / `MAX_RESULTS_PER_SEARCH` variables
- Keep the future enrichment cost behind an explicit flag, defaulting to `false`
- Never let enrichment touch `lead_score` or `qualification_status` (they stay formula-owned)

---

## 11. Deployment Checklist

- [ ] Places API enabled, billing account active
- [ ] API key created and restricted to Places API
- [ ] Daily quota set (e.g., 100 req/day) + $5 budget alert
- [ ] Google Sheets API enabled
- [ ] OAuth2 credential created and connected in n8n
- [ ] `GOOGLE_SHEET_ID` and `GOOGLE_PLACES_API_KEY` set in n8n env
- [ ] Sheet contains exactly the 5 tabs, exact column headers
- [ ] Verified Leads formulas present in T and U (down 500+ rows)
- [ ] Workflow imported; credentials attached to all 7 Sheets nodes
- [ ] One-row HVAC test executed and verified (Section 6)
- [ ] Re-run confirms dedup + status gating
- [ ] Error path verified with a bad API key

---

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| `PERMISSION_DENIED` | API key restricted wrongly; free the key or add Places API to its allowlist |
| `NOT_FOUND` on key | Billing not enabled on the project |
| `RESOURCE_EXHAUSTED` | Lower `MAX_RESULTS_PER_SEARCH`/`target_count`, wait, or raise quota |
| No rows written to Verified Leads | Open the Google Sheets nodes, confirm the OAuth2 credential is selected |
| `lead_score` blank on new rows | Formula cells beyond row 500 — see Section 9 |
| Search stays stuck `Running` | A previous run crashed mid-way; manually set back to `Pending` or `Failed` |
| Duplicate leads | Record verified leads appear after the 1st run? Check `Cache Dedup Keys` output on a manual test run |

---

*Version 1 — 2026-09-05. Scope: prospect finder + validation. Stops at Verified Leads.*
*Patched 2026-09-05: Places API (New) endpoint, 8-field mask, target_count cap, P–U fully formula-owned.*