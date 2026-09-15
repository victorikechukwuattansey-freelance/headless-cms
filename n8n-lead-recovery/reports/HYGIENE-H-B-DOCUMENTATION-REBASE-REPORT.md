# Hygiene Workstream — Prompt H-B: Documentation Rebase

**Repo:** `n8n-lead-recovery/` (tracked inside the `jarvis-demo` workspace monorepo)
**Date:** 2026-09-15
**Branch:** `pre-cleanup-2026-09-08`
**Completion state:** **PASS — DOCUMENTATION REBASED, H-C READY**

---

## 1. Scope and Method

H-B is the second of three hygiene prompts. Scope: **documentation only** — rebase
`README.md` to the current nine-workflow pipeline and produce the three operational docs
(`docs/CONTAINER-RUNBOOK.md`, `docs/CREDENTIALS.md` in the required per-workflow format,
`docs/ARTIFACT-IMPORT.md`).

Method (read → diagnose → plan → implement → verify → report):

1. Read the existing `README.md`, `docs/CREDENTIALS.md`,
   `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md`, `docs/PHASES.md`, `REPORT.md`, and the root
   workflow specs to establish accurate per-stage facts.
2. Verified artifact-level facts before writing (not assumed):
   - Current Prospect Finder node count = **32** (7 Google Sheets nodes, 3 HTTP provider
     nodes: Foursquare / OpenStreetMap Overpass / Google Places, 5-input append Merge).
   - Google Places node reads `{{ $env.GOOGLE_PLACES_API_KEY }}` (artifact line ~flag:
     header `X-Goog-Api-Key`); Foursquare node references `httpHeaderAuth` credential
     `Foursquare API` (id `912eb72c-…`); no embedded credential data in any export.
   - Pinned spreadsheet id `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`; tabs Search
     Inputs (gid=0), Raw Leads (gid=101), Verified Leads (gid=102) confirmed in the
     shipped artifact; Approved Outreach / Outreach Log / Response Log referenced by specs.
   - `Response-Interpretation V1.json`: 5 nodes, single Google Sheets node
     (`Read Response Log`); **no top-level `id`** in the export. Prospect Finder **has** a
     top-level `id` (`WcUgtTPiKXPL0BLH`); Approved Outreach does not.
   - `.github/workflows/test.yml` **does not exist** → README must not claim CI exists
     (CI is H-C scope).
   - `reports/PROSPECT-FINDER-ISOLATION-MATRIX-FINAL.md` **does not exist** → all status
     claims cite the real reports (`PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`,
     `PROSPECT-FINDER-GPL-PREFLIGHT.md`, `PROSPECT-FINDER-ISOLATION-MATRIX.md`).
3. Wrote the documents (below), then verified links, rendering, and offline gates.

## 2. What Was Changed

| File | Change |
| --- | --- |
| `README.md` | **Full rebase.** Replaced the single-workflow (Prospect Finder-era) readme with the nine-workflow pipeline document: §1.1 what the repo is, §1.2 nine workflows in lineage order with one-line roles and export filenames, §1.3 architecture, §1.4 single-spreadsheet contract (tabs/gids + frozen-positional link), §1.5 how to run (offline gates + container link), §1.6 key documents, §1.7 honest per-workflow status. |
| `docs/CREDENTIALS.md` | **Rewritten/augmented** to the required per-workflow format: §2 table `Workflow \| Node \| Credential type \| Required env var (if any)` covering Prospect Finder (7 Sheets nodes + Foursquare httpHeaderAuth + Google Places `GOOGLE_PLACES_API_KEY` env var) and Response Interpretation (1 Sheets node); remaining 7 workflows marked `not yet audited` with attach guidance. Prominent DB-local credential-id warning (§1), audit inventory, attach checklist, hygiene, and the H2/H5 secret-scan evidence preserved. |
| `docs/CONTAINER-RUNBOOK.md` | **New.** §2.1 canonical `docker run` (named volume `serene_swartz_data`, `-p 5678:5678`, do NOT set `N8N_RUNNERS_BROKER_PORT` on the container, do NOT use `--rm`); §2.2 first-launch; §2.3 import summary; §2.4 credential re-attachment (DB-local ids, active re-select in UI, no survival across container removal); §2.5 version-annotated gotchas (`n8n execute --file` broken in 2.38.7, manual-trigger cannot be API-triggered, `docker exec -e N8N_RUNNERS_BROKER_PORT=5680` when server holds 5679, `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` for `{{ $env.X }}`, credential loss on rebuild, rotate keys); §2.6 rebuild-from-scratch checklist (8 steps); §2.7 broker-port convention (server 5679, CLI 5680, never share). |
| `docs/ARTIFACT-IMPORT.md` | **New.** §4.1 UI import (recommended); §4.2 CLI import (`docker exec -u node … n8n import:workflow --input=…`; fails without top-level `id` with `SQLITE_CONSTRAINT: NOT NULL constraint failed: workflow_entity.id`); §4.3 API POST (`POST /api/v1/workflows`; rejects read-only fields `active, meta, tags, id, versionId, createdAt, updatedAt, triggerCount, isArchived, shared`; rejects `null` `settings`); §4.4 decision matrix (has id? / fresh DB? → CLI / UI-or-PUT / UI / UI-or-API-POST-strip) plus import-time credential note. |

