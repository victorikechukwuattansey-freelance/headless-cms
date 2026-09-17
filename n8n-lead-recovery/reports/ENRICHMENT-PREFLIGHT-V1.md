# Lead Enrichment — Preflight Report (V1): Prompt E-PREFLIGHT

**Prompt:** E-PREFLIGHT — design document only, no implementation.
**Scope:** Lead Enrichment workstream for the Lead Recovery Engine (n8n-lead-recovery).
**Deliverable:** this document (`reports/ENRICHMENT-PREFLIGHT-V1.md`).
**Constraints honored:** no workflow changes, no source changes, no test changes, no spreadsheet modifications, no new sheet tabs, no manifest touches, no Overture dataset download. STOP after this document.
**Date:** 2026-09-16
**Branch:** `pre-cleanup-2026-09-08`
**Baseline artifact (frozen):** `Lead Recovery Engine — Prospect Finder & Validation V1.json` — SHA-256 `7E335F38B50D1742FBACF502F8B73458F0BDEA13C12B9DF884DF5F097E407511`, 88,253 bytes, 33 nodes / 16 code nodes. Full suite **987/987**, `verify:frozen` 10/10, secret scan GREEN.

---

## 1. Q:U Formula — Qualification & Scoring (reconstructed)

### 1.1 Formula ownership (verified, repo + handoff docs)

Google Sheets tab **Verified Leads** (gid=102). The pipeline's ARRAYFORMULA owns columns **Q–U** (0-indexed 16–20 in `src/schema.js` `VERIFIED_COLUMNS`):

| Sheet col | Column | Owner | n8n writes? |
|---|---|---|---|
| Q | `has_website` | ARRAYFORMULA | Never |
| R | `has_phone` | ARRAYFORMULA | Never |
| S | `target_niche` | ARRAYFORMULA | Never |
| T | `score` | ARRAYFORMULA | Never |
| U | `qualification_status` | ARRAYFORMULA | Never |

Source: `src/schema.js:57-63` (`VERIFIED_FORMULA_COLUMNS`), `APPROVED-OUTREACH-HANDOFF-v0.1.md:36` (ownership), `README.md:80` (P–U never written by n8n; the handoff consumes, never re-computes).

**The exact ARRAYFORMULA text is NOT in the repository.** It lives in the production spreadsheet (`1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`). No Google credentials are available in this session (`GOOGLE_ACCESS_TOKEN` / `GOOGLE_SERVICE_ACCOUNT_JSON` / `GOOGLE_SHEET_ID` all absent), so the formula cannot be read live. The behavior below is **reconstructed from repo evidence + observed live data**, and must be confirmed against the sheet before E.1 implementation (see §6 D1).

### 1.2 Inputs the formula reads (n8n-written input columns)

The formula reads `has_website`/`has_phone`/`target_niche`-style derivations from n8n-written **input** columns — the authoritative set (per `APPROVED-OUTREACH-HANDOFF-v0.1.md:34` and the handoff mapping `score`→`lead_score`, `qualification_status`→`qualification_status` at lines 61–62):

- `website` (col 8)
- `phone` (col 7)
- `rating` (col 9)
- `review_count` (col 10)
- `niche` (col 2) — for `target_niche` matching
- `business_name`, `business_type` (cols 1, 12) — context

### 1.3 Reconstructed scoring behavior

Consistent with observed data + documented gating:

- **`has_website`** = presence of a non-empty `website` (0/1-scale signal).
- **`has_phone`** = presence of a non-empty `phone`.
- **`target_niche`** = niche-alignment flag derived from `niche` + business description/type.
- **`score`** = weighted combination of the above signals; **rating and `review_count` participate in the score** (see §1.4).
- **`qualification_status`** = `QUALIFIED` / `REVIEW` / `DISQUALIFIED` from thresholds on `score` (and possibly on `has_*` presence).
  - Approvals gate (handoff) requires exactly `QUALIFIED`; `REVIEW`/`DISQUALIFIED` never enter Approved Outreach (`APPROVED-OUTREACH-HANDOFF-v0.1.md:42-49`).

