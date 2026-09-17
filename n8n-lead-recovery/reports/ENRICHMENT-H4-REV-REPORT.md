# Enrichment — H.4-rev: AgentData Provider Support

**Prompt:** H.4-rev — enrichment provider support (AgentData default, Hunter selectable).
**Scope:** contact-enrichment provider integration — new default provider (AgentData), the
retained selectable fallback (Hunter), fixtures/tests, docs, and the frozen-artifact rebaseline.
**Deliverable:** this document (`reports/ENRICHMENT-H4-REV-REPORT.md`).
**Date:** 2026-09-17
**Branch:** `pre-cleanup-2026-09-08`
**Related:** `docs/OPEN-SOURCE-ENRICHMENT.md`, `docs/AGENTDATA-API.md`,
`reports/CONTACT-ENRICHMENT-PREFLIGHT-V1.md`.
**Verdict:** **PASS (implementation + tests + freeze complete). Live endpoint probe PENDING an
`AGENTDATA_API_KEY`; H.7 remains gated on that probe + an explicit request.**

---

## 1. Summary

AgentData (`https://agentdata.run`) is now the **default** contact-enrichment provider for the
Enrichment V1 workflow, with Hunter retained as a selectable provider. The client, engine, embedded
mirror, and workflow builder were re-implemented around a single `domainSearch()` contract:

```
{ emails: [{ email, confidence, verification_status, first_name, last_name, position }], source, creditsUsed }
```

with **thrown** errors (`.fatal` / `.reason` / `.status`) instead of the previous
`{ ok:false }` envelope. Env reads stay confined to the runner-only client; the shipped workflow
consumes provider seams (`provider`, `agentdataResults`, `agentdataFailures`) and remains
credential-free.

**Section verdicts**

| Section | Verdict |
| ------- | ------- |
| §2 Client (`src/enrichment-contact-client.js`) | PASS |
| §3 Engine (`src/enrichment-contact.js`) | PASS |
| §4 Embedded mirror (`src/embedded-enrichment-contact.js`) | PASS |
| §5 Builder (`scripts/build-enrichment-workflow.js`) | PASS |
| §6 Fixtures (hunter migration + AgentData goldens + loader) | PASS |
| §7 Tests | PASS |
| §8 Docs, `.env.example`, security scan | PASS |
| §9 Freeze rebaseline (v5 / R-ENRICH-2) | PASS |
| §10 Gates | PASS |
| §11 Live provider probe | **PENDING** (no key) |
| §12 D2-FORMULA | **PARKED** (operator input owed) |

---

## 2. Client — `src/enrichment-contact-client.js`

- **Dispatch:** `createContactClient(opts)`; `provider = opts.provider || process.env.ENRICHMENT_PROVIDER || 'agentdata'`.
  Unknown provider → fatal throw `enrichment-client: unknown provider '<provider>'`.
- **AgentData (default):** `GET https://agentdata.run/api/v1/lookup?domain=…&min_confidence=90&verification_status=valid,catch-all`,
  `Authorization: Bearer <AGENTDATA_API_KEY>`.
  - Pacing: pure `paceDelayFor(lastCallAt, now, minPacingMs)` (200 ms min, first call immediate) with injected `sleep`/`clock`.
  - Retries: `[500, 1500, 4500]` (injectable) on 429 / 5xx / transport failure → then non-fatal throw.
  - 401 / 403 → **fatal**, no retry. Other 4xx → empty `{emails:[], source, creditsUsed:0}`, no retry.
  - Status-0 bodyless → non-fatal `unknown response` throw.
  - Item normalization: `email ← email|value`, `confidence ← confidence|score`, `catch-all → valid`,
    optional `first_name`/`last_name`/`position`; key never logged or leaked in error text.
- **Hunter (retained):** canonical item output, throwing error contract, `api_key` query + backoff preserved; `search` alias kept.
- **apiKey fallback:** `String(opts.apiKey || envKey || '')` — an explicitly-empty value falls back to env (both providers).

## 3. Engine — `src/enrichment-contact.js`

- `provider = opts.provider || (client && client.provider) || 'agentdata'`; lookup prefers `client.domainSearch`, else `client.search`.
- Thrown-error mapping: `fatal===true` halts the batch (all remaining leads failed); any other throw defers the current lead; `no_client_configured` is fatal when no lookup fn exists.
- Tolerant readers: `emailOf` (`email|value`), `scoreOf` (`confidence|score`), `verifiedOf` (`verification_status==='valid'` or legacy `verified` truthy set).
- Credits: `Number(creditsUsed)` when finite, else 1; 200-empty (`no_emails_found`) charges 1; a 4xx-empty carries 0.
- Envelope now includes `provider`; `SKIP_REASONS` frozen; OSS module untouched.

## 4. Embedded mirror — `src/embedded-enrichment-contact.js`

- Self-contained mirror composes schema + cache + contact sources, strips `require`/header lines.
- Seam client selects the failure/result maps by `payload.provider || 'agentdata'`
  (`agentdataResults`/`agentdataFailures` vs `hunterResults`/`hunterFailures`).
- Every failure-map entry throws back into the embedded engine (fatal preserved); absent result
  entries yield `{emails:[], source:provider, creditsUsed:0}`.
- Clock read from `payload.now || payload.run_timestamp`; no `process.env` / `Date.now` / `Math.random`.

## 5. Builder — `scripts/build-enrichment-workflow.js`

