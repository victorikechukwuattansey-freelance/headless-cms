# H.8c Report — Schema Reconciliation + Configurable Country Policy

**Date:** 2026-09-18
**Status:** PASS — SCHEMA RECONCILED, COUNTRY POLICY CONFIGURABLE

---

## 1. Scope & objective

Close the H.8c reconciliation window for the Approved Outreach handoff in
`n8n-lead-recovery` so that:

1. Every engine, fixture, and runnable script speaks one canonical schema
   (`score`, `status`, `channel`) — no stale `outreach_status` /
   `lead_score` / `qualification_status` / `outreach_channel` references.
2. `npm test` is fully green (1208/1208).
3. The enrichment country policy is configurable at the runner — without
   changing the frozen, byte-deterministic behavior of the shipped workflow.
4. All integrity gates hold: `verify:frozen` 24/24, `enrichment:security`
   exit 0, manifest re-baseline documented as an approved change.

No `--execute` was run and nothing was migrated on the live sheet.

---

## 2. Authority & evidence priority

- Decisions follow the workspace evidence priority; the D-C8 re-baseline was
  **explicitly approved by the operator** (Option B: countryInScope seam +
  re-baseline) after alternatives were presented.
- Frozen artifacts (`frozen-artifacts.manifest.json`, 24 entries) are
  integrity-protected: a SHA-256 mismatch blocks commit without an approved
  change and a recorded revision entry.

---

## 3. Schema reconciliation (canonical Approved Outreach contract)

`src/schema.js` now owns the canonical 24-column contract. Approved mapping:

- `lead_score` → `score`
- `outreach_status` → `status`
- `qualification_status`, `outreach_channel` → **dropped** (superseded by
  `channel` semantics)
- `channel` is authoritative, with fallback; `suppressed` wins
- `lead_id` verified at index 1 (pinned)
- Approved columns V/W/X (index 21/22/23) are enrichment-owned:
  `contact_source_provider`, `contact_blocked`, cache-hit flag
  (V/W orientation per H.8b.2)

Migrated: `src/queue.js`, `src/reconcile.js`, `src/fixtures.js`,
`src/verify.js`, all fixture JSONs (`queue-fixtures.json`,
`execution-fixtures.json`, `recon-fixtures.json`), and the three runnable
scripts (`run-outreach-queue-live.js`, `run-execution-live.js`,
`run-reconciliation-live.js`) to `APPROVED_LEAD_COL`. `src/cleanup.js`
remains read-only. Handoff/aoh fixtures keep their legacy keys intentionally
(they are handoff-format fixtures, not Approved-row fixtures).

---

## 4. Channel semantics & fixture migration

- Approved `channel` is authoritative for the `not_ready`/`contacted`/
  `suppressed`/`pending_review` classification pipeline, with legacy fallback.
- Queue, execution-recon, and reconciliation engines + fixtures migrated;
  embedded bodies patched in place (queue/execution/reconciliation embedded
  sources are NOT frozen-manifest artifacts) and re-injected into
  `Outreach-Queue-and-Planning V1.json` and
  `Run-Reconciliation-and-Reporting V1.json`.
- `npm run execution:build` regenerated `Outreach-Execution-and-Delivery V1.json`
  from the patched embedded engine (8 nodes, 3 code nodes) — verified green.

---

## 5. Country policy (D-C8) + frozen-engine seam + approved re-baseline

**Policy surface (runner-only, `scripts/run-enrichment-live.js`):**

- `ENRICHMENT_COUNTRIES_ALLOW`: comma-separated ISO-3166 alpha-2; default
  `"US"`; `"*"`/empty = allow all.
- `ENRICHMENT_COUNTRIES_DENY`: deny list; wins over allow.
- Matching is exact alpha-2, no aliasing (pinned by
  `tests/enrichment-live-runner.test.js:331`). Missing/blank country fails
  closed. Classification (`classifyLead` → `not_ready` reasons incl. `non_us`)
  already honors the policy; the eligibility filter passes only in-policy
  countries to the engines.

**Frozen-engine seam (APPROVED, re-baseline dated 2026-09-18):**

The contact engines previously hardcoded `isUsCountry` (`US_COUNTRIES` from the
frozen `src/enrichment-schema.js`), so a policy that admitted e.g. Canada
produced `eligible:1, enriched:0` (the engine re-skipped the lead as `NON_US`).
Fix under operator approval:

- `src/enrichment-contact.js` and `src/enrichment-contact-oss.js` accept an
  **optional** `countryInScope` predicate; when absent they default to the
  frozen `isUsCountry` gate — byte-behavior-identical for the shipped
  workflow, all fixtures, and every non-runner consumer.
- The live runner passes its allow/deny policy through the seam into both
  engines (`enrichContactLeads`, `enrichContactOss`).
- `Enrichment V1.json` was deterministically rebuilt
  (`npm run enrichment:build`; byte-deterministic builder).
- The two embedded mirror SOURCE files
  (`src/embedded-enrichment-contact*.js`) are unchanged — they compose their
  body from the engines at load time — so only **3** manifest entries were
  re-baselined: `src/enrichment-contact.js`, `src/enrichment-contact-oss.js`,
  `Enrichment V1.json`.
- `frozen-artifacts.manifest.json` bumped to **version 6**, with revision
  entries and an `about` note recording the approved D-C8 change (precedent:
  prior approved re-baselines are recorded the same way).

---

## 6. Test evidence

| Gate | Result |
| --- | --- |
| `npm test` (full suite) | **1208 / 1208 pass** |
| Runner + engine + build/schema suites | 145 / 145 pass |
| Execution trio (queue/execution/execution-recon) | 53 / 61 / 55 pass |
| Reconcile trio | 48 / 48 pass |
| `verify:frozen` | **24 / 24** PASS |
| `enrichment:security` | exit 0 (GREEN), no secret patterns |

Key fixtures corrected: `leadRow` default country `USA`→`US` (exact alpha-2),
allow=CA fixture `Canada`→`CA`, stale `outreach_status` → `status` rows and the
regex `/outreach_status remains "not_ready"/` → `/status remains "not_ready"/`.

---

## 7. Risk register & open items

- **Open (operator):** confirm on the live sheet that Approved V/W are the
  correct enrichment-owned columns and the Contact Enrichment Log is empty
  before any `--execute` (unchanged from H.8b.2; environment not on this
  machine). Nothing was migrated.
- **Low:** the engine-level skip label stays `NON_US` even when the injected
  policy is non-US; the runner's classifier already prevents out-of-policy
  leads from reaching the engine, so this label only surfaces if the policy is
  mis-wired. Accepted; avoids touching frozen fixture/golden semantics.
- **Scope guard:** unrelated working-tree changes outside this project
  (`../_open-canva`, `../reconcilekit`, etc.) were not touched.
- No commit was made (uncommitted working tree per workspace convention).

---

## 8. Completion

**PASS — SCHEMA RECONCILED, COUNTRY POLICY CONFIGURABLE**