No file outside `README.md` and `docs/` was touched. No workflow artifact, source, test,
fixture, manifest, `.env.example`, `.gitignore`, `REPORT.md`, or `docs/PHASES.md` was
modified (Phases/REPORT stay untouched for H-C).

## 3. What Was Verified

- Artifact read-through before writing: node counts, sheet-node set, provider endpoints,
  credentials/env references, tab gids, top-level `id` presence — all verified against the
  on-disk JSON (not assumed).
- Credential facts cross-checked against the H2–H5 audit content preserved from the prior
  `docs/CREDENTIALS.md` and the H-A security baseline report.
- Status claims cite existing reports only (`REPORT.md`, `docs/PHASES.md`,
  `PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`, `PROSPECT-FINDER-GPL-PREFLIGHT.md`,
  `PROSPECT-FINDER-ISOLATION-MATRIX.md`). No fabricated statuses; GPL parked state and the
  missing `-FINAL.md` file are handled with the real filenames.

## 4. Gaps / Notes (honest)

- **`npm run security-check` does not exist as an npm script** in `package.json` — the
  scanner is `node scripts/security-check.js`. README §1.5 documents the **real working
  command**. (The prompt's sample line listed `npm run security-check`; the repo has no
  such script, and fabricating one would require a `package.json` change out of scope.)
- **Stage statuses 2–8 are "shipped / not declared live-validated".** Only Response
  Interpretation (COMPLETE, closed) and Prospect Finder GPL validation (PARKED — PARTIAL)
  have formal workstream verdicts. The README states this honestly instead of asserting
  PASS for stages without live evidence.
- The Google Places lane is present in the artifact and documented (env var,
  `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` requirement, 403-enablement gotcha) even though the
  GPL validation workstream is parked.

## 5. Gate Results

| Gate | Command | Result |
| --- | --- | --- |
| Full offline suite | `npm test` | **857/857 PASS, 62 suites**, 0 fail/skip/cancel |
| Frozen manifest integrity | `npm run verify:frozen` | **10/10 PASS** (SHA-256 match) |
| Secret-shape scan | `node scripts/security-check.js` | **exit 0** (no hardcoded Foursquare key) |
| README renders | heading check + gate triple-backtick balance | all §1.1–1.7 present, balanced fences, no broken tables |
| Markdown link resolution | `Test-Path` loop over README + `docs/*.md` link targets | **ALL LINKS RESOLVE** (README and every `docs/*.md`) |

## 6. Security Statement

- No credential **values** appear anywhere in the new/updated documents — env var names
  only, no tokens, no API keys, no private URLs beyond `http://localhost:5678`.
- `.gitignore` unchanged; no files were added to ignore rules during H-B.
- The Google Places key, Foursquare token, and OAuth material remain reference-only in the
  repository (see `docs/CREDENTIALS.md` §1, §6, §7).

## 7. No-Workflow-Artifact-Modification Statement

**H-B modified no workflow artifact and no source/test/script/fixture/manifest file.**
`verify:frozen` 10/10 and `npm test` 857/857 confirm the untouched state. Changes are
strictly `README.md` + three `docs/*.md` files.

## 8. H-C Readiness

The documentation rebase in this prompt was specified to stop before CI. **H-C (CI, e.g.
`.github/workflows/test.yml`) is ready to proceed** — the README intentionally does not
claim CI exists, and the distinction between "repo has offline gates" (true) and "repo
has CI" (H-C) is made explicitly in §1.5/§1.7.

**STOP applied per prompt:** no CI was created, no push to any remote was performed, and
`REPORT.md` / `docs/PHASES.md` were not modified. H-C was not started.