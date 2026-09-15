# Prospect Finder — Live Isolation Matrix Report

**Date:** 2026-09-15
**Workflow:** `WcUgtTPiKXPL0BLH` (Prospect Finder & Validation V1)
**Container:** `serene_swartz` (n8n 2.38.7, `serene_swartz_data` volume)
**Artifact SHA-256:** `2581898191D3534E228FAA57F53E2AF847EFDD68212CD642B69B4B78B79A01EE` (81,719 bytes)
**Report scope:** Prompt B — Three-isolation-case live matrix

---

## §1 Preflight Confirms

| Check | Status | Detail |
|-------|--------|--------|
| Container running | ✅ | n8n 2.38.7, `serene_swartz`, volume `serene_swartz_data` |
| Workflow inactive | ✅ | `WcUgtTPiKXPL0BLH`, active=0 |
| 32 nodes present | ✅ | 32 nodes in graph |
| A.8 fixes present | ✅ | Merge `combineBy: combineAll`, GPL `sendHeaders:true`/`specifyBody:"json"`/`jsonBody` |
| Credentials referenced | ✅ | Sheets `JL2ZSG2FTSoGKMXc`, FSQ `71soVf1y0Y8VwM9x` (httpHeaderAuth) |
| Credential entities exist | ✅ | Both confirmed in DB |
| GOOGLE_PLACES_API_KEY set | ✅ | 39 chars, passes into container (verified with `echo length=${#GOOGLE_PLACES_API_KEY}`) |
| No stray Pending rows | ✅ | Baseline: 0/0/0 before seeding |
| Merge wiring | ✅ | 5 inputs wired: Process FSQ→0, Process OSM→1, Process GPL→2, GPL Error Envelope→3, FSQ Error Envelope→4; output→Filter Empty Envelopes |

---

## §2 Baseline Counts (Post-Seed, Pre-Run)

| Tab | Data Rows | Notes |
|-----|-----------|-------|
| Search Inputs | 2 | ISO-001 + ISO-002 (ISO-003 deleted for sequencing) |
| Raw Leads | 0 | Header-only |
| Verified Leads | 0 | Header-only |

**Seeds (A2:K4 in Search Inputs):**
- `TEST-GPL-LIVE-ISO-001` niche=`test-iso-gpl-niche`, city=`Testville`, target_count=5, status=`Pending`
- `TEST-GPL-LIVE-ISO-002` niche=`qwertyuiop-zz-9-999`, city=`Testville`, target_count=5, status=`Pending`

---

## §3 Per-Case Results

### ISO-001 (`test-iso-gpl-niche`, Testville)

**Execution:** exec5 (id=5, CLI mode, 2026-09-15 13:27:08 → 13:36:53, status=`success`, ~9.5 min)

| Provider | Outcome | Evidence |
|----------|---------|----------|
| Google Places API | **403 PERMISSION_DENIED** | `error.code=403`, `status=PERMISSION_DENIED`, `message="The caller does not have permission"`. Env var fix worked (API was called), but key lacks Places API enablement on its GCP project. |
| Foursquare Places API | **ERR_INVALID_HTTP_TOKEN** | `Header name must be a valid HTTP token ["Foursquare API"]`. Node.js rejects the header name `"Foursquare API"` (contains space) before any network call. |
| OpenStreetMap Overpass API | **200 OK, empty elements** | `elements: []` returned. Query `"test-iso-gpl-niche in Testville, "` is natural-language; Overpass uses structured QL. No nodes found. Execution time: 555s (~9 min). |

**Error envelopes created:**
- GPL: `source=google_places:error`, `_provider=google_places`, `_errorMessage="Google Places API error: 403 - PERMISSION_DENIED"`
- FSQ: `source=foursquare:error`, `_provider=foursquare`, `_errorMessage="Foursquare API error: Unknown API error"`

**Merge output:** `main[0] = 0 items`. Error envelopes on inputs 3+4 were **dropped** because the Cartesian product of `combineAll` requires all inputs to have at least one item. Inputs 0+1+2 (success outputs) were empty → total combinations = 0.

**Raw Leads rows written:** 0
**Verified Leads rows written:** 0
**Search Inputs status after run:** `Pending` (Set Status Running writes `=$json.status` = "Pending", known benign bug — see §5)