**Observed live data (S-HVAC-001, 57 leads):** every lead is `REVIEW` (score 60) or `DISQUALIFIED` (score 40/25). **Zero `QUALIFIED`.**

### 1.4 The binding constraint (why enrichment matters)

- `Process FSQ` and `Process OSM` write **hard-coded `rating: 0, review_count: 0`** (`src/prospect-finder-embedded-code.js:600-602` and `:965-966`). Foursquare and OpenStreetMap/Overpass do not supply these fields.
- `Process GPL` *can* supply them (`rating`, `userRatingCount` via FieldMask — `src/prospect-finder-workflow-contract.js:1598`; normalized at `src/google-places.js:163-168`), **but GPL returns 403 PERMISSION_DENIED** — the GCP key lacks Places API enablement, and GCP billing is frozen.
- Net effect on the sheet: `rating` and `review_count` are always `0` for live FSQ/OSM rows → **score is capped below the `QUALIFIED` threshold → zero approvals.** The 60-observed score is the cap without rating/review_count contribution.

> **Reconstructed inference (to confirm at §6 D1):** when `rating` and `review_count` are populated, `score` rises above the cap and leads can cross into `QUALIFIED`.

### 1.5 Formula-reconstruction caveat

The precise weights, the exact cap value, and the `QUALIFIED` threshold are **not** in the repo. E.1 (formula negotiation) is therefore a hard prerequisite: the enrichment target signals and the score threshold must be pinned from the production sheet (or an operator-provided formula copy) before any provider selection is finalized.

---

## 2. Signal Availability Matrix

Required input signals (Q:U formula inputs) × current + candidate providers.

| Signal | Verified col | FSQ (Foursquare) | OSM (Overpass) | GPL (Google Places) | Overture Places |
|---|---|---|---|---|---|
| `website` | 8 | ✅ native (`website`) | ✅ native (`website`) | ✅ native (`websiteUri`) | ✅ `websites[]` |
| `phone` | 7 | ✅ native (`tel`) | ✅ native (`phone`/`contact:phone`) | ✅ native (`internationalPhoneNumber`) | ✅ `phones[]` |
| `rating` | 9 | ❌ — hard-written `0` | ❌ — hard-written `0` | ✅ native (`rating`) — **403 blocked** | ❌ **not provided** |
| `review_count` | 10 | ❌ — hard-written `0` | ❌ — hard-written `0` | ✅ native (`userRatingCount`) — **403 blocked** | ❌ **not provided** |
| `niche` match inputs (`business_type`/categories) | 12 | ✅ `categories` | ✅ `tags`/`category` | ✅ `types` | ✅ `categories`/`basic_category` |
| `address` | 6 | ✅ | ✅ | ✅ | ✅ `addresses[]` |
| `email` (future) | — | ❌ | ❌ | ❌ (rare) | ⚠️ `emails[]` partial |
| `socials`/social URLs (future) | — | ⚠️ | ❌ | ⚠️ | ✅ `socials[]` |
| Operating status (future) | — | ⚠️ | ⚠️ | ✅ | ✅ `operating_status` |

**Legend:** ✅ = native & currently usable · ⚠️ = partial / not standardized · ❌ = not available.

**Key finding:** the two signals that break the score cap (`rating`, `review_count`) are available from **exactly one** current provider — GPL — which is **billing-blocked**. **Overture Maps does not carry them at all.** Enrichment therefore cannot be Overture-only; see §4.

---

## 3. Overture Maps Capability Assessment

### 3.1 Schema (Places dataset, 2025-09-16-alpha release lineage)

