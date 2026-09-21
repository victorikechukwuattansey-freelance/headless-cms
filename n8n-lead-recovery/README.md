# Lead Recovery Engine — ten-workflow n8n pipeline

A local-first pipeline of ten n8n workflows for the **Lead Recovery Engine**: prospect
discovery and validation, approval gating, outreach queue planning, execution delivery,
enrichment, and response interpretation. Every workflow is shipped as a JSON export plus
a written spec, an offline test suite, and a live-runner/harness. The whole pipeline runs
against a **single Google Sheets spreadsheet** whose tabs are the durable data surface.

---

## 1.1 What this repository is

`n8n-lead-recovery/` contains the **Lead Recovery Engine** — a pipeline of ten n8n
workflows plus the deterministic engines those workflows embed. It is not an external
service and it is not a SaaS; it is a portable set of n8n workflow artifacts with the
offline suite and live-runner tooling needed to validate and run them against one pinned
Google spreadsheet.

- **Delivery:** 10 workflow JSON exports (see §1.2), 8 spec documents + 2 Phase 6/7 design docs, offline engines in
  `src/`, a live-runner per workflow, and a frozen-artifact manifest
  (`frozen-artifacts.manifest.json` + `scripts/verify-frozen.js`).
- **Environment:** n8n Community Edition in Docker (the development container is
  `serene_swartz`, holding the workflow DB at `/home/node/.n8n/database.sqlite`). See
  `docs/CONTAINER-RUNBOOK.md` for the canonical run, import, and credential steps.
- **Hygiene:** the repository carries no committed secret values; credentials are
  referenced by id/name only and must be re-attached after import. Baseline evidence:
  `reports/HYGIENE-H-A-SECURITY-GIT-BASELINE-REPORT.md`.

## 1.2 The ten workflows and their lineage

Each stage consumes the durable tab(s) the previous stage wrote. The lineage order is the
order in which data flows:

| # | Workflow | Export file | One-line role |
| --- | --- | --- | --- |
| 1 | Prospect Finder & Validation V1 | `Lead Recovery Engine — Prospect Finder & Validation V1.json` | Queries **Foursquare + OpenStreetMap (Overpass) + Google Places** in parallel with a 5-input append-mode Merge, dedupes, and writes **Verified Leads**. |
| 2 | Approved Outreach Handoff V1 | `Approved Outreach Handoff V1.json` | The **approval gate**: promotes `Verified Leads` rows that earn a manual approval into the **Approved Outreach** approval ledger (schema shared via `src/schema.js`). |
| 3 | Run Reconciliation V1 | `Run-Reconciliation-and-Reporting V1.json` | Read-only consistency checker between **Approved Outreach** and the **Outreach Log**; reports gaps/duplicates/violations as a structured report (no report tab — output is workflow-level). |
| 4 | Outreach Queue & Planning V1 | `Outreach-Queue-and-Planning V1.json` | Re-derives the queue from **Approved Outreach** and builds the readiness/priority/channel queue for approved leads. |
| 5 | Outreach Execution & Delivery V1 | `Outreach-Execution-and-Delivery V1.json` | Determines which `READY` queue work goes out, to whom, via which pre-computed channel; produces the durable **Outreach Log** row. Provider delivery is out of scope of V1 (typed provider boundary). |
| 6 | Execution Reconciliation V1 | `Execution-Reconciliation V1.json` | Read-only: verifies every provider-confirmed execution is reflected in the **Outreach Log** and every log row is traceable to a documented execution. |
| 7 | Response Capture V1 | `Response-Capture V1.json` | Turns normalized inbound provider events into deduplicated, identity-checked **Response Log** rows; never guesses a lead identity (unmatched events are kept as durable `UNMATCHED` rows). |
| 8 | Response Reconciliation V1 | `Response-Reconciliation V1.json` | Read-only: verifies every captured response is traceable to a confirmed outbound attempt; unprovable traces are marked `NOT_VERIFIABLE`, never guessed. |
| 9 | Response Interpretation V1 | `Response-Interpretation V1.json` | Read-only intent classifier: turns durable **Response Log** text into classified intents (positive/negative/neutral, action type). This is the **complete, live-validated** stage. |
| 10 | Enrichment V1 | `Enrichment V1.json` | Business + contact enrichment: AgentData (default) / Hunter (secondary) sourcing with OSS verification; writes the **Contact Enrichment Log** and Enrichment-owned **Approved Outreach** columns. **Email-scope only** (no phone sourcing). |

