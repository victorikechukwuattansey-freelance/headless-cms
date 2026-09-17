# Lead Enrichment — Contact Layer: Prompt H-PREFLIGHT (Four-Tier Contact Enrichment Design)

**Prompt:** H-PREFLIGHT — four-tier contact enrichment design (Overture / Hunter / Apollo / open-source).
**Scope:** design document only. No code, no workflow changes, no sheet changes, no API calls.
**Deliverable:** this document (`reports/CONTACT-ENRICHMENT-PREFLIGHT-V1.md`).
**Date:** 2026-09-16
**Branch:** `pre-cleanup-2026-09-08`
**Related:** `reports/ENRICHMENT-PREFLIGHT-V1.md` (Prompt E-PREFLIGHT — business-level enrichment / qualification signal).
**Pricing basis:** verified this session via provider pricing pages + help centers; D2 (rating source) remains unresolved and is tracked only where it gates this design.

---

## Summary Recommendation

**IMPLEMENT — Phase 1 (Option A):** a new standalone **`Contact Enrichment V1`** workflow that runs **after** the Approved Outreach Handoff, enriching only `QUALIFIED` rows using **Hunter.io (free, API included)** as the programmatic email provider, **Overture Maps (path B) + open-source verification** as the free fallback/verification layer, and **Apollo deferred until volume justifies a paid seat** (free tier has no API access).

Completion: **PASS — PREFLIGHT COMPLETE, IMPLEMENTATION SCOPE DEFINED.**

---

## 1. Audit of the Existing Approved Outreach Schema

### 1.1 Canonical column set (position-exact, frozen)

`src/schema.js:30-52` (`APPROVED_COLUMNS`) — **21 columns, A–U**, shared with Run Reconciliation (`src/reconcile.js`), Queue (`src/queue.js`), Execution (`src/execution.js`), fixtures, and the verification harness (`src/verify.js` asserts the **exact** 21-column shape with no control/formula leakage).

| # | Column | Written by (today) | Value today | Classification |
|---|---|---|---|---|
| 0 | `lead_id` | Handoff (from Verified) | copied | source-integrity |
| 1 | `business_name` | Handoff | copied | source-integrity |
| 2 | `niche` | Handoff | copied | pass-through |
| 3 | `city` | Handoff | copied | pass-through |
| 4 | `state` | Handoff | copied | pass-through |
| 5 | `country` | Handoff | copied | pass-through |
| 6 | `website` | Handoff | copied | pass-through |
| 7 | `phone` | Handoff | copied | pass-through |
| 8 | `email` | Handoff | **literal `''`** | 🔓 **enrichment-mutable** |
| 9 | `contact_name` | Handoff | **literal `''`** | 🔓 **enrichment-mutable** |
| 10 | `contact_title` | Handoff | **literal `''`** | 🔓 **enrichment-mutable** |
| 11 | `email_source` | Handoff | **literal `''`** | 🔓 **enrichment-mutable** |
| 12 | `email_verified` | Handoff | **literal `''`** | 🔓 **enrichment-mutable** |
| 13 | `contact_form` | Handoff | **literal `''`** | 🔓 enrichment-mutable (optional) |
| 14 | `linkedin_url` | Handoff | **literal `''`** | 🔓 enrichment-mutable (optional) |
| 15 | `lead_score` | Handoff (from Verified `score`) | copied | 🔒 do-not-touch (source-integrity) |
| 16 | `qualification_status` | Handoff | copied | 🔒 do-not-touch (source-integrity) |
| 17 | `outreach_channel` | Handoff | **literal `''`** | ⚙️ workflow-owned (queue assigns) |
| 18 | `outreach_status` | Handoff | **literal `not_ready`** | ⚙️ workflow-owned |
| 19 | `approved_at` | Handoff | ISO timestamp | ⚙️ workflow-owned |
| 20 | `notes` | Handoff | **literal `''`** | ⚙️ workflow-owned (log-only) |

### 1.2 Which columns are populated today

Only the Handoff's 21-column `defineBelow` write map runs today (`APPROVED-OUTREACH-HANDOFF-v0.1.md:69`). Enrichment columns **8–14 are written as empty strings** by the Handoff (§5 mapping: email/contact fields → `''`, "enrichment is out of scope"). Nothing populates `email`/`contact_name`/`contact_title`/`email_source`/`email_verified` in the current pipeline.

### 1.3 Which are reserved for enrichment

Clear and explicit: **`email`, `contact_name`, `contact_title`, `email_source`, `email_verified`** are the designed enrichment slots (Handoff §5 + schema). `contact_form` and `linkedin_url` are also empty-but-optional enrichment targets (lower priority).