**Loop status:** `lastNodeExecuted = Merge`. ISO-002 **never processed** — loop broke when Merge output nothing; no items returned to SplitInBatches to trigger next iteration.

### ISO-002 (`qwertyuiop-zz-9-999`, Testville)

**Execution:** Not processed. Loop broke at Merge during ISO-001 iteration.

| Provider | Outcome | Evidence |
|----------|---------|----------|
| All providers | Skipped | No API calls made. Search Inputs row remains `Pending`. |

**Raw Leads rows written:** 0
**Verified Leads rows written:** 0

### ISO-003 (`test-iso-gpl-fail`, Testville, invalid API key)

**Execution:** Not yet executed. Row deleted from Search Inputs for sequencing (ISO-003 requires `GOOGLE_PLACES_API_KEY=invalid-key-for-iso-003`).

**Raw Leads rows written:** 0
**Verified Leads rows written:** 0

---

## §4 ISO-004 Deferral Rationale

ISO-004 (FSQ credential manipulation) is deferred per the Prompt B spec. Every case already produces a `foursquare:error` envelope because the FSQ credential's header name `"Foursquare API"` (space) causes `ERR_INVALID_HTTP_TOKEN` at the HTTP client layer. This is equivalent to (and more deterministic than) a 401 invalid-token failure — the error occurs before any network call, making it credential-value-independent.

---

## §5 Deviations (Observed vs. Expected)

