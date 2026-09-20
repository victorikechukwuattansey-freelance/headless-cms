# H.8d Report — Handoff Write-Node Reconciliation to the Live Approved Outreach Schema

**Date:** 2026-09-18
**Status:** PASS — MAP RECONCILED, ARTIFACT RE-BASELINED

---

## 1. Scope & objective

Close the H.8d reconciliation window for the **Write Approved Outreach** node
in `Approved Outreach Handoff V1.json` so that:

1. The `defineBelow` column map writes **exactly the 15 handoff-owned columns**
   of the live 24-column (A–X) Approved Outreach sheet, by their real
   sheet-header names.
2. Phantom columns, aliased field names, and the stale `outreach_status`
   carrier are gone from the map — while the PREPARE node (the producer) is
   untouched and still emits its 21 legacy-shaped fields.
3. V/W enrichment-owned columns (`contact_source_provider`,
   `contact_blocked`) are never written by the handoff.
4. `country` (column X) stays mapped.
5. All integrity gates hold: `npm test` green, `verify:frozen` PASS,
   `enrichment:security` exit 0, manifest re-baseline recorded as an approved
   change.

No `--execute` was run, nothing was migrated on the live sheet, and the artifact
was **not** re-imported into the container.

---

## 2. Authority & evidence priority

- The final column contract comes from the H.8d prompt's authoritative list
  ("Final handoff-owned columns" = 15 keys) and the live sheet header set
  (`src/schema.js` `APPROVED_COLUMNS`, 24 entries).
- Frozen artifacts (`frozen-artifacts.manifest.json`) are integrity-protected:
  a SHA-256 change requires a recorded revision entry. The handoff artifact was
  previously **not** in the manifest; adding it under `R-HANDOFF-1` was handled
  as an approved baseline addition with both old and new hashes recorded.

---

## 3. Schema reconciliation (write-node map)

`src/schema.js` `APPROVED_COLUMNS` (A–X) is the source of the live header set.
The write node's `columns.value` (keys) is now a subset of those headers,
mapping to sheet letters **B, C, E, F, G, X, J, H, I, D, K, L, M, R, U**.

Changes made to `Write Approved Outreach / parameters.columns.value`:

| Sheet col | Old key | New key | Value expression (unchanged) |
| --- | --- | --- | --- |
| B | `lead_id` | `lead_id` | `={{ $json.lead_id }}` |
| C | `business_name` | `business_name` | `={{ $json.business_name }}` |
| E | `niche` | `niche` | `={{ $json.niche }}` |
| F | `city` | `city` | `={{ $json.city }}` |
| G | `state` | `state` | `={{ $json.state }}` |
| X | `country` | `country` | `={{ $json.country }}` |
| J | `website` | `website` | `={{ $json.website }}` |
| H | `phone` | `phone` | `={{ $json.phone }}` |
| I | `email` | `email` | `={{ $json.email }}` |
| D | `contact_name` | `contact_name` | `={{ $json.contact_name }}` |
| K | `email_source` | **`verification_source`** | `={{ $json.email_source }}` |
| L | `lead_score` | **`score`** | `={{ $json.lead_score }}` |
| M | `outreach_channel` | **`channel`** | `={{ $json.outreach_channel }}` |
| R | `approved_at` | `approved_at` | `={{ $json.approved_at }}` |
| U | `notes` | `notes` | `={{ $json.notes }}` |

Dropped (6): `contact_title`, `email_verified`, `contact_form`,
`linkedin_url`, `qualification_status`, `outreach_status`.

The H.8d prompt's rename list mentioned `outreach_status → status`, but its own
authoritative "Final handoff-owned columns" list contains **no `status`** key
(status is row-state owned by downstream envelope semantics, column T), so
`outreach_status` was dropped rather than aliased. Surface this if challenged.

### Invariants preserved

- **PREPARE node unchanged** (`Prepare Approved Outreach Rows` jsCode): its
  output rows still carry the 21 legacy field names — including
  `email_source`, `lead_score`, `outreach_channel`, `outreach_status` — and the
  value expressions above keep reading those producer fields. No node but the
  write node's `columns.value` changed: ids, names, types, connections,
  positions, and all other parameters are byte-identical.