### 1.4 Which are formula-owned / contract-frozen

- **No ARRAYFORMULA-owned columns exist in Approved Outreach.** The Q:U formulas live in **Verified Leads** (E-PREFLIGHT §1); Approved Outreach contains no formulas. `verify.js` confirms: formula-owned keys (from Verified) must not leak into Approved Outreach, and it asserts the 21-column exact schema.
- **Do-not-touch (source-integrity):** `lead_score`, `qualification_status` (copied from Verified; downstream consumers treat them as immutable approval facts), plus `lead_id`/`business_name`.
- **Workflow-owned:** `outreach_channel`, `outreach_status`, `approved_at`, `notes`.

### 1.5 The exact fields a contact-enrichment stage MAY target without violating the frozen contract

| Field | Mutable? | Consumer that reads it |
|---|---|---|
| `email` | ✅ | Execution (Outreach Log row), Queue (`available_channel`) |
| `contact_name` | ✅ | Execution (Outreach Log payload) |
| `contact_title` | ✅ | (reconciliation/notes; no hard gate) |
| `email_source` | ✅ | provenance/audit; Queue (`enrichment_required` diagnostics) |
| `email_verified` | ✅ **required non-empty for email channel** | **Queue gating (`queue.js:122-146`)** and Execution (`embedded-execution.js:69`) |
| `contact_form` / `linkedin_url` | ✅ optional | no hard consumers today |
| `lead_score`, `qualification_status`, `lead_id`, `business_name` | ❌ | source-integrity; never rewritten |
| `outreach_channel`, `outreach_status`, `approved_at`, `notes` | ❌ | workflow-owned state |

### 1.6 Critical downstream constraint (discovered this session)

`queue.js` `readinessFor()` (lines 140-151) opens the **email channel only when `email_verified` is non-empty**; otherwise it falls through to phone (`>= 7 digits` → `CALL`) or `NOT_READY`. Execution hard-requires the same (`embedded-execution.js:69`, `isVerifiedEmail`). Consequences:

1. Contact enrichment that fills `email` **without** a non-empty `email_verified` does **not** enable email outreach — the lead stays on call/NOT_READY. **`email_verified` must be populated** for the enrichment to have queue-level effect.
2. `email_source` should be set whenever `email`/`email_verified` are, so provenance is auditable (compliance, §8).

---

## 2. Four-Tier Provider Capability Matrix

### 2.1 Tier 1 — Overture Maps (business-level enrichment)