| # | Deviation | Severity | Root Cause | Fix Required |
|---|-----------|----------|------------|--------------|
| D1 | **Merge `combineAll` kills error envelopes** when any success input is empty | 🔴 Blocking | n8n Merge v3 `combineBy: combineAll` computes Cartesian product across all 5 inputs. If inputs 0+1+2 (success) have 0 items, the product is empty regardless of inputs 3+4 (error envelopes). Error envelopes exist internally but are silently dropped before writing. | Requires workflow modification: route error envelopes around the Merge, or use `includeOtherSources` option (if available in n8n 2.x), or split Merge into separate success/error paths. **Prompt B forbids artifact modification.** |
| D2 | **GPL 403 PERMISSION_DENIED** | 🟡 Key issue | `GOOGLE_PLACES_API_KEY` lacks Places API enablement on its GCP project. Env var fix (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`) resolved the expression evaluation issue. API was successfully called and returned a valid (denied) response. | User must enable Places API on the GCP project for this key. Not a workflow bug. |
| D3 | **FSQ ERR_INVALID_HTTP_TOKEN** | 🟢 Expected behavior | httpHeaderAuth credential stores header name `"Foursquare API"` (space). Node.js `http.validateHeaderName` rejects it. Produces `foursquare:error` envelope as designed. | None — credential is placeholder per spec (ISO-004 deferred). |
| D4 | **OSM Overpass API empty elements** | 🟡 Query format | `fsq_near`-style natural language query fed to Overpass QL endpoint. Overpass expects structured queries like `[out:json];node[amenity=cafe](area);out;`. Natural language returns empty. | Requires OSM query builder rewrite for Overpass syntax. Not in scope. |
| D5 | **Loop doesn't continue to ISO-002** | 🔴 Blocking | SplitInBatches loop continuation depends on items flowing back from the last node. When Merge outputs 0 items, the downstream nodes (Filter Empty Envelopes → dedup → write → status update → back to SplitInBatches) never execute. Loop terminates silently. | Same root cause as D1 — fix Merge to pass error envelopes, OR add a loop continuation edge that doesn't depend on Merge output. |
| D6 | **Set Status Running writes "Pending"** | 🟢 Known benign | Node uses `={{$json.status}}` expression (evaluates to original "Pending") instead of literal `"Running"`. | Known benign bug — see A.8 observations. Not blocking. |
| D7 | **OSM execution time 555s** | 🟡 Performance | Overpass API query for `test-iso-gpl-niche in Testville, ` returned empty elements but took ~9 minutes. Likely the server processed a large-area search before returning. | Performance concern for production use. Not blocking for isolation. |

---

## §6 Container Workflow & Artifact

| Property | Value |
|----------|-------|
| Workflow ID | `WcUgtTPiKXPL0BLH` |
| Container | `serene_swartz` (n8n 2.38.7) |
| Node count | 32 |
| Active | 0 |
| Container updatedAt | 2026-09-15T03:39:29.178Z |
| Artifact SHA-256 | `2581898191D3534E228FAA57F53E2AF847EFDD68212CD642B69B4B78B79A01EE` |
| Artifact size | 81,719 bytes |
| Container vs artifact | Not byte-identical (n8n normalized: Merge `options` vs `numberOfInputs`, FSQ extra `authentication` fields, resource-locator normalization). Non-blocking. |

**Credential refs in container:**
- Sheets: `JL2ZSG2FTSoGKMXc` (Google Sheets OAuth2) — 7 nodes
- FSQ: `71soVf1y0Y8VwM9x` (httpHeaderAuth, header name `"Foursquare API"`) — 1 node, `onError: continueErrorOutput`

**Runtime env vars required for execution:**
- `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` (allows `$env.GOOGLE_PLACES_API_KEY` in node expressions)
- `N8N_RUNNERS_BROKER_PORT=5680` (avoids conflict with main instance on 5677)
- `GOOGLE_PLACES_API_KEY` (39-char key, set per `docker exec -e`)

---

## §7 Post-Run Counts

| Tab | Pre-Run | Post-Run | Delta |
|-----|---------|----------|-------|
| Search Inputs | 2 | 2 | 0 (both still `Pending`) |
| Raw Leads | 0 | 0 | 0 |
| Verified Leads | 0 | 0 | 0 |

---

## §8 Open Questions

1. **Merge `combineAll` design:** Is this the intended behavior? Can n8n Merge v3 `combineAll` be configured to include non-empty inputs even when some are empty? Options include `alsoReturnFirstInput` or `includeOtherSources` if available.
2. **Loop continuation:** Should the loop continue to the next batch even when Merge outputs nothing? A fallback edge from Merge (or the Merge node itself) back to SplitInBatches would prevent silent loop termination.
3. **GPL API key:** Is this key expected to have Places API enabled? The 403 is a GCP project configuration issue, not a workflow bug.
4. **FSQ credential header name:** Is `"Foursquare API"` (with space) intentionally invalid? It causes deterministic ERR_INVALID_HTTP_TOKEN.
5. **OSM query builder:** Should the Overpass query use structured QL instead of natural language?
6. **Access token expiry:** The `ya29` token expires during multi-minute executions. Sheet readbacks require a fresh token each time. Is there a service account approach?

---

## §9 Prompt C Readiness

**Cleanup identity chain:**
- Search Inputs: `input_id LIKE 'TEST-GPL-LIVE-%'` → 2 rows (ISO-001, ISO-002)
- Raw Leads: `search_input_id LIKE 'TEST-GPL-LIVE-%'` → 0 rows
- Verified Leads: `search_input_id LIKE 'TEST-GPL-LIVE-%'` → 0 rows

**Total cleanup size:** 2 rows in Search Inputs, 0 in Raw Leads, 0 in Verified Leads.

**Note:** ISO-003 row was deleted for sequencing and never re-seeded. Prompt C should ensure the cleanup set covers all `TEST-GPL-LIVE-%` patterns.

---

## §10 Completion State

### `PARTIAL — ISOLATION MATRIX RAN WITH DEVIATIONS`

**What worked:**
- P1 preflight: PASS (all 9 checks green)
- P2 seeding: PASS (3 rows seeded, readback verified)
- P3 execution: PARTIAL (ISO-001 ran, ISO-002 blocked by Merge, ISO-003 not executed)
- P4 assertion: PARTIAL (error envelopes created correctly but dropped by Merge; no Raw Leads to verify)

**What didn't work:**
- Error envelopes never reach Raw Leads (Merge D1)
- Loop breaks after first iteration (D5)
- GPL returns 403 (D2), FSQ ERR_INVALID_HTTP_TOKEN (D3), OSM empty (D4)
- ISO-002 skipped entirely, ISO-003 not executed

**Required for full PASS:**
1. Fix Merge wiring to pass error envelopes independently of the combineAll Cartesian product (D1)
2. Add loop continuation edge that doesn't depend on Merge output (D5)
3. Enable Places API on the GPL key's GCP project (D2)
4. Re-run all three cases

**Recommendation:** This report provides the complete audit trail. Prompt C should address D1 (Merge error-envelope routing) and D5 (loop continuation) before re-running the isolation matrix.
