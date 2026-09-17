# H.7 Report — AgentData Live Probe + Workflow Wiring Test

**Date:** 2026-09-17
**Workstream:** Lead Enrichment — Live Validation
**Result:** **BLOCKED — live probe could not be executed (no API key).**
Offline wiring verification **PASS** (with one expectation mismatch); `docs/AGENTDATA-API.md`
probe status remains **PENDING**.

> Honesty gate: no live request was made because `AGENTDATA_API_KEY` is not available to this
> session (not in the process environment, no `.env` file in the repo, `.env.example` only
> documents the placeholder). This report records **what was verified offline** and the exact
> blocker. No artifact, manifest, or workflow file was modified. No credit was consumed.

---

## 1. Probe result

| Item | Result |
| --- | --- |
| HTTP status | **NOT EXECUTED** — no `AGENTDATA_API_KEY` in environment (checked `$env:` and repo `.env`; absent). A call with an empty Bearer token would return 401 and prove nothing, so it was not wasted. |
| Response keys present | **NOT CAPTURED** — pending operator-supplied key. `docs/AGENTDATA-API.md` line 8-12 still says "Probe status: PENDING." |

## 2. Field-by-field match against `docs/AGENTDATA-API.md`

**Cannot be completed until a live response exists.** A preview of the contract surfaces two
**expectation gaps** between the probe sheet and the checked-in docs — flagged now so the operator
knows what the probe is really testing:

| Field | `docs/AGENTDATA-API.md` §"Success response" (lines 33-50) | H.7 probe sheet expectation | Status |
| --- | --- | --- | --- |
| Envelope | `domain`, `min_confidence`, `emails[]` | `emails.data[]` | **GAP — docs do not document `emails.data[]`; the client tolerates both (`src/enrichment-contact-client.js` `firstEmailArray`, lines 144-150)** |
| Email keys | `email`, `confidence`, `verification_status`, `first_name`, `last_name`, `position` | `email`, `name`, `title`, `confidence`, `verification_status`, `is_role_based` | **GAP — `name`/`title`/`is_role_based` are not in the docs; the client maps `name→first/last` and `title→position` defensively (lines 133-142, 166)** |
| `lookup` object | not documented | `consumed`, `remaining`, `cached_until` | **GAP — not parsed by the client; credits are hard-coded `1` per executed lookup (line 171)** |
| Cache-on-revisit (`cached_until`) | not documented | second call within 30 days free (`consumed: false`) | **GAP — not consumed by the client; cache is local (Contact Enrichment Log TTL), not provider** |

Net: docs and probe sheet disagree on the response shape, so the probe verdict will be on the
**live response shape**, not the docs. That is exactly what H.7 is for. Current state:
**docs are unverified; no live evidence exists.**

## 3. Workflow wiring test — offline (PASS with one expectation mismatch)

### 3a. The H.7 §3 inspection sheet assumed an HTTP request node

The Enrichment V1.json artifact is built by `scripts/build-enrichment-workflow.js` and the
`n8n-nodes-base.httpRequest` type is **banned** (verified: `tests/enrichment-workflow-build.test.js`
line ~384 bans `httpRequest`, `hunter`, `clearbit` node types). The 16 nodes are all
`manualTrigger` / `googleSheets` / `code` / `if` / `noOp`. So the sheet's command:

    Where-Object { $_.type -eq "n8n-nodes-base.httpRequest" }

**returns nothing by design.** This is not "H.4-rev's rebuild did not take" — the network call is
deliberately not in the workflow. The correct wiring check is 3b.

### 3b. Where AgentData is actually wired (verified)

Provider transport lives in the **runner-adjacent client** `src/enrichment-contact-client.js` —
the only module allowed to read `process.env` (never shipped inside the workflow; the workflow
consumes pre-injected seams `agentdataResults` / `agentdataFailures`, selected by `payload.provider`
defaulting to `agentdata`).

Verified (internal, read-only):