- **Pricing/API:** free, unlimited, open-source; DuckDB + S3 parquet (path B, recommended) or REST wrapper (third-party, free non-commercial), Python CLI, BigQuery.
- **Schema:** `names`, `categories`, `confidence`, `websites[]`, `phones[]`, `emails[]`, `socials[]`, `addresses[]`, `operating_status`, `brand`, `sources[]`, GERS `id`.
- **Does NOT supply:** rating, review_count, **person identity** (never a person's name/title/email-to-person).
- **Maps to:** `website`, `phone`, address components, `business_type`.

### 2.2 Tier 2 — Hunter.io Free (domain email enrichment)

- **Pricing (verified, hunter.io/pricing + help center 2026-08/09):** Free $0 → **50 credits/month, permanent, API access INCLUDED**. Domain Search = 1 credit per 1–10 emails returned. Email Finder = 1 credit per call (person-gated). Verifier = 0.5 credit per verification. Discover (company search) = free.
- **Maps to:** `email`, `email_verified`, `email_source` ("hunter").
- **Cannot supply:** person name (best-effort only via returned person objects), person title, `contact_form`, `linkedin_url`.

### 2.3 Tier 3 — Apollo.io Free (person enrichment)

- **Pricing (verified, apollo.io/pricing + third-party 2026):** Free $0 → 900 credits/seat/**year** (≈75/month, granted monthly). Email reveal = 1 credit, phone reveal = 8 credits. Search/filtering unlimited.**API access RESTRICTED on the free tier** — no programmatic access.
- **Maps to:** `contact_name`, `contact_title`, `email`, person `phone`, `linkedin_url`.
- **Critical constraint:** free tier cannot be automated at all. Requires **Basic** ($49/seat/mo annual, 30,000 credits/yr) or higher for API access.

### 2.4 Tier 4 — Open-source fallback

- **coldreach** (PyPI, MIT, verified — `coldreach 0.1.0`, Apr 2026): email finder + lead discovery; `coldreach find --domain acme.com`, `--name`, `verify`. Self-hosted, no API keys (Groq optional), no rate limits. **Requires Python ≥ 3.11** (container has no Python → runs as an external host script).
- **theHarvester** (PyPI `theHarvester`, OSINT — verified): email/subdomain/ip/breach recon across 50+ public sources. Some sources need API keys; several core ones (bing, google, certspotter-style) work keyless. Python tool.
- **@absolutejs/enrich** (npm, verified — `@absolutejs/enrich v0.1.4 beta`, absolutejs.com documentation): in-house B2B email verification (MX/SMTP/catch-all), decision-maker email finding, keyless public-profile enrichment (avatars/logos/social handles). **Node-native** → best fit for the JS/n8n stack. **Version note:** `v0.1.x beta` — pin and vet before relying on it for production verification.
- **Maps to:** `email`, `email_verified`, best-effort `contact_name`.

### 2.5 Consolidated mapping

| Approved Outreach field | Tier 1 (Overture) | Tier 2 (Hunter) | Tier 3 (Apollo) | Tier 4 (OSS) |
|---|---|---|---|---|
| `email` | — | ✅ | ✅* | ✅ |
| `contact_name` | — | partial | ✅* | partial |
| `contact_title` | — | — | ✅* | partial (@absolutejs/discover) |
| `email_verified` | — | ✅ | — | ✅ |
| `email_source` | — | `"hunter"` | `"apollo"` | `"oss"` |
| `phone` (person) | — | — | ✅* (8 cr) | — |
| `website` | ✅ | — | — | — |
| `linkedin_url` | — | — | ✅* | partial (social handles) |
| `contact_form` | — | — | — | — |

(*) = requires **paid** tier for API access (Apollo).

### 2.6 Gap analysis — fields NO tier can supply

- **`contact_form`** — the schema has a boolean-ish slot for "does the site expose a contact form", and **zero tiers supply it.** It is effectively unfillable without a website crawl. **Recommendation: leave empty (unused) in V1.**
- **`contact_title`** — only Apollo (paid) or @absolutejs/discover (free, decision-maker intent) can fill it. No tier fills it reliably for arbitrary leads.
- **`linkedin_url`** — partial only (Apollo paid-professional, @absolutejs social handles). Incidental, not guaranteed.

**The one hard gap under a $0 programmatic-only stack is `contact_title`** (and `contact_form` by design). Everything else has at least one free path.

---

## 3. API Access Asymmetry — Critical Finding

| Provider | Free tier | API access on free tier? | Automation posture |
|---|---|---|---|
| **Hunter** | 50 credits/mo | ✅ **YES** | Automatable now ($0) |
| **Apollo** | 900 credits/yr (~75/mo), no API | ❌ **NO (restricted)** | **Not automatable** without paid seat ($49+/user/mo) |
| **Overture** | unlimited | ✅ YES (DuckDB/S3; REST wrapper non-commercial) | Automatable now ($0) |
| **OSS** | unlimited, self-hosted | ✅ YES (local) | Automatable now ($0) |

**Assessment:**

1. **Can the pipeline operate Hunter-only at pilot scale? → YES.** Hunter free's 50 credits/month maps to **~50 domain searches/month** (Domain Search = 1 credit per 1–10 emails) or ~33 domain searches + ~34 verifications (0.5 cr each) — comfortably covering a pilot that qualifies ≤ 50 leads/month. Added: Hunter's free tier includes API access, so it is the **only** commercial provider automatable at $0.
2. **Is Apollo required? → NO at pilot.** Deferred. If/when the pipeline needs person titles or volume > Hunter ceiling, Apollo Basic ($49/user/mo annual, 30,000 credits/yr) or a Hunter Starter upgrade (+$34/mo annual for 2,000 credits) is the decision point. Apollo is the *only* source for guaranteed `contact_title` + person phone, so it becomes relevant only when those become a requirement.
3. **Does the open-source tier reduce reliance on either commercial provider? → YES, materially.**
   - `@absolutejs/enrich` (Node) gives keyless MX/SMTP/catch-all verification → **offload Verifier (0.5 cr) spend from Hunter**, reserving Hunter credits for discovery only.
   - `coldreach` + `theHarvester` give free domain email discovery (lower coverage/quality than Hunter), enabling a **Hunter-priority queue**: use Hunter for the first N domains, OSS for the overflow (or OSS-first + Hunter verification-of-record if coverage permits).
   - At $0 the OSS layer effectively removes the *verification* per-lead cost and provides overflow capacity; it does **not** replace Hunter's accuracy/deliverability for the discovery step.

**Recommendation (primary + fallback):**
- **Primary:** Hunter.io **free plan**, API-driven — `Domain Search` → candidate emails; `Email Verifier` for the retained record (only the lead's chosen email), while `@absolutejs/enrich` does bulk MX/SMTP validation to conserve Hunter credits.
- **Fallback (zero-credit overflow / Hunter empty):** `@absolutejs/enrich` (npm, keyless) + `coldreach`/`theHarvester` (external host scripts, keyless core sources) for discovery and verification.
- **Apollo:** **deferred** — not required at pilot; revisit when `contact_title`/person-phone/volume demand justifies the paid seat.

---

## 4. Sequencing Decision — Before or After Qualification

### Option A — After qualification (recommended)
`Verified Leads → [QUALIFIED gate (Handoff)] → Approved Outreach → [Contact Enrichment V1] → Queue`
- **Pros:** only qualified leads touch paid credits; minimal spend; **fully compatible with the frozen formula and contract** — the enriched columns live downstream of the Q:U formula, so nothing re-scores.
- **Cons:** does not help borderline leads cross the threshold (they cannot, under the frozen formula anyway — see below).

### Option B — Before qualification
`Verified Leads → [Contact Enrichment] → [QUALIFIED gate] → Approved Outreach`
- **Requires a formula change:** E-PREFLIGHT reconstructed the Q:U formula as consuming `has_website`, `has_phone`, `target_niche`, `rating`, `review_count` — **not** contact completeness. Enrichment fields (`email`, `email_verified`) live in Approved Outreach and are **not** formula inputs. For Option B's stated benefit ("contact completeness promotes REVIEW leads") the formula must be **modified** — explicitly out of scope today (H-PREFLIGHT §12; E-PREFLIGHT D1/D3). As-is, Option B just wastes credits on leads that may never qualify.
- **Cons:** credits spent on non-qualified leads; formula modification required; higher blast radius.

### Option C — Hybrid (enrich only near-qualifiers)
- Runs enrichment on leads that pass everything except a contact-path requirement, then re-checks. 
- **Requires the same formula change as B** to define "near-qualifier" conditions the formula can evaluate. Not implementable without modifying the qualification contract.

### Verdict
- Against the **current frozen formula**, Option A is the **only** sequencing compatible with the contract. B and C both presuppose a formula modification (a D2-adjacent + D1-adjacent decision).
- **D2 effect:** D2 (rating source) determines *how many* leads become `QUALIFIED` (it lifts the score cap). It does **not** change which sequencing is legal — A stays required regardless; D2 only changes the volume that flows into A.
- **Hunter ceiling sufficiency:** at pilot (≤ 50 qualified leads/mo) the free 50-credit ceiling is sufficient for Option A. Any choice that enriches non-qualified leads (B/C) would exceed it quickly — another argument for A at $0.

**Recommendation: Option A**, unless the operator also decides to modify the qualification formula to value contact completeness (then revisit B/C in a follow-up prompt).

---

## 5. Cost Model

### 5.1 Provider pricing (verified this session)

| Provider | Plan | Monthly fee | Credits | Programmatic? |
|---|---|---|---|---|
| Hunter | Free | **$0** | 50/mo | ✅ |
| Hunter | Starter | **$49/mo** ($34/mo annual) | 2,000/mo | ✅ |
| Hunter | Growth | $149/mo ($104/mo annual) | 10,000/mo | ✅ |
| Hunter | Scale | $299/mo ($209/mo annual) | 25,000/mo | ✅ |
| Apollo | Free | $0 | 900/yr (~75/mo) | ❌ |
| Apollo | Basic | **$49/seat/mo** annual (≈$59–65 monthly) | 30,000/yr | ✅ |
| Apollo | Professional | $79/seat/mo annual | 48,000/yr | ✅ |
| Overture | — | $0 | unlimited | ✅ |
| OSS | — | $0 | unlimited (self-hosted) | ✅ (local only) |

Hunter credit economics: Domain Search = 1 cr per up to 10 emails; Email Finder = 1 cr; Verifier = 0.5 cr. Apollo: email reveal = 1 cr; phone reveal = 8 cr.

### 5.2 At $0 (free tiers only)

| Layer | Capacity at $0 |
|---|---|
| Overture | unlimited business enrichment (domain/phone/address) |
| Hunter | **50 domain searches/mo** (1 cr each) ≈ **50 qualified leads** with email discovery |
| Hunter verifier | up to ~34 verifications at 0.5 cr (trade against discovery) |
| @absolutejs/enrich | unlimited local MX/SMTP verification (offsets verifier spend) |
| coldreach/theHarvester | unlimited local discovery (overflow, lower coverage) |
| Apollo | **0 automated** (no API) |
| **Net monthly capacity** | **~50 qualified leads fully enriched at $0** (assumes 1 discovery credit/lead + OSS verification) |

### 5.3 At scale (paid tiers)

| Scenario | Cost | Marginal cost per qualified lead |
|---|---|---|
| Hunter Starter $34/mo annual (2,000 cr/mo) | $34/mo | 1 discovery + ~0.5 verify ≈ 1.5 cr/lead → **~1,333 leads/mo** ≈ **$0.026/lead** |
| Apollo Basic $49/seat/mo (30k cr/yr, 2,500 cr/mo-equiv) | $49/mo | email reveal 1 cr/lead → **2,500 leads/mo max**; seat dominates below volume: $49/100 leads = **$0.49/lead** at 100/mo, **$0.049/lead** at 1,000/mo |
| Combined Hunter+Apollo | $83/mo | title+phone-rich records; phone reveal 8 cr is expensive — cap phone reveals |

- **Per 100 qualified leads:** Hunter-only ≈ **$2.55** (150 cr on Starter) + $0 seat-driven test cost; Apollo-only at 100/mo ≈ **$49** (seat-dominated); OSS+Hunter hybrid ≈ **$0** until Hunter's 50 credits exhaust.
- **Per 1,000 qualified leads:** Hunter Starter ≈ **$34** flat; Apollo Basic ≈ **$49** flat; both comfortably inside credits.
- **Ceiling fallback behavior:** when Hunter's monthly credit ceiling is reached → **defer remaining domains to next cycle** (cache pending), **or** overflow to OSS discovery. Never silently drop; alert via `notes`/report counter.

### 5.4 Recommendation

- **Max credits/lead acceptable:** ≤ 2.5 (1 discovery − up to 1 verifier − slack). Design ops so 1 discovery + 1 verification is the norm; anything ≥ 3 flags the lead for review.
- **Monthly ceiling:** $0 at pilot (Hunter free, 50 cr). Scale ceiling: **Hunter Starter annual ($34/mo)** with alert at 80% of 2,000 credits; Apollo Basic only when `contact_title` or person-phone becomes a hard requirement.
- **OSS impact:** shifts the calculus by removing the verifier credit cost (use @absolutejs/enrich for MX/SMTP) and providing free overflow — do **not** budget for outstanding verifier capacity.

---

## 6. Idempotency and Cache

### 6.1 Enrichment key

- `enrichment_key = sha256(normalized_domain + '|' + provider)`, plus an optional `contact_hint` component when a person-name/gate disambiguates result reuse (Hunter Domain Search vs Email Finder produce different granularities). Domain normalization: strip scheme/www/trailing slash/`.co.uk`-style suffix policy (keep raw TLD for lookup correctness).
- **Cache granularity:** per **domain** for `email` discovery results; per **domain+x** for person-level fields (name/title); per **email** for verification verdicts.

### 6.2 Storage

Recommend **a new `Contact Enrichment Log` tab** (named per repo tab convention) holding `lead_id`, `enrichment_key`, `provider`, `requested_at`, `found_at`, `emails_found`, `verdict`, `credits_used`, `http_status`, `error`, `ttl_expires`, `payload_hash`. Rationale:
- Keeps the frozen Approved Outreach 21-column contract **byte-stable** (no new columns, no formula risk).
- Enables retry/audit/compliance (§8 data-source traceability) without touching lead rows.
- Option rejected: adding cache columns to Approved Outreach would expand a frozen, contract-asserted schema (`verify.js` asserts exact 21 columns).

**Note:** adding the tab is a **sheet-schema change** — flag as DECISION REQUIRED (D-C0 below) even though it carries no formula/approval risk. Alternative zero-sheet variant: a local JSON/SQLite cache in the runner (acceptable for pilot, weaker for compliance).

### 6.3 TTL and invalidation

- **TTL default: 60 days** (30–90 range appropriate; email patterns/domains are stable on that horizon). Expired keys re-enrich.
- **Invalidation triggers:** domain change (Approved `website` edited), verification flip (deliverable→undeliverable or bounce in Outreach Log), explicit operator purge. Bounce signal from Execution/Outreach Log → set cache to `expired` and clear `email_verified`, never auto-retry the same address within 30 days.

---

## 7. Failure and Fallback Behavior

| Failure mode | Pipeline action | Default policy |
|---|---|---|
| Domain, no discoverable emails (Hunter empty/0) | leave `email`+`email_verified` empty; log `no_emails_found`; try OSS overflow once | **empty + status unchanged** → lead remains call/NOT_READY |
| Email Finder low-confidence guess | only accept ≥ `confidence` threshold (Hunter `score`) | treat sub-threshold as "not found"; do not mark verified |
| Verification fails (undeliverable) | `email_verified` stays empty; record verdict; do NOT write the email as usable | **empty → call/NOT_READY** (never a deliverable-looking address) |
| Rate limit mid-batch | per-row `continueOnFail`; SplitInBatches + Wait/backoff; mark row `deferred` and resume next run | **defer, retry next cycle**, never skip permanently |
| API key invalid / quota exhausted | hard-stop the batch with a clear report + alert; no partial writes to lead rows | **fail-closed**, quarantine batch |
| Marketplace/aggregator domain (no direct contact) | detect via pattern/source tags; leave contact empty | **skip** enrichment; add `notes`; keep phone path if present |

### Recommended single default policy

> **Leave contact columns empty, set `email_verified = ''`, keep `outreach_status`/`readiness` unchanged (call or NOT_READY), record the reason, and escalate high-`lead_score` leads to manual review.** Never write an unverified or guessed address as `email_verified`. Do **not** fall back to generic `info@`/`contact@` automatically in V1 (low personalization + deliverability risk); generating a generic address is a manual-review action.

---

## 8. Compliance and Privacy

| Regulation | Application | Policy recommendation |
|---|---|---|
| **CAN-SPAM (US)** | governs cold-send, not list-build | Must be able to identify the source of every address (→ `email_source` + enrichment log); honor opt-out within **10 business days** and track it (Outreach Log). |
| **GDPR (EU)** | legitimate-interest for B2B enrichment is debated | Recommend documented legitimate-interest assessment: business contact data + relevant product + honest source labeling + easy opt-out; treat EU leads as **DECISION REQUIRED** until legal sign-off. |
| **PECR (UK)** | electronic-communications consent nuance | Same posture as GDPR; **DECISION REQUIRED** for UK leads. |
| **Provider ToS** | reselling/storage of enriched data | Hunter/Apollo prohibit re-selling raw datasets; storing results in the operator's pipeline Google Sheet for internal outreach is generally accepted but **must be confirmed (DECISION REQUIRED)** — especially AppScript/GSheets-absent architecture keeps data in the sheet the operator already owns. |
| **Data retention** | enrichees' PII | Recommend retention ≤ 2 years or until opt-out/deletion request; removal procedure = delete row from Approved Outreach + enrichment log; EU subjects get deletion-on-request path flagged. |

**Not resolved here (DECISION REQUIRED):** GDPR/PECR policy per-region handling, exact retention period, storage-in-sheet vs provider ToS sign-off, and whether the operator will maintain EU/UK suppression lists. D-C8 (below).

---

## 9. Integration Architecture

### 9a. Workflow structure — recommended

**New, dedicated `Contact Enrichment V1` workflow** (matches the repo's one-workflow-per-stage pattern; e.g. `Approved Outreach Handoff V1`). **Not** an extension to the Handoff (keeps the frozen Handoff artifact untouched) and **not** merged with the Prospect Finder (E-PREFLIGHT D7 stands: standalone).

```
Approved Outreach Handoff V1  →  Contact Enrichment V1 (NEW)  →  Outreach Queue & Planning V1
```

### 9b. Node topology (sketch)

```
Manual Trigger
→ Read Approved Outreach (googleSheets read; existing approved rows)
→ Enrichment Scope (code): filter rows where qualified + website non-empty + email empty
    (+ cache lookup / skip already-enriched keys)
→ SplitInBatches (batch size ~10) + Wait (Hunter rate limit; e.g. 1s-60s configurable)
→ Hunter Domain Search (httpRequest; env: HUNTER_API_KEY; POST /v2/domain-search?domain=…)
→ Select Best Email (code): per-lead pick highest-confidence email; apply threshold
→ Verify Email (httpRequest, Hunter /v2/email-verifier — 0.5 cr) [or @absolutejs/enrich local step]
→ Write Verified Contact (googleSheets update row: email, contact_name?, email_source='hunter',
    email_verified=Y/N)
→ Update Enrichment Log (googleSheets append; caching + audit)
→ Report (code): per-run counters — enriched, skipped, empty, failed, deferred, credits_used
→ (no-op end)
```

- **Rate limiting:** SplitInBatches + Wait/backoff; per-row `continueOnFail` on HTTP nodes so one failure defers the row, not the batch.
- **Error handling:** `onError: continueErrorOutput` on Hunter nodes → error envelope → log + defer; quota/key errors → batch halt + alert.
- **Overture path B (DuckDB+S3):** an **offline batch pre-load** (`scripts/load-overture-enrich.mjs`-style) that fills business-level gaps (website/phone/address) into Approved Outreach or the enrichment log before the per-lead Hunter pass; not an in-workflow node in V1.

### 9c. Credential handling

- **Hunter API key:** n8n `headerAuth` credential **referenced by name** (repo convention — no literal keys in artifacts), or `$env.HUNTER_API_KEY` per the Prospect Finder's `GOOGLE_PLACES_API_KEY` pattern. Either is acceptable; pick env-var for consistency with the existing env-sourced pattern.
- **Apollo API key (only if paid tier adopted):** same convention.
- **Open-source tools:** run **outside n8n** as batch scripts (`npm`/Node for `@absolutejs/enrich`; Python for coldreach/theHarvester on the host, since the n8n container lacks Python). Outputs land in the enrichment log / a staging file the workflow reads.

### 9d. Runner/tests

- **Fixtures:** mock Hunter Domain Search + Verifier responses (HTTP-mocked, zero live keys) — mirror `fixtures/` convention used by every stage.
- **Sandbox:** inject an HTTP client seam (like `google-places.js` oracle pattern) so tests run **without live keys**; `NOT_CONFIGURED` exit when `HUNTER_API_KEY` absent (matches existing live-runner fail-closed convention).
- **Overture:** pre-loaded parquet/fixture file as the business-enrichment test input.
- **Parity:** engine module (`src/contact-enrichment.js`) + embedded mirror (`src/embedded-contact-enrichment.js`) + builder (`scripts/build-contact-enrichment-workflow.js`), mirroring the Prospect Finder pattern; `verify:frozen` manifest gains the new artifact (v4).

---

## 10. Open Decisions

| ID | Decision | Options | Recommendation | Flag |
|---|---|---|---|---|
| **D-C0** | Add `Contact Enrichment Log` tab? (sheet-schema change, no formula risk) | (a) new tab ✅ (b) local cache | (a) — compliance/audit + no contract risk | 🔷 DECISION REQUIRED |
| **D-C1** | Sequencing (before/after qualification) | A / B / C | **A** — only one legal under frozen formula | 🔷 (depends on D2 only for volume, not legality) |
| **D-C2** | Primary provider | Hunter-first / Apollo-first / OSS-first / hybrid | **Hunter-first + OSS fallback** | 🔷 |
| **D-C3** | Apollo paid tier | required / deferred | **deferred** | 🔷 |
| **D-C4** | Cost ceiling | max credits/lead, max monthly spend | ≤2.5 cr/lead; $0 pilot; $34/mo (Hunter Starter annual) scale; alert @80% | 🔷 |
| **D-C5** | Failure policy | leave empty / block / fallback generic | **leave empty + escalate high-score to review** (no generic) | 🔷 |
| **D-C6** | Cache TTL | 30–90d | **60d** default | 🔷 |
| **D-C7** | Hunter tier to purchase | free/Starter/Growth | **free now; Starter when >50 leads/mo** | 🔷 |
| **D-C8** | GDPR/PECR policy | per-region handling, retention, suppression | documented legitimate interest; **legal sign-off flagged** | 🔷 DECISION REQUIRED |
| **D-C9** | Enriched data in Google Sheet vs provider ToS | allow / disallow | **allow, subject to D-C8 sign-off; confirm with provider ToS** | 🔷 DECISION REQUIRED |
| **D-C10** | "contact-blocked" status vs reuse REVIEW | new status / reuse | **reuse existing vocabulary** (empty + `not_ready` + notes); no new status in V1 (cross-workflow impact) | 🔷 |
| **D-C11** | Overture access path | DuckDB batch / REST / self-hosted shim | **DuckDB + S3 (path B)** per E-PREFLIGHT §3.4 | 🔷 |
| **D-C12** | Formula change to value contact completeness | (feeds B/C) | **not in V1** — keep formula frozen | 🔷 depends on D1/D2 |

---

## 11. Implementation Scope Estimate (phased)

| ID | Scope | Deliverables | Depends on | Gate | Blockers |
|---|---|---|---|---|---|
| **H.1** | Overture DuckDB batch loader (business enrichment) | `src/overture-client.js`, loader script, fixture parquet | D-C11 | offline test suite | none (proceeds without D2) |
| **H.2** | Hunter adapter | `src/hunter-client.js` (domain-search + verifier), HTTP seam, fixtures | D-C2 | offline suite, mocked HTTP | none (offline) |
| **H.3** | Cache/idempotency module | `src/enrichment-cache.js`, `enrichment_key` logic, TTL | D-C0, D-C6 | unit tests | D-C0 (tab) — local-cache fallback unblocks |
| **H.4** | OSS fallback integration | `@absolutejs/enrich` wrapper (Node); coldreach/theHarvester host scripts | — | batch test on host | **Python on container** → host-only; betas need pinning |
| **H.5** | Fixtures + offline test suite | `tests/contact-enrichment-*.test.js`, mocked responses | H.2, H.3 | parity + determinism | none |
| **H.6** | Workflow builder + artifact | `Contact Enrichment V1.json`, `scripts/build-contact-enrichment-workflow.js` | H.2–H.5, D-C1 (A) | builder byte-identity | D-C1 if B/C chosen |
| **H.7** | Live validation | seeded run, live-runner script | H.6 | live run + evidence | **Hunter API key** (operator), n8n re-import |
| **H.8** | Integration with Handoff→Queue lineage | connection wiring, reconciliation pass, README/runbook | H.6, H.7 | end-to-end offline+n8n | none |
| **H.9** | Formula integration (only if B/C) | formula/contract change + re-verification | D-C12, D1, D2 | full-suite + sheet re-check | **blocked by D2 + formula decision** |

**Unblocked-independent-of-D2:** H.1–H.6 (offline-capable, no keys, no qualification change).
**Blocked by D2 only:** H.9 (and H.7's *volume*, not its feasibility).
**Externally keyed:** H.7 requires the operator to provision a Hunter API key.

---

## 12. Out of Scope

- ❌ No implementation of any kind in this prompt.
- ❌ No modification of any workflow, source, test, or the sheet.
- ❌ No Hunter/Apollo/any-API calls (even a ping).
- ❌ No new tab (unless operator approves D-C0 in a later prompt).
- ❌ No changes to `frozen-artifacts.manifest.json` or the `verify:frozen` gate.
- ❌ No qualification-formula changes.
- ❌ No email verification/DSL beyond design; no send-channel work.

---

## 13. Required Final Report

1. **Approved Outreach schema:** 21 exact columns audited (src/schema.js) — 5 enrichment-mutable (`email`, `contact_name`, `contact_title`, `email_source`, `email_verified`), 2 optional (`contact_form`, `linkedin_url`), source-integrity + workflow-owned frozen; **no formula-owned columns in the tab.**
2. **Four-tier matrix:** capability table produced (§2.5); **gap = `contact_title`** (Apollo-only/paid, or @absolutejs/discover) and `contact_form` (unfillable by any tier).
3. **API asymmetry:** Hunter free **has** API (50 cr/mo); Apollo free **does not** (no automation); Overture/OSS automatable at $0.
4. **Gap analysis:** `contact_form` (no tier), `contact_title` (paid-gated), `linkedin_url` (partial).
5. **Sequencing:** **Option A (after qualification)** — the only contract-legal option; B/C require a formula change (D-C12); D2 affects volume, not legality.
6. **Cost model:** $0 ≈ 50 qualified leads/mo (Hunter discovery + OSS verification); paid — Hunter Starter ≈ $0.026/lead @1,333/mo; Apollo Basic seat-dominated until ~500+/mo.
7. **Idempotency/cache:** `enrichment_key = sha256(domain|provider[|hint])`; recommended new Contact Enrichment Log tab (D-C0); TTL 60d; invalidation on domain change/verification flip/bounce.
8. **Failure/fallback:** default = leave empty + escalate high-score; never auto-write unverified/generic addresses.
9. **Compliance:** CAN-SPAM source-traceability + opt-out tracking; GDPR/PECR/ToS/retention **DECISION REQUIRED** (D-C8/D-C9).
10. **Integration architecture:** dedicated `Contact Enrichment V1` (Manual Trigger → Read Approved → filter+cache → SplitInBatches+Wait → Hunter Domain Search → verify → write: email/email_verified/email_source → log → report); Overture as offline batch pre-load; keys env-sourced; tests = mocked HTTP, no live keys.
11. **Open decisions:** D-C0…D-C12 enumerated with recommendations (§10).
12. **Implementation outline:** H.1–H.9 with deps/gates/blockers (§11).
13. **Recommendation:** **IMPLEMENT** — start Phase 1 (H.1–H.6, Option A, Hunter+OSS, Apollo deferred). **PASS — PREFLIGHT COMPLETE, IMPLEMENTATION SCOPE DEFINED.**

---

## Completion State

| Gate | State |
|---|---|
| Deliverable written | ✅ `reports/CONTACT-ENRICHMENT-PREFLIGHT-V1.md` |
| Schema audit | ✅ 21 cols, ownership classified, no formula-owned cols in tab |
| Gap analysis | ✅ `contact_title`, `contact_form` |
| Cost model ($0 + scale) | ✅ |
| Sequencing | ✅ Option A recommended (D2 tracked as volume-only) |
| Open decisions | 🔷 13 items (D-C0, D-C8, D-C9 need operator sign-off) |
| Any artifact / sheet / API touched | ❌ none |