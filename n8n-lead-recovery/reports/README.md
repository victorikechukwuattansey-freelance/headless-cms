# Reports Directory Index

Index of every file in `reports/`. **Nothing here is deleted** — superseded reports
stay for history. This index is maintained per-family; it enumerates the Response
Interpretation workstream fully and indexes the governing comprehensive reports plus
later workstream families (Prospect Finder GPL, enrichment/H.8–H.9) by report-name
reference (see `N8N-LEAD-RECOVERY-COMPREHENSIVE-REPORT-v2.md` §9 for the full list).
File counts on disk (2026-09-21): **43 `.md` + 214 run-report JSONs** (182
`RESPINT-LIVE-*` + 25 `ENRICH-LIVE-*` + 6 `BIZ-ENRICH-LIVE-*` + 1 captured-output
sample).

Status legend: **current** = the operative verdict; **superseded** = a later report
overrides its verdict (file retained); **evidence** = supporting run/output artifact;
**historical evidence** = superseded or superseded-in-part by later phases (retained;
archive/dedupe decision deferred to open item in `REPORT.md` §9).

---

## Phase / decision reports (`.md`)

| file | one-line summary | phase | status |
| --- | --- | --- | --- |
| `N8N-LEAD-RECOVERY-COMPREHENSIVE-REPORT.md` | Comprehensive repo report v1 (2026-09-16, basis `92ae00d`/A.11-R7) | all | **superseded** by v2; retained |
| `N8N-LEAD-RECOVERY-COMPREHENSIVE-REPORT-v2.md` | **Comprehensive repo report v2** (2026-09-21, basis `ebc5c3a`/H.9.4c) — 10 workflows, manifest v7/25 artifacts, 1289/127 suite, enrichment stack, git audit | all | **current** |
| `ENRICHMENT-PREFLIGHT-V1.md` | Enrichment preflight: formula ownership, provider selection, placement | H | current |
| `CONTACT-ENRICHMENT-PREFLIGHT-V1.md` | Contact-layer preflight: 4-tier matrix, sequencing, cost, compliance | H | current |
| `ENRICHMENT-H4-REV-REPORT.md` | AgentData provider support + freeze rebaseline (manifest v5 / R-ENRICH-2) | H.4 | current |
| `H7-AGENTDATA-PROBE-REPORT.md` | AgentData live probe — **PENDING** (no live request yet) | H.7 | current |
| `H8A-CONTAINER-SETUP-REPORT.md` | Sheet prep + container import + credential attach (operator evidence) | H.8a | current |
| `H8B-CONTAINER-SETUP-REPORT.md` | Engine-direct enrichment live runner shipped + defect fixes | H.8b | current |
| `H8B1-PREFLIGHT-OBSERVABILITY-REPORT.md` | Observability preflight (runner wiring) | H.8b.1 | current |
| `H8B2-VW-ORIENTATION-FIX-REPORT.md` | V/W orientation fix + positional preflight | H.8b.2 | current |
| `H8C-SCHEMA-RECONCILIATION-REPORT.md` | Schema reconciliation + country policy (D-C8; manifest v6) | H.8c | current |
| `H8D-HANDOFF-WRITE-NODE-RECONCILIATION-REPORT.md` | Handoff write map reconciled + Handoff enrolled (manifest v7) | H.8d | current |
| `H9-BUSINESS-ENRICHMENT-LIVE-RUNNER-REPORT.md` | Business enrichment live runner + production write scope | H.9 | current |
| `H9.1-BUSINESS-ENRICHMENT-LIVE-WRITE-SCOPE-REPORT.md` | Namespaced write-behaviour verification | H.9.1 | current |
| `H9.2-COUNTRY-NORMALIZATION-REPORT.md` | Country aliases for `isCountryInScope` | H.9.2 | current |
| `H9.3-LIVE-RUNNER-TRANSPORT-REPORT.md` | Live-runner transport wiring + per-lead outcomes (H.9.3) | H.9.3 | current |
| `PHASE-5-1-REPORT.md` | Workflow wiring correction + contract hardening (edges, orphan/unreachable, `$()` reachability) | 5.1 | current |
| `PHASE-5-2-REPORT.md` | Manual Trigger connection output-slot defect correction + slot contract validation | 5.2 | current |
| `PHASE-5-3-REPORT.md` | Live runner Sheets URL construction fix | 5.3 | current |
| `PHASE-5-4-REPORT.md` | Workflow topology fix (diamond → chain) + runner error surfacing | 5.4 | current |
| `PHASE-6-5-REPORT.md` | Test harness build: webhook payload injection bridge into the frozen chain | 6.5 | current |
| `PHASE-6-5-REVISION-REPORT.md` | Harness URL/env correction + empty-read `alwaysOutputData` exception; root cause + fix + live 200 | 6.5-rev | current — *note:* its §3 URL claim (workflow-id-prefixed path) is corrected by `PHASE-6-COMPLETION-AMENDMENT.md` §3 (standard n8n form; fix was the deactivate/reactivate cycle) |
| `PHASE-6-BLOCKER-REPORT.md` | Structural limitation of injecting at the Manual Trigger boundary, confirmed | 6 (pre-harness) | historical evidence (harness resolved the blocker) |
| `PHASE-6-FINAL-REPORT.md` | Live validation of scenarios A–F — **verdict PARTIAL** | 6 | **superseded** by `PHASE-6-COMPLETION-AMENDMENT.md` (PARTIAL → PASS) |
| `PHASE-6-COMPLETION-AMENDMENT.md` | Official PARTIAL → PASS; full A–F live matrix, all 8 stages PASS | 6 | current |
| `PHASE-6-response-interpretation-v1.md` | Early Phase 6 gate result — **FAIL / BLOCKED** (environment gate) | 6 (early) | historical evidence |
| `PHASE-6-response-interpretation-v1-rerun.md` | Early Phase 6 CLI-backend re-run — **FAIL / BLOCKED** + structural | 6 (early) | historical evidence |