- No `V`/`W` enrichment-owned columns are mapped (asserted by
  `enrichmentOwned` guard in both test files).
- `approval_id` (A), `campaign_name` (N), `message_variant` (O),
  `approval_stage` (P), `approved_by` (Q), `scheduled_date` (S), `status` (T)
  are step-state/outreach-owned and intentionally **not** written by the
  handoff append.

---

## 4. Manually edited artifact — no builder exists

`scripts/` contains **no** handoff builder (only enrichment/execution/
reconciliation/response/prospect-finder builders), so `Approved Outreach
Handoff V1.json` was edited in place and re-hashed. The deterministic-build
gate does not apply to this artifact; this is recorded as an open item
(section 7).

- Old hash: `fb18a5d1e23476f33198a74f5b31bee752dd8ab2bef6f5686cd40283f6327e4a`
- New hash: `2f1e8421277a9fabde0448d418e16064c6abcd8690f8b77b8d6d75d9a92466ec`

---

## 5. Manifest re-baseline (version 6 → 7)

`frozen-artifacts.manifest.json`:

- Added **revision** `R-HANDOFF-1` (path, previous + new sha256, date,
  reason) — the handoff artifact had no prior entry (24 entries, all
  enrichment/response-*); it is now revision-tracked like the other artifacts.
- Added the artifact entry `Approved Outreach Handoff V1.json` with the new
  hash.
- Bumped `version` 6 → 7.
- The other **24 artifact entries are untouched**; `verify:frozen` uses the
  live `artifacts` array length, so the count (now 25) is reported dynamically.
- Revisions total: 22.

---

## 6. Test evidence

| Gate | Result |
| --- | --- |
| `npm test` (full suite) | **1208 / 1208 pass** |
| Handoff workflow suite (`handoff-workflow.test.js`) | pass — write-map pins now `WRITE_MAP_COLUMNS` (15) |
| Handoff engine suite (`handoff-engine.test.js`) | pass — prepare goldens still pin 21 producer fields; write-map pin now 15 |
| `verify:frozen` | **25 / 25** PASS |
| `enrichment:security` | exit 0 (GREEN), no secret patterns |

Test-file changes:

- `tests/handoff-workflow.test.js` and `tests/handoff-engine.test.js`: added a
  15-key `WRITE_MAP_COLUMNS` constant; the **write-map** pins now assert the map
  equals those 15 headers, that every mapped key is a live `APPROVED_COLUMNS`
  header, that no enrichment-owned `contact_source_provider` /
  `contact_blocked` (V/W) key is mapped, and that `country` remains mapped.
- The **prepare-row** assertions keep the 21-field producer contract
  (`APPROVED_OUTREACH_COLUMNS`) — the PREPARE node was not changed.
- `tests/harness-offline.test.js` `simulateHandoff` unaffected (new-schema row
  keys built from `APPROVED_COLUMNS`, independent of the write map).

---

## 7. Risk register & open items

- **Open (operator):** no builder exists for the handoff artifact; the manual
  in-place edit is the only way to ship it, and every future round-trip must
  re-run `verify:frozen`. Consider adding a deterministic builder if handoff
  edits recur.
- **Open (operator):** confirm on the live sheet that Approved V/W are the
  enrichment-owned columns and `country` (X) is populated by the handoff
  append before any `--execute` (environment not on this machine; nothing was
  migrated).
- **Decision surfaced:** the prompt's rename line implied
  `outreach_status → status`; the authoritative final 15-key list excludes
  `status`, so `outreach_status` was dropped from the map entirely (the PREPARE
  node still emits it for downstream consumers/tests).
- **Scope guard:** `src/schema.js` (24-column contract), the enrichment runner,
  and all other workflow artifacts were **not** modified; unrelated
  working-tree changes outside this project were not touched.
- No commit was made (uncommitted working tree per workspace convention).

---

## 8. Completion

**PASS — MAP RECONCILED, ARTIFACT RE-BASELINED (R-HANDOFF-1, manifest v7)**