| Field group | Contents | Relevance to enrichment |
|---|---|---|
| `id` | Global Entity Reference System (GERS) id | Cross-provider de-duplication token; stable |
| `names` | `primary`, `common`, `value` (multilingual) | None (name already present) |
| `categories` / `taxonomy` | `primary` + `alternate` (Foursquare/OSM taxonomy ids), `basic_category` | `target_niche` niche alignment; `business_type` enrichment |
| `confidence` | float 0–1 | Used to gate which rows are trustworthy (NOT a rating — is an entity-conflation confidence) |
| `websites[]` | E.g. `{ websites: [{provider: "wikidata", value: "http://…"}] }` | **Fills a Q:U input signal directly** for OSM rows missing website |
| `phones[]` | E.g. `{ phones: [{provider: "foursquare", value: "+1414..."}] }` | Same for phone |
| `emails[]` | E.g. `{"pp"|"website"|"contact", "value"}` | Future email enrichment (partial coverage) |
| `socials[]` | E.g. `{socials: [{provider: "foursquare", "url": "instagram.com/…"}]}` | Future LinkedIn/Instagram signals |
| `addresses[]` | `freeform`, `locality`, `region`, `postcode`, `country` | gap-fill for missing address components |
| `operating_status` | `OperatingStatus` (hours availability) | Future |
| `brand` | `brand.names`, `brand.wikidata` | Parent-company detection (aids `suspicious_or_parent_company_website` REVIEW reason) |
| `sources[]` | provider, id, attribute | Provenance tracking for enrichment lineage |

### 3.2 Conflation

Overture conflation merges **Foursquare, OpenStreetMap, Meta, Microsoft, and other sources** into single stable entities keyed by GERS `id`. Consequences for this pipeline:

- A lead whose `source = FOURSQUARE` and a lead whose `source = OSM` may reference the **same physical business**. Overture already conflates them → the enrichment lookup can register BOTH existing lead rows to one Overture entity, which strengthens the existing dedupe story rather than fighting it.
- The conflation is **not perfect**: `confidence` surface splits confusion; sibling entities and source overlaps still occur. Enrichment must treat a lookup as a **best-effort join keyed on phone/website/name+locality**, not as a guarantee.
- **Known defect:** the Overture Explorer's "high confidence" filter has a known bug; confidence values below ~0.5 should not be auto-trusted. Enrichment must carry a `confidence` threshold configurable per deployment.

### 3.3 Access paths (A–D as researched)

| Path | Mechanism | Cost | Constraints vs this deployment |
|---|---|---|---|
| **A. REST (community wrapper)** | `https://api.overturemaps.org/`-style REST proxy over parquet | Free (non-commercial terms) | Needs an HTTP call from n8n Code/HTTP node; non-commercial licensing restriction; wrapper availability/latency unverified |
| **B. DuckDB + S3 parquet (local query)** | `SELECT … FROM read_parquet('s3://overturemaps-us-west-2/release/…/places/*.parquet')` | Free; no REST dependency | Requires DuckDB binary + network to S3; **no DuckDB in this stack today** (Windows host, n8n in Docker) |
| **C. Python CLI** | `pip install overturemaps` → Python client | Free | **Container lacks Python** (JS-only Code nodes); adds a heavyweight runtime for a JS pipeline — worst fit |
| **D. BigQuery public dataset** | `bigquery-public-data.overture_places` | Free tier; needs GCP project | GCP is **billing-frozen** (the same blocker as GPL) — realistic blocker |

### 3.4 Ranking for this pipeline

For a **Windows-hosted, n8n-in-Docker, JS-only** deployment, ordering is:

1. **B (DuckDB + S3)** — best technical fit: deterministic, no licensing on data access for non-commercial use, selectable columns, works offline-after-download. **Cost:** Overture dataset download + a code-node SQL shim (JS calling duckdb needs the CLI/wasm; tuning required).
2. **A (REST wrapper)** — simplest integration (HTTP node), but non-commercial terms + third-party availability risk.
3. **D (BigQuery)** — architecturally clean but hard-blocked by the frozen GCP billing.
4. **C (Python CLI)** — rejected for this stack (no Python runtime; runtime sprawl).

### 3.5 Limitations (explicit)