- `PREPARE_ENRICHMENT_SCOPE_CODE` injects `provider`, `agentdataResults`, `agentdataFailures` (hunter seams retained).
- `CONSOLIDATE_ENRICHMENT_RESULTS_CODE` adds `contact_provider`.
- `REPORT_ENRICHMENT_RUN_CODE` emits a provider-dynamic `provider_runs` key (`[contactProvider]`); `oss` stays static.
- `Enrich Contact` node id renamed `enrich-contact-hunt-0001` → `enrich-contact-0001`; meta fatal-behavior wording provider-neutral (AgentData/Hunter). Topology unchanged (16 nodes, 8 code nodes, 2 sheet writes).

## 6. Fixtures

- `fixtures/enrichment-contact-fixtures.json` — hunter fixtures 007–013 gained `"provider":"hunter"` and their
  `domainResults` emails were migrated to the canonical item shape; **expected goldens byte-same** (021-B asserted `valid`).
- `fixtures/enrichment-contact-agentdata.json` — **NEW** goldens:
  | Fixture | Scenario |
  | ------- | -------- |
  | TEST-ENRICH-020 | fresh best-email hit, fill-only-empty, pre-existing `contact_name` preserved |
  | TEST-ENRICH-021 | name edges — single-token first name, absent name parts |
  | TEST-ENRICH-022 | `no_emails_found`, credit 1 |
  | TEST-ENRICH-024 | fatal auth halt over 2 leads |
  | TEST-ENRICH-025 | server error defers lead A, lead B enriches |
  | TEST-ENRICH-026 | in-process cache hit 2 → 3 (`::agentdata`) |
- `fixtures/enrichment-fixtures.js` — exports `AGENTDATA_CONTACT_FIXTURES_PATH`, clones the `provider` field.

## 7. Tests

| Suite | Result |
| ----- | ------ |
| `tests/enrichment-contact-client.test.js` | **42 / 42 PASS** |
| `tests/enrichment-contact-engine.test.js` | **26 / 26 PASS** |
| `tests/enrichment-workflow-build.test.js` | **31 / 31 PASS** |
| `npm run enrichment:test` (engine + workflow-build) | **57 / 57 PASS** |
| `npm test` (full repo) | **1142 / 1142 PASS** (92 suites; H.6 baseline was 1108, +34) |

The workflow-build suite now loads both fixture files, uses provider-aware seams, asserts
AgentData chain lineage for 020 (`provider_runs.agentdata.credits_consumed===1`,
`contact_provider==='agentdata'`, `::agentdata` key) and 026 (re-carried incremented `cache_hit_count`).

## 8. Docs, env, security

- `docs/AGENTDATA-API.md` — **NEW**: assumed wire contract, error/credit matrix, pacing, runner-only access, probe-PENDING banner.
- `docs/OPEN-SOURCE-ENRICHMENT.md` — updated execution semantics (provider-labeled contact pass, `contact_provider`, dynamic report), security posture, env block, test baseline (1142), freeze reference R-ENRICH-2.
- `.env.example` — adds `ENRICHMENT_PROVIDER=agentdata`, `AGENTDATA_API_KEY=`, keeps `HUNTER_API_KEY`/`HUNTER_TRANSPORT`.
- `scripts/security-check.js` — extended with `/AGENTDATA_[A-Z_]*KEY/`.
- `npm run enrichment:security` — **PASS**: no credential, `Authorization`, `$env`, `process.env`, or fixture-domain material in the shipped `Enrichment V1.json`.

## 9. Freeze rebaseline — manifest v5 / R-ENRICH-2

`frozen-artifacts.manifest.json` raised to **version 5**, **24 artifacts**, revision **R-ENRICH-2**.
`npm run verify:frozen` → **PASS: 24 frozen artifact(s) verified**.

Re-baselined / added:

| Artifact | Result |
| -------- | ------ |
| `src/enrichment-contact.js` | re-baselined |
| `src/enrichment-contact-client.js` | re-baselined |
| `src/embedded-enrichment-contact.js` | re-baselined |
| `fixtures/enrichment-contact-fixtures.json` | re-baselined |
| `fixtures/enrichment-fixtures.js` | re-baselined |
| `Enrichment V1.json` | rebuilt (`2a20f2f9…` → `f6ecb0e8…`) |
| `fixtures/enrichment-contact-agentdata.json` | **NEW** |

Unchanged (verified byte-identical): schema/cache/business/OSS sources + OSS mirror, business mirror, all Phase 1–6.5 artifacts.

## 10. Gates

| Gate | Command | Result |
| ---- | ------- | ------ |
| Full suite | `npm test` | PASS (1142/1142) |
| Enrichment suite | `npm run enrichment:test` | PASS (57/57) |
| Security scan | `npm run enrichment:security` | PASS (0 hits) |
| Freeze | `npm run verify:frozen` | PASS (24/24) |
| Build determinism | `npm run enrichment:build` ×2 | PASS — byte-identical (`f6ecb0e8ba5367372b74151c11466a1be35c3378a5fdf48f04621978f39b6770`) |

## 11. Deferred / blocked

- **Live provider probe — PENDING.** No `AGENTDATA_API_KEY` was supplied. When available, run **one**
  probe (`GET https://agentdata.run/api/v1/lookup?domain=stripe.com&min_confidence=90`,
  `Authorization: Bearer <key>`, key redacted, `stripe.com` only) and record the result in
  `docs/AGENTDATA-API.md`, replacing the assumed contract if it differs (code change → re-baseline).
- **H.7 — gated** on the probe plus an explicit operator request. Not started.
- **D2-FORMULA — PARKED.** Separate workstream (qualification-formula revision); operator still owes
  the current Q1 ARRAYFORMULA and a design choice. No action taken this session.

## 12. Operator next actions

1. Provide `AGENTDATA_API_KEY` to run the single §11 probe (or defer).
2. Approve/decline H.7 (live end-to-end enrichment run).
3. Supply D2-FORMULA inputs to unpark that workstream.

**No further implementation work is queued for H.4-rev — stopping for operator action.**