A test-only auxiliary artifact exists alongside the lineage:
`Response-Interpretation V1 — Test Harness.json` (Phase 6.5 webhook→Manual-Trigger bridge
used to inject scenario payloads into the frozen Response Interpretation chain). It is not
a pipeline stage.

## 1.3 Architecture

- **Single spreadsheet, single source of truth.** All ten workflows read/write the same
  pinned Google spreadsheet (id `1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`). Tabs are
  the durable data surface; actors above (planning/reconciliation/interpretation) are
  read-only where possible.
- **Built-in engines, embedded code.** Each stage's behavior lives in a deterministic
  engine under `src/` (e.g. `src/response-interpretation.js`, `src/reconcile.js`,
  `src/queue.js`, `src/execution.js`, `src/response-capture.js`,
  `src/response-reconcile.js`) that is byte-mirrored into the shipped workflow's Code
  nodes. Offline suites verify engine↔embedded-code parity on every fixture.
- **Fail-closed honesty.** Read-only stages never fabricate a healthy zero: a failed read
  yields `INCOMPLETE`/`NOT_VERIFIABLE` with null metrics, never a false PASS. Live runners
  print `NOT_CONFIGURED` (exit 3) instead of a fake PASS when the environment is missing.
- **No hard-coded secrets.** Provider credentials are referenced by n8n credential id/name
  only. The only env-var-backed key in the shipped artifacts is
  `GOOGLE_PLACES_API_KEY` (Google Places node of the Prospect Finder). See
  `docs/CREDENTIALS.md`.

## 1.4 The single-spreadsheet contract

The pipeline runs against one pinned spreadsheet
(`1KN-mAYQnCFJJpHofvDmelGK2eMDyPs-TXVZGMKllHFQ`). The tab names and positions currently
referenced by the shipped workflows:

| Tab | gid | Written by | Notes |
| --- | --- | --- | --- |
| Search Inputs | `0` | (operated by user / seeding) | Status-driven search list; statuses `Pending`/`Running`/`Completed`/`Failed`. Read by Prospect Finder. |
| Raw Leads | `101` | Prospect Finder | Dedupe-keyed raw captures from Foursquare/OSM/GPL. |
| Verified Leads | `102` | Prospect Finder | Formula-owned columns P–U (dedupe key, lead score, qualification status) are never written by n8n. |
| Approved Outreach | — | Approved Outreach Handoff | 24-column approval ledger — Handoff owns the first 21 (schema `src/schema.js`, shared with Run Reconciliation); Enrichment owns the last 3 (`contact_source_provider`, `contact_blocked`, `country`). |
| Outreach Log | — | Outreach Execution & Delivery | 22-column durable per-lead delivery row ending `notes` (T), `status` (U), `provider_message_id` (V) — `OUTREACH_COLUMNS` in `src/reconcile.js` is the source of truth; read by Run Reconciliation. |
| Response Log | — | Response Capture | Durable inbound-response rows; read by Response Reconciliation and Response Interpretation. |

The **positional schemas are frozen artifacts** — column order and header semantics are
asserted by the offline suites and documented per-spec. Evidence and fix history:
`reports/PHASE-5-2-REPORT.md`, `reports/PHASE-5-3-REPORT.md`, `reports/PHASE-5-4-REPORT.md`
and the verification harness in `GOOGLE-SHEETS-VERIFICATION-HARNESS-v0.1.md`.

## 1.5 How to run

Offline validation (no live environment required):

```powershell
npm test                          # hermetic unit tests (1289 pass / 127 suites / 0 fail, no creds)
npm run verify:queue              # stage-isolation, live sheet, creds required
npm run verify:dry                # execution-boundary DRY_RUN, live sheet, creds required
npm run verify:dup                # dedup + malformed-row gate, hermetic, CI-safe
npm run verify:frozen             # freeze-gate: 25 manifest artifacts vs recorded SHA-256 (manifest v7)
npm run enrichment:security       # enrichment security gate (secret-shape scan)
```

Live execution runs against the pinned spreadsheet and the n8n container. The canonical
container setup, first-launch steps, import summary, credential re-attachment, and
known gotchas are in **`docs/CONTAINER-RUNBOOK.md`**. The vintage.env-laden Phase 6
live-runner environment (Response Interpretation V1) is documented in
`docs/PHASE-6-ENVIRONMENT-RUNBOOK.md`.

## 1.6 Key documents