- **URL contract:** `buildAgentDataUrl` (lines 174-184) produces
  `{base}/api/v1/lookup?domain=<d>&min_confidence=90&verification_status=valid,catch-all`
  with base = `AGENTDATA_BASE_URL = 'https://agentdata.run'` (line 42). This matches the H.7 §3
  "URL contains agentdata.run/api/v1/lookup" requirement.
- **Auth header:** `{ Authorization: \`Bearer ${apiKey}\` }` (line 211), where `apiKey` falls back
  to `process.env.AGENTDATA_API_KEY` (lines 186-189). This matches "Authorization: Bearer
  {{ $env.AGENTDATA_API_KEY }}" — but the key interpolation is in the **runner** provider, not in
  n8n templates (no `{{ }}` syntax exists in this design).
- **Workflow default provider:** `Enrich Contact` embedded code defaults to `agentdata`
  (`payload.provider || 'agentdata'`), and the workflow-build test suite asserts
  `provider_runs.agentdata` + `::agentdata` lineage for fixtures 020/026
  (`tests/enrichment-workflow-build.test.js` lines 720-765).
- **No Hunter targeting in the artifact:** the shipped workflow has no Hunter node/credential;
  Hunter survives only as a selectable runner provider (`ENRICHMENT_PROVIDER=hunter`).

**Verdict: H.4-rev rebuild DID take.** The artifact targets AgentData. The H.7 §3 inspection sheet
does not match this repo's architecture (no HTTP node by design) — that is a **docs/expectation
mismatch, not an artifact defect**.

### 3c. Re-verified build integrity (no changes made)

- `npm run verify:frozen` — PASS 24/24 (manifest v5 untouched).
- No file in this workstream was edited (git-status delta is from prior workstreams only).

## 4. Cache-behavior probe

**NOT EXECUTED** (same key blocker). The free-30-day-revisit claim is **not** verifiable here. Note:
this repo does not depend on the provider cache — its own Contact Enrichment Log TTL cache
(60 days, `DEFAULT_TTL_DAYS`) already prevents re-billing for re-visits regardless of provider
behavior, and `creditsUsed` is hard-coded to 1 per executed lookup.

## 5. Divergences (docs vs reality)

1. **Probe sheet §3 inspection command does not apply to this architecture** (no HTTP node by
   design; verified above). Documentation mismatch only — artifact integrity confirmed.
2. **`docs/AGENTDATA-API.md` response shape is unverified** and already visibly out of sync with the
   probe sheet's expectation (`emails.data[]`, `name`/`title`/`is_role_based`, `lookup` object).
   **No live evidence to resolve it.**
3. **No divergence found at the offline wiring level** — URL, auth scheme, default provider, and
   seam plumbing all match `docs/AGENTDATA-API.md` §"Endpoint (assumed)" and
   `docs/OPEN-SOURCE-ENRICHMENT.md`.

## 6. H.8 readiness

**NOT READY — blocked on the live probe.** Nothing is safe to mark ready until the operator
supplies `AGENTDATA_API_KEY` and the probe either confirms the response shape or produces the
divergence report this workstream stops for.

### Operator actions (required to unblock)

1. Set `AGENTDATA_API_KEY` for this environment (`$env:AGENTDATA_API_KEY` in this shell, or a
   `.env` the runner reads) and re-run H.7 §1 — one call,
   `https://agentdata.run/api/v1/lookup?domain=stripe.com&min_confidence=90&verification_status=valid,catch-all`.
2. Re-run H.7 §2 to settle the 30-day re-visit question.
3. If the live shape confirms `name`/`title`/`is_role_based` / `emails.data[]` / `lookup.*`, then
   `docs/AGENTDATA-API.md` needs a code-change first (client mapping already tolerant), then a
   re-baseline — decide, don't let me auto-adapt.

## Completion state

**BLOCKED** (single required input missing: API key). Not PASS, not PARTIAL, not FAIL — the probe
legally cannot run and no claim is fabricated. The offline halves are **PASS** (wiring) and
**N/A** (field-by-field / cache), raw evidence above.

**STOP.** No artifact was modified; `docs/AGENTDATA-API.md` probe status must stay PENDING until
the operator supplies a key.