- **No `rating`, no `review_count`, no review text** anywhere in Overture Places. **Overture alone cannot lift the score cap.** This is the single most important limitation.
- No revenue, no employee count, no social-follow stats, no email verification.
- `emails[]` coverage is partial (provider-tagged, `"pp"`=primary-source flags) and unverified.
- Coordinate/spatial data exists but is out of scope here (pipeline is sheet-address-driven, not geometry-driven).
- Freshness lag: Overture releases periodically; a lead discovered today may not yet be conflated.

---

## 4. Provider Selection Matrix

Objective ranking across the candidate enrichment sources for the **signals that matter** (`rating`, `review_count`, `website`, `phone` gap-fill, plus future email/socials).

| Provider | `rating` | `review_count` | Website/phone gap-fill | Email/socials | Licensing | GCP/Key needed | Fit score (1–5) |
|---|---|---|---|---|---|---|---|
| **GPL (Google Places)** | ✅ native | ✅ native | ✅ | ❌ | Google ToS | **Yes — billing frozen (403)** | 5 signal / 0 current → **5 (if billing unfrozen)** |
| **Overture Maps** | ❌ | ❌ | ✅ strong | ⚠️ partial | Non-commercial (REST) / open (parquet CC) | No | 3.5 |
| **Yelp Fusion** | ✅ | ✅ | ✅ | ❌ | OAuth key, free tier | No GCP | 4.0 |
| **Tripadvisor** | ✅ | ✅ | ⚠️ | ❌ | API key, quota | No GCP | 3.5 |
| **Facebook/Meta Places** | ⚠️ (only ratings graph) | ❌ | ✅ | ❌ | Graph API token | No GCP | 2.5 |
| **Apollo/Hunter (contact)** | ❌ | ❌ | ❌ | ✅ | API key, paid | No GCP | 2.0 (separate need) |

### 4.1 Preferred strategy (reconstructed recommendation)

- **Primary actual gap-fill: Overture Maps** (path B) — phone/website/category/address enrichment for FSQ/OSM rows whose contact fields are missing, plus cross-provider conflation awareness. **Does not require GCP.**
- **Rating/review_count restoration: GPL re-enabled** — the FieldMask already requests `rating` + `userRatingCount`; it is the existing, in-artifact path. **Blocked solely by GCP billing/key enablement.** This is an operator decision (§6 D2), not a code defect.
- **If a rating provider is required without GCP:** Yelp Fusion is the recommended non-GCP alternative for `rating`+`review_count` (US-centric niche match; HVAC niche fits).

### 4.2 Two-track framing (recommended architecture driver)

- **Track 1 — "Make leads qualifyable" (rating/review_count):** requires GPL re-enable **or** a secondary rating provider (Yelp). *Enforcement: score cap lifts.*
- **Track 2 — "Make leads complete" (contact gap-fill):** Overture supplies missing website/phone/category/address so existing (not yet written) `has_website`/`has_phone` signals can hit their targets. *Enforcement: fewer REVIEW/DISQUALIFIED with missing-contact reason.*

Both tracks are composable; Track 2 is implementable with zero new credentials; Track 1 needs one operator decision.

---

## 5. Proposed Architecture

Mirrors the existing repo pattern (contract + engine + embedded mirror + builder + fixtures + live runner + frozen artifact) — see `scripts/build-prospect-finder-workflow.js` and the GPL preflight.

### 5.1 Placement

Enrichment runs as a **separate workflow** (`Lead Enrichment V1`) positioned **after Prospect Finder → Verified Leads**, **before** the Approved Outreach Handoff gate:

```
Search Inputs → (Prospect Finder V1) → Verified Leads → [ENRICHMENT V1] → Verified Leads (gap-filled) → (Approved Outreach Handoff V1)
```