| Document | What it is |
| --- | --- |
| `REPORT.md` | Master report & workstream close for Response Interpretation V1 (the fully-validated stage). |
| `docs/PHASES.md` | Phase index (14 phases, 13 PASS + 1 superseded-amendment PASS). |
| `docs/CONTAINER-RUNBOOK.md` | Canonical Docker run, first-launch, import, credentials, gotchas. |
| `docs/CREDENTIALS.md` | Credential inventory — per-workflow node→credential→env-var map. |
| `docs/ARTIFACT-IMPORT.md` | UI / CLI / API import paths + decision matrix for the workflow exports. |
| `docs/PHASE-6-ENVIRONMENT-RUNBOOK.md` | Response Interpretation live-runner env vars and provision steps. |
| `docs/MANIFEST-SNAPSHOT.md` | Snapshot of the frozen manifest. |
| `docs/QUALIFICATION-FORMULA.md` | Verified Leads qualification contract (Q:U formula) — thresholds, revision history, change protocol, sheet-edit instructions. |
| `RESEND-REAL-EMAIL-DELIVERY-v1.md` | Doc 1 — Phase 6/7 design: Resend real email delivery (provider adapter, message-body resolution, execution boundary). |
| `MALFORMED-ROW-FAIL-CLOSED-v1.md` | Doc 2 — Phase 6/7 design: malformed-row fail-closed gate; **implemented** (`ccfb6e5`). |
| `reports/` index | `reports/README.md` — all phase, isolation, and hygiene reports. |

## 1.7 Status

Honest per-workflow status as of the H-B hygiene workstream:

| Stage | Status | Evidence |
| --- | --- | --- |
| Response Interpretation V1 | **COMPLETE** — live-validated A–F; workstream closed | `REPORT.md`, `docs/PHASES.md`, `reports/PHASE-6-COMPLETION-AMENDMENT.md` |
| Prospect Finder & Validation V1 | **PARKED — PARTIAL** — Foursquare/OSM lanes validated; Google Places validation workstream parked (live isolation blocked by an n8n 2.x Merge migration + GPL enablement requirement) | `reports/PROSPECT-FINDER-GPL-WORKSTREAM-CLOSURE.md`, `reports/PROSPECT-FINDER-GPL-PREFLIGHT.md`, `reports/PROSPECT-FINDER-ISOLATION-MATRIX.md` |
| Approved Outreach Handoff V1 | Shipped (artifact + spec + harness); live credential attach pending | `APPROVED-OUTREACH-HANDOFF-v0.1.md`, `GOOGLE-SHEETS-VERIFICATION-HARNESS-v0.1.md` |
| Run Reconciliation V1 | Shipped (artifact + spec + offline/live suites) | `RUN-RECONCILIATION-AND-REPORTING-v1.md` |
| Outreach Queue & Planning V1 | Shipped (artifact + spec + offline/live suites) | `OUTREACH-QUEUE-AND-PLANNING-v1.md` |
| Outreach Execution & Delivery V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-AND-DELIVERY-v1.md` |
| Execution Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-EXECUTION-RECONCILIATION-v1.md` |
| Response Capture V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-CAPTURE-v1.md` |
| Response Reconciliation V1 | Shipped (artifact + spec + offline suites) | `OUTREACH-RESPONSE-RECONCILIATION-v1.md` |
| Enrichment V1 | **Shipped, frozen (manifest v6/v7)**, live-runner tested (H.8b, H.9) — email-scope only; no phone sourcing | `reports/ENRICHMENT-PREFLIGHT-V1.md`, `reports/H9-BUSINESS-ENRICHMENT-LIVE-RUNNER-REPORT.md` |

Offline gates are green for the whole repository (`npm test` 1289/1289, `verify:frozen`
25/25, manifest v7). No workflow is claimed live-validated unless the report says so with
evidence.

**Phase 6/7 state:** the pipeline is proven end-to-end through `DRY_RUN` against real
leads (queue → gate → payload → send boundary). `RESEND-REAL-EMAIL-DELIVERY-v1.md` (Doc 1)
and `MALFORMED-ROW-FAIL-CLOSED-v1.md` (Doc 2) are committed design artifacts; Doc 2 is
implemented (`ccfb6e5`); the 22-column Outreach Log header migration landed (`8a6e84b`).
The **Resend adapter** is pending sandbox verification of `Idempotency-Key` behavior ahead
of live enablement.

---

*Rebased by the H-B hygiene workstream (documentation only — no artifacts modified).*