## Canonical scenario run reports (Phase 6 completion — PASS)

One file per scenario (all 8 stages PASS). Deterministic run tokens (no secrets).

| scenario | token | file | status |
| --- | --- | --- | --- |
| A — healthy populated Response Log | `1a0990600` | `RESPINT-LIVE-1a0990600-response-interpretation-live.json` | current (PASS) |
| B — healthy empty Response Log | `1a0990616` | `RESPINT-LIVE-1a0990616-response-interpretation-live.json` | current (PASS) |
| C — response-log-failure | `1a0990669` | `RESPINT-LIVE-1a0990669-response-interpretation-live.json` | current (PASS) |
| D — reconciliation-failure | `1a0990696` | `RESPINT-LIVE-1a0990696-response-interpretation-live.json` | current (PASS) |
| E — upstream-incomplete | `1a0990648` | `RESPINT-LIVE-1a0990648-response-interpretation-live.json` | current (PASS) |
| F — double-failure | `1a0990620` | `RESPINT-LIVE-1a0990620-response-interpretation-live.json` | current (PASS) |

## Revision / verification run reports

| file | one-line summary | phase | status |
| --- | --- | --- | --- |
| `RESPINT-LIVE-RESPINT-REV-GATE-01-response-interpretation-live.json` | Phase 6.5-rev gate: real runner, DRY_RUN execute=PASS collect=PASS (verify leg not run — no live sheet creds) | 6.5-rev | evidence |
| `response-interpretation-live-output.json` | Captured CLI-backend collect output sample | 5 | evidence |

## Historical evidence run reports

Run reports before the harness (CLI/http backend) and harness transport probes before the
final matrix. All retained as evidence; some record `NOT_CONFIGURED` / `FAIL` /
500/404 conditions that later phases resolved. **Grouped by class** — every filename is
enumerated; per-file verdicts are class-homogeneous.

### Class A — pre-harness CLI/http live runs (44)

First live-run trace during the environment-gate and structural-block period plus CLI
happy-path evidence. Verdicts span `NOT_CONFIGURED` (env gate), `FAIL` (blocked /
structural), and PASS-happy-path. Phase 6 (early). Historical evidence.