Constraints honored:
- **Verified Leads is NOT re-written wholesale.** n8n Sheets nodes cannot do in-place column updates on ARRAYFORMULA-owned columns; the formula owns Q–U. Enrichment writes **only n8n-owned input columns** (`website`, `phone`, `rating`, `review_count`, `business_type`, `address`) via column-scoped updates (or a staging tab + copy). Whether rating/review_count may be written (given §1.4 argues they currently can be, since n8n writes them today as `0`) is a **sheet-authorization decision** (§6 D3).
- **The ARRAYFORMULA is untouched.** Existing PROSPECT-FINDER artifact is **not modified** (frozen by convention; revision-log discipline preserved).

### 5.2 Component sketch

| Component | Role | Follows | Enrichment counterpart |
|---|---|---|---|
| Engine | deterministic enrichment/matching logic, offline-testable | `src/prospect-finder-embedded-code.js` | `src/enrichment.js` (oracle) + `src/enrichment-embedded-code.js` (mirror) |
| Matching key | phone → website → name+locality (+ Overture `id` where a lead already carries a GERS ref) | `buildDedupeKey` cascade | `src/enrichment-match.js` |
| Overture access | DuckDB/S3 query shim (path B default) or REST HTTP node (path A) | — | `src/overture-client.js` |
| Confidence gating | drop rows below `confidence` threshold | GPL gate A/B/C pattern | same pattern (reuse `gplGeoRejected`-style counters) |
| Builder | deterministic artifact regenerator | `scripts/build-prospect-finder-workflow.js` | `scripts/build-enrichment-workflow.js` |
| Wire format | lead row → enriched lead row diff (only new values) | normalized row shape | `ENRICHED_*` overlaid columns |
| Offline suite | parity + determinism + no-op-when-nothing-to-fill | `tests/prospect-finder-*.test.js` | `tests/enrichment-*.test.js` |
| Live runner | seed/verify/cleanup against real sheet (dry-run first) | `scripts/run-*.js` convention | `scripts/run-enrichment-live.js` |

### 5.3 Data-flow rules

1. Read Verified Leads (read-only; no formula columns touched).
2. Key rows needing enrichment (missing `website`/`phone`/`rating`/`review_count`).
3. Lookup via Overture (path B); apply `confidence` gate + source-attribution (`enriched_via`, `overture_id`, `overture_confidence` in `notes`/additive columns).
4. **Track 1 (conditional on §6 D2/D3):** re-run GPL lookup for rating/review_count on FSQ/OSM rows (or Yelp), then write `rating`/`review_count` to n8n-owned cells.
5. Write back only changed n8n-owned columns. Idempotent, retry-safe.
6. Leave Approved Outreach Handoff untouched (it will now see `QUALIFIED` rows naturally once the formula re-scores).
7. Report: matched / gap-filled / skipped / confidence-rejected / unchanged, per source.

---

## 6. Open Decisions

| ID | Decision | Status | Notes / dependency |
|---|---|---|---|
| D1 | **Exact Q:U formula** — obtain text of the ARRAYFORMULA from the production sheet (or operator) so weights/thresholds/cap are pinned | 🔶 **DECISION REQUIRED** | Blocking for E.1 signal selection; no Google creds in session |
| D2 | **Track 1 rating source** — re-enable GPL billing/key, OR adopt a non-GCP rating provider (Yelp Fusion) | 🔶 **DECISION REQUIRED** | GPL = existing path (zero code); Yelp = new credential. Does the operator hold a valid GCP billing account now? |
| D3 | **Write authority for `rating`/`review_count`** — may enrichment write a value other than 0 into columns n8n currently owns? | 🔶 **DECISION REQUIRED** | Sheet owns Q–U formulas but n8n writes cols 9–10 today (as `0`); conflict must be resolved before E.3 |
| D4 | **Overture access path** — B (DuckDB+S3, download) vs A (REST wrapper) | 🔶 Recommend **B** | C rejected (no Python); D blocked (GCP) |
| D5 | **New columns** — additive `enriched_via`/`overture_id`/`overture_confidence` in Verified Leads, or purely `notes`-appended? | 🔶 **DECISION REQUIRED** | Any new column is a sheet-schema change (increases blast radius); a `notes`-only mode avoids it |
| D6 | **Non-commercial licensing** — Overture REST terms vs repo's commercial product intent | 🔶 **DECISION REQUIRED** | If commercial, prefer B (parquet CC-by) over A (REST non-commercial) |
| D7 | **Enrichment placement** — standalone 10th workflow vs embedded stage in Prospect Finder | ✅ Recommend **standalone** | Keep existing frozen artifact untouched (revision-log discipline); staged idempotent writes |
| D8 | **Verification method** — extend `verify:frozen` manifest with the new artifact? | 🔶 Depends D7 | Manifest v4 addition matches repo convention |