```
RESPINT-LIVE-1a094bca542  RESPINT-LIVE-1a094bcca9e  RESPINT-LIVE-1a094bcf261
RESPINT-LIVE-1a094c19868  RESPINT-LIVE-1a094c1b1d1  RESPINT-LIVE-1a094c39d25
RESPINT-LIVE-1a094c3b532  RESPINT-LIVE-1a094c5091c  RESPINT-LIVE-1a094c56ea7
RESPINT-LIVE-1a094c5cce9  RESPINT-LIVE-1a094c5e503  RESPINT-LIVE-1a094cbdc68
RESPINT-LIVE-1a094f68c4b  RESPINT-LIVE-1a094f6d8e6  RESPINT-LIVE-1a094f74f4a
RESPINT-LIVE-1a094f74f97  RESPINT-LIVE-1a094f74fd9  RESPINT-LIVE-1a094f75019
RESPINT-LIVE-1a094f75080  RESPINT-LIVE-1a094f750ca  RESPINT-LIVE-1a094f924d1
RESPINT-LIVE-1a09509c0c5  RESPINT-LIVE-1a0950df0ed  RESPINT-LIVE-1a0954d0ce3
RESPINT-LIVE-1a0954ddd18  RESPINT-LIVE-1a0955a182a  RESPINT-LIVE-1a09597206b
RESPINT-LIVE-1a0959ca989  RESPINT-LIVE-1a095ac35ed  RESPINT-LIVE-1a095acde8b
RESPINT-LIVE-1a0961f756e  RESPINT-LIVE-1a096285523  RESPINT-LIVE-1a096762489
RESPINT-LIVE-1a0968eff50  RESPINT-LIVE-1a0968ff46d  RESPINT-LIVE-1a0987aa43f
RESPINT-LIVE-1a0987b227e  RESPINT-LIVE-1a0987b63e9  RESPINT-LIVE-1a0988a54f7
RESPINT-LIVE-1a0988af19d  RESPINT-LIVE-1a0989b458b  RESPINT-LIVE-1a0989b8b3c
RESPINT-LIVE-1a098a40a85  RESPINT-LIVE-1a098accb27
```

### Class B — harness transport probes, pre-revision (11)

Webhook-mode runs immediately after the harness was built; capture the `500-empty`
("No item to return was found") and standard-path 404 evidence that drove the 6.5-rev
empty-read fix. Phase 6.5 / 6.5-rev investigation. Historical evidence.

```
RESPINT-LIVE-1a0990001  RESPINT-LIVE-1a0990002  RESPINT-LIVE-1a0990010
RESPINT-LIVE-1a0990030  RESPINT-LIVE-1a0990100  RESPINT-LIVE-1a0990201
RESPINT-LIVE-1a0990225  RESPINT-LIVE-1a0990231  RESPINT-LIVE-1a0990253
RESPINT-LIVE-1a0990286  RESPINT-LIVE-1a0990292
```

### Class C — post-revision harness probe runs (15)

Webhook/investigation runs after the 6.5-rev changes (registration checks, transport
verification on the container). Phase 6.5-rev. Historical evidence.

```
RESPINT-LIVE-1a0997c4fcf  RESPINT-LIVE-1a0997f2d6e  RESPINT-LIVE-1a0997f6648
RESPINT-LIVE-1a099943b2b  RESPINT-LIVE-1a09997a099  RESPINT-LIVE-1a09999221b
RESPINT-LIVE-1a099a26d77  RESPINT-LIVE-1a099d334f4  RESPINT-LIVE-1a099d8a95c
RESPINT-LIVE-1a09a074580  RESPINT-LIVE-1a09a646d23  RESPINT-LIVE-1a09aa1fc5d
RESPINT-LIVE-1a09d45c6c3  RESPINT-LIVE-1a09d4edbe6  RESPINT-LIVE-1a09d7f65f4
```

### Class D — synthetic/sample tokens (3)

Placeholder/sample run tokens (not real executions with secrets). Historical evidence.

```
RESPINT-LIVE-0000abcd-response-interpretation-live.json
RESPINT-LIVE-00aa11bb22cc-response-interpretation-live.json
RESPINT-LIVE-a3f0c2d9e8b17d46-response-interpretation-live.json
```

---

## Counts and integrity

- `.md` reports: **43** (indexed per-family above: RI phase/decision, comprehensive,
  Prospect Finder GPL, enrichment/H.8–H.9, hygiene).
- Run-report JSONs on disk: **214** (see §summary: 182 `RESPINT-LIVE-*` + 25
  `ENRICH-LIVE-*` + 6 `BIZ-ENRICH-LIVE-*` + 1 captured output). The RI JSON catalog
  below enumerates the 182 `RESPINT-LIVE-*` fully; the enrichment live-run JSONs are
  governed by the H.8b/H.9 reports.
- Archive/dedupe of historical run reports is **deferred** (decision required; see
  `REPORT.md` §9 item 10). Nothing is removed without an explicit decision.
- No credentials, keys, or private URLs are stored in any file here; run reports carry
  run ids and stage maps only.