---

## 7. Implementation Scope (E.1–E.7)

Ordered by dependency. Each item is **not started** — this prompt is document-only.

| ID | Scope | Depends on | Deliverable |
|---|---|---|---|
| E.1 | Pin exact Q:U formula; lock enrichment target signals + score threshold | D1 | Formula pin record (in this report, §1 revision) |
| E.2 | Overture integration (path B preferred): `src/overture-client.js`, code-node shim, offline tests, confidence gate | D4, D6 | Engine + embedded mirror + fixtures + tests |
| E.3 | Enrichment workflow artifact: builder + `Lead Enrichment V1.json`, idempotent column-scoped write-back | D3, D5, D7 | Builder + artifact + `verify:frozen` entry |
| E.4 | Track 2 gap-fill wiring: website/phone/category/address + `notes` provenance | E.2, E.3 | Live-runner dry-run + seeded run |
| E.5 | Track 1 rating/review_count: GPL re-enable OR Yelp adapter | D2, D3 | Adapter + live-runner |
| E.6 | Approved Outreach Handoff re-validation (pipeline now sees `QUALIFIED`) | E.4, E.5 | Regression pass; handoff unchanged (consumes only) |
| E.7 | Report, artifact fingerprint, revision-log entry, close | E.1–E.6 | `reports/ENRICHMENT-V1-*` + closure |

**Notes:** E.1 is a hard blocker for a fully-correct E.5; E.2–E.4 (Track 2) can proceed before D2 is resolved because they need no new credentials.

---

## 8. Out of Scope (explicit)

- Any modification to the frozen Prospect Finder artifact or its builder/contract/embedded-code.
- Any edit to the ARRAYFORMULA or formula-owned columns.
- Renaming, moving, or deleting sheet tabs; adding tabs without approval.
- Overture dataset download during this prompt (no download performed).
- Email/contact enrichment (Apollo/Hunter) in V1 — listed as future.
- LinkedIn enrichment, employee/revenue data, social-follow counts.
- Any live execution against the production spreadsheet from this prompt.
- GCP billing account changes — operator action only.

---

## 9. Final Report — Completion State

| Item | State |
|---|---|
| Preflight document | ✅ WRITTEN (`reports/ENRICHMENT-PREFLIGHT-V1.md`) |
| Q:U formula | 🔷 Reconstructed from repo evidence + live data; **exact text requires sheet/operator (D1)** |
| Signal availability matrix | ✅ §2 |
| Overture capability assessment | ✅ §3 (schema, conflation, paths A–D, confidence, limitations) |
| Provider selection matrix | ✅ §4 |
| Proposed architecture | ✅ §5 (standalone workflow, engine/mirror/builder pattern, formula untouched) |
| Open decisions | ✅ §6 (8 items; D1–D3 are blocking, D4–D8 are routing) |
| Implementation scope E.1–E.7 | ✅ §7 |
| Out of scope | ✅ §8 |
| Reading of production sheet | ⛔ Not performed (no Google credentials in session) |
| Any file modified besides this report | ⛔ No |

**Completion state: PREFLIGHT COMPLETE — IMPLEMENTATION NOT STARTED.** Per Prompt E-PREFLIGHT the task **stops here**. The next action is operator resolution of D1 (and D2/D3 for Track 1) followed